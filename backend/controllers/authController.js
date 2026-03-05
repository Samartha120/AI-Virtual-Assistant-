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

        // Step 1: Create the user with standard signUp (no email sent if Supabase email
        // confirmation is disabled, or we'll immediately override below)
        const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
            email,
            password,
            options: { data: { full_name: full_name || '' } }
        });

        if (signUpError) {
            console.error('[Signup] signUp error:', signUpError.message);
            if (
                signUpError.message.toLowerCase().includes('already registered') ||
                signUpError.message.toLowerCase().includes('already exists') ||
                signUpError.status === 422
            ) {
                return errorResponse(res, 409, 'An account with this email already exists. Please log in instead.');
            }
            return errorResponse(res, 400, 'Signup failed: ' + signUpError.message);
        }

        const userId = signUpData?.user?.id;
        if (!userId) {
            return errorResponse(res, 500, 'Failed to create account. Please try again.');
        }

        // Step 2: Immediately auto-confirm the email via admin API
        // This stops Supabase from sending any confirmation email
        await supabase.auth.admin.updateUserById(userId, {
            email_confirm: true
        }).catch(err => console.warn('[Signup] Auto-confirm warning:', err.message));

        // Step 3: Generate OTP and send via Resend ourselves
        const otp = setOtp(email);
        pendingSignups.set(email.toLowerCase(), { password, fullName: full_name || '', userId });

        try {
            await sendOtpEmail(email, otp, full_name);
        } catch (emailErr) {
            console.error('[Signup] Failed to send OTP email:', emailErr.message);
            // Delete the created user so they can retry cleanly
            await supabase.auth.admin.deleteUser(userId).catch(() => { });
            pendingSignups.delete(email.toLowerCase());
            return errorResponse(res, 500,
                'Account setup failed: could not send verification email. ' +
                'Please check your RESEND_API_KEY environment variable.'
            );
        }

        return successResponse(res, 'Account created. Please check your email for your 6-digit verification code.', {
            requiresEmailVerification: true,
            user: { id: userId, email: signUpData.user.email },
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
