const { supabase, supabaseAuth } = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { setOtp, verifyOtp: checkOtp, hasOtp } = require('../services/otpStore');
const { sendOtpEmail } = require('../services/emailService');

// ─── Temporary store for pending signup passwords (needed for auto-login after OTP) ─
// Maps email → { password, fullName }
const pendingSignups = new Map();

const signup = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password) {
            return errorResponse(res, 400, 'Email and password are required');
        }
        if (password.length < 6) {
            return errorResponse(res, 400, 'Password must be at least 6 characters');
        }

        // Step 1: Create user via Admin API (auto-confirmed, no Supabase email sent)
        // If user already exists and is confirmed, this will error — we handle that below
        const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // auto-confirm so Supabase doesn't try to send email
            user_metadata: { full_name: full_name || '' },
        });

        if (adminError) {
            // If user already exists (confirmed), tell them to log in instead
            if (
                adminError.message.toLowerCase().includes('already exists') ||
                adminError.message.toLowerCase().includes('already registered')
            ) {
                return errorResponse(res, 409, 'An account with this email already exists. Please log in instead.');
            }
            console.error('[Signup] Admin createUser error:', adminError.message);
            return errorResponse(res, 400, adminError.message);
        }

        // Step 2: Generate OTP and send it ourselves via Resend API
        const otp = setOtp(email);
        pendingSignups.set(email.toLowerCase(), { password, fullName: full_name || '' });

        try {
            await sendOtpEmail(email, otp, full_name);
        } catch (emailErr) {
            // If email fails, clean up the created user so they can retry
            console.error('[Signup] Failed to send OTP email:', emailErr.message);
            await supabase.auth.admin.deleteUser(adminData.user.id).catch(() => { });
            pendingSignups.delete(email.toLowerCase());
            return errorResponse(res, 500, 'Account created but failed to send verification email. Please check your email address and try again.');
        }

        return successResponse(res, 'Account created. Please check your email for your 6-digit verification code.', {
            requiresEmailVerification: true,
            user: { id: adminData.user.id, email: adminData.user.email },
            session: null,
        });

    } catch (err) {
        console.error('[Signup] Unexpected error:', err.message);
        errorResponse(res, 500, 'Signup failed. Please try again.', err.message);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return errorResponse(res, 400, 'Email and password are required');
        }

        const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

        if (error) {
            if (error.message === 'Invalid login credentials') {
                return errorResponse(res, 401, 'Invalid email or password. Please check your credentials and try again.');
            }
            return errorResponse(res, 401, error.message);
        }

        return successResponse(res, 'Login successful', {
            session: data.session,
            user: data.user,
        });
    } catch (err) {
        errorResponse(res, 500, 'Login failed. Please try again.', err.message);
    }
};

const googleAuth = async (req, res) => {
    successResponse(res, 'Use Supabase Client SDK for Google Auth on the frontend.', {
        provider: 'google',
        action: 'supabase.auth.signInWithOAuth({ provider: "google" })',
    });
};

const verifyOtp = async (req, res) => {
    try {
        const { email, token } = req.body;

        if (!email || !token) {
            return errorResponse(res, 400, 'Email and OTP token are required');
        }

        const isValid = checkOtp(email, String(token));

        if (!isValid) {
            return errorResponse(res, 410, 'Verification code is invalid or has expired. Please request a new one.');
        }

        // OTP verified — sign the user in to get a session
        const pending = pendingSignups.get(email.toLowerCase());
        const password = pending?.password;

        if (!password) {
            // The server may have restarted and lost the pending signup — ask user to log in
            pendingSignups.delete(email.toLowerCase());
            return successResponse(res, 'Email verified! Please log in with your credentials.', {
                requiresLogin: true,
            });
        }

        const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
        pendingSignups.delete(email.toLowerCase());

        if (error) {
            console.error('[VerifyOTP] Sign-in after OTP failed:', error.message);
            return successResponse(res, 'Email verified! Please log in with your credentials.', {
                requiresLogin: true,
            });
        }

        return successResponse(res, 'Email verified and logged in successfully.', {
            session: data.session,
            user: data.user,
        });

    } catch (err) {
        console.error('[VerifyOTP] Unexpected error:', err.message);
        errorResponse(res, 500, 'OTP verification failed.', err.message);
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return errorResponse(res, 400, 'Email is required');
        }

        // Check if there's a pending signup for this email
        const pending = pendingSignups.get(email.toLowerCase());
        if (!pending) {
            return errorResponse(res, 400, 'No pending signup found for this email. Please start the signup process again.');
        }

        const otp = setOtp(email);

        try {
            await sendOtpEmail(email, otp, pending.fullName);
        } catch (emailErr) {
            console.error('[ResendOTP] Failed to send email:', emailErr.message);
            return errorResponse(res, 500, 'Failed to resend verification code. Please try again in a moment.');
        }

        return successResponse(res, 'New verification code sent! Please check your inbox.');

    } catch (err) {
        console.error('[ResendOTP] Unexpected error:', err.message);
        errorResponse(res, 500, 'Failed to resend verification code.', err.message);
    }
};

module.exports = {
    signup,
    login,
    googleAuth,
    verifyOtp,
    resendOtp,
};
