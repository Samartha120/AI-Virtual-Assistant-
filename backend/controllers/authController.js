const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const signup = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        // Input validation
        if (!email || !password) {
            return errorResponse(res, 400, 'Email and password are required');
        }
        if (password.length < 6) {
            return errorResponse(res, 400, 'Password must be at least 6 characters');
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: full_name || '' }
            }
        });

        if (error) {
            return errorResponse(res, 400, error.message);
        }

        successResponse(res, 'Signup successful. Please check your email for verification.', {
            user: data.user
        });
    } catch (err) {
        errorResponse(res, 500, 'Signup failed', err.message);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return errorResponse(res, 400, 'Email and password are required');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return errorResponse(res, 401, error.message);
        }

        successResponse(res, 'Login successful', {
            session: data.session,
            user: data.user
        });
    } catch (err) {
        errorResponse(res, 500, 'Login failed', err.message);
    }
};

// Google OAuth is handled client-side via Supabase SDK.
// This endpoint exists to inform the frontend of the correct approach.
const googleAuth = async (req, res) => {
    successResponse(res, 'Use Supabase Client SDK for Google Auth on the frontend.', {
        provider: 'google',
        action: 'supabase.auth.signInWithOAuth({ provider: "google" })'
    });
};

module.exports = {
    signup,
    login,
    googleAuth
};
