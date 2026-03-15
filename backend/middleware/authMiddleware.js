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
                message: 'Invalid or expired token.'
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
        console.error('Auth Middleware Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Internal processing error.'
        });
    }
};

module.exports = authenticateUser;
