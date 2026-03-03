const { supabaseAuth } = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const signup = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password) {
            return errorResponse(res, 400, 'Email and password are required');
        }
        if (password.length < 6) {
            return errorResponse(res, 400, 'Password must be at least 6 characters');
        }

        const { data, error } = await supabaseAuth.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: full_name || '' }
            }
        });

        if (error) {
            if (error.status === 429 || error.message.toLowerCase().includes("rate limit")) {
                return errorResponse(res, 429, "Email rate limit exceeded. Please wait a few minutes before trying again.");
            }
            return errorResponse(res, 400, error.message);
        }

        // If Supabase email confirmation is DISABLED, a session is returned immediately
        // If email confirmation is ENABLED, session is null and user must verify OTP
        const requiresEmailVerification = !data.session;

        successResponse(res, requiresEmailVerification
            ? 'Signup successful. Please check your email for your verification code.'
            : 'Account created successfully.',
            {
                user: data.user,
                session: data.session || null,
                requiresEmailVerification
            }
        );
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

        const { data, error } = await supabaseAuth.auth.signInWithPassword({
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
        if (!/^\d{6}$/.test(token)) {
            return errorResponse(res, 400, 'OTP must be a 6-digit number');
        }

        // Supabase 6-digit email OTP uses type: 'email'
        const { data, error } = await supabaseAuth.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });

        if (error) {
            const isExpired = error.message.toLowerCase().includes('expired') || error.message.toLowerCase().includes('invalid');
            const statusCode = isExpired ? 410 : 401; // 410 Gone = expired
            return errorResponse(res, statusCode, isExpired
                ? 'Verification code has expired or is invalid. Please request a new one.'
                : error.message
            );
        }

        successResponse(res, 'OTP verification successful', {
            session: data.session,
            user: data.user
        });
    } catch (err) {
        errorResponse(res, 500, 'OTP verification failed', err.message);
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return errorResponse(res, 400, 'Email and password are required to resend code');
        }

        // auth.resend() with type:'signup' silently fails for OTP flows.
        // Calling signUp() again on an unconfirmed email is the reliable way:
        // Supabase will resend the OTP without creating a duplicate user.
        const { error } = await supabaseAuth.auth.signUp({
            email,
            password,
        });

        if (error) {
            if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
                return errorResponse(res, 429, 'Please wait a minute before requesting a new code.');
            }
            return errorResponse(res, 400, error.message);
        }

        successResponse(res, 'Verification code resent. Please check your email.');
    } catch (err) {
        errorResponse(res, 500, 'Failed to resend verification code', err.message);
    }
};

module.exports = {
    signup,
    login,
    googleAuth,
    verifyOtp,
    resendOtp
};
