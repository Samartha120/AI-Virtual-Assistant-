const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables FIRST
dotenv.config();

const app = express();

// Trust the first proxy (required on Render, Heroku, Railway etc.)
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// ─── Security Middleware ──────────────────────────────────────────
app.use(helmet()); // Adds secure HTTP headers

// CORS — allow frontend origins (dev + production)
function parseOriginList(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

const envOrigins = [
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.FRONTEND_URLS),
];

const allowedOrigins = [
    ...envOrigins, // Custom domains if set (supports comma-separated)
    'https://nexsus-ai.onrender.com', // Render production URL
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
].filter(Boolean);

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. Postman/curl)
        if (!origin) return callback(null, true);

        // In dev, allow any localhost port to avoid constant port mismatch issues.
        if (isDev && (/^http:\/\/localhost:\d+$/i.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/i.test(origin))) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// Ensure preflight requests succeed (fixes "blocked by CORS policy" in browser)
app.options(/.*/, cors(corsOptions));

// Request logger
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.path}`);
    next();
});

// ─── Body Parsers ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────
// General API limiter
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' }
});

// Strict limiter for AI endpoints (Grok API quota protection)
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDev ? 300 : 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'AI rate limit reached. Please wait before sending more messages.' }
});

// Auth limiter (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many auth attempts. Please try again in 15 minutes.' }
});

app.use(generalLimiter);

// ─── Health Check ────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    try {
        const { adminDb } = require('./config/firebaseAdmin');
        const snap = await adminDb.collection('health_check').limit(1).get();
        res.json({
            success: true,
            status: 'OK',
            firestore: 'CONNECTED',
            env: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            status: 'ERROR',
            firestore: 'FAILED',
            error: err.message
        });
    }
});

// ─── Routes ───────────────────────────────────────────────────────
// Public Grok AI routes (no auth required) — /api/chat, /api/chat/stream, /api/brainstorm, /api/analyze, /api/tasks/ai
// app.use('/api', aiLimiter, require('./routes/ai.routes'));

// Authenticated routes
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api', aiLimiter, require('./routes/chat.routes')); // Mounts /chat, /sessions, /messages
// app.use('/api/legacy_ai', aiLimiter, require('./routes/ai.routes')); // Preserved just in case
app.use('/api/files', require('./routes/file.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/api/knowledge', require('./routes/knowledge.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));

// ─── Health Check ─────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'NexusAI Backend is Running',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// ─── Serve React Frontend (Production) ────────────────────────────
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ─── 404 Handler (API routes only) ────────────────────────────────
// Must come BEFORE the SPA catch-all
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            success: false,
            message: `Route ${req.method} ${req.originalUrl} not found`
        });
    }
    next();
});

// Catch-all: send index.html for any non-API route (React Router / SPA support)
// Uses plain app.use() to avoid path-to-regexp v8 wildcard incompatibility (Express 5)
app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[CRITICAL_ERROR]', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });

    // Handle Multer upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
    }
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ success: false, message: err.message });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ─── Start Server ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ NexusAI Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`📡 API Base: http://localhost:${PORT}`);
});
