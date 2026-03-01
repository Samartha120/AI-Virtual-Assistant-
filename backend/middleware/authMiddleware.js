const supabase = require('../config/supabase');

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

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error('Supabase Auth Error:', error?.message);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token.'
            });
        }

        // Attach user to request object
        req.user = user;
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
