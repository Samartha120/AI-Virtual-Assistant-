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

const verifyOtp = async (req, res) => {
    try {
        const { email, token } = req.body;

        if (!email || !token) {
            return errorResponse(res, 400, 'Email and OTP token are required');
        }

        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });

        if (error) {
            // Because sometimes Supabase uses type 'email' instead of 'signup' for 6 digit codes
            const retry = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
            if (retry.error) {
                // If both 'email' and 'signup' types fail, return the error from the first attempt
                // or the retry attempt if it provides a more specific message.
                return errorResponse(res, 401, retry.error.message || error.message);
            }
            // If retry was successful, proceed with its data
            successResponse(res, 'OTP verification successful', {
                session: retry.data.session,
                user: retry.data.user
            });
            return;
        }

        successResponse(res, 'OTP verification successful', {
            session: data.session,
            user: data.user
        });
    } catch (err) {
        errorResponse(res, 500, 'OTP verification failed', err.message);
    }
};

module.exports = {
    signup,
    login,
    googleAuth,
    verifyOtp
};
