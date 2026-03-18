const { adminAuth } = require('../config/firebaseAdmin');

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Invalid token format.'
            });
        }

        const decoded = await adminAuth.verifyIdToken(token);
        if (!decoded?.uid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token.',
                code: 'AUTH_INVALID_TOKEN',
            });
        }

        // Attach a stable shape for controllers expecting `req.user.id`
        req.user = {
            id: decoded.uid,
            email: decoded.email,
            ...decoded,
        };
        next();

    } catch (err) {
        const msg = typeof err?.message === 'string' ? err.message : 'Unknown error';
        const code = typeof err?.code === 'string' ? err.code : undefined;
        console.error('Auth Middleware Error:', msg);

        // Treat token verification failures as 401, not 500.
        // Common codes:
        // - auth/id-token-expired
        // - auth/argument-error
        // - auth/invalid-id-token
        // - auth/id-token-revoked
        if (code && code.startsWith('auth/')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token.',
                code: 'AUTH_INVALID_TOKEN',
                detail: msg,
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal processing error.',
            code: 'AUTH_MIDDLEWARE_ERROR',
            detail: msg,
        });
    }
};

module.exports = authenticateUser;
