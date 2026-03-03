const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load environment variables FIRST before importing supabase config
dotenv.config();

// Supabase client (will process.exit(1) if env vars are missing)
const supabase = require('./config/supabase');

const app = express();

// ─── Security Middleware ──────────────────────────────────────────
app.use(helmet()); // Adds secure HTTP headers

// CORS — allow frontend origins (dev + production)
const allowedOrigins = [
    process.env.FRONTEND_URL,  // e.g. https://your-app.vercel.app
    'http://localhost:3000',
    'http://localhost:5173',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, Postman, curl)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// Strict limiter for AI endpoints (Gemini API quota protection)
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15,
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

// ─── Routes ───────────────────────────────────────────────────────
// Public Gemini AI routes (no auth required) — /api/chat, /api/brainstorm, /api/analyze, /api/tasks/ai
app.use('/api', aiLimiter, require('./routes/ai.routes'));

// Authenticated routes
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api/ai', aiLimiter, require('./routes/chat.routes'));
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

// ─── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack || err.message);

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
