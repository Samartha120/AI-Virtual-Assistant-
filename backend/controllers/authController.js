const { successResponse, errorResponse } = require('../utils/responseHandler');
// Auth is handled on the frontend via Firebase Client SDK.
// This backend only verifies Firebase ID tokens on protected routes.

const signup = async (req, res) => {
    try {
        return errorResponse(
            res,
            501,
            'Signup is handled by Firebase Authentication on the frontend.',
            'Use createUserWithEmailAndPassword(auth, email, password) in the client.'
        );

    } catch (err) {
        console.error('[Signup] Unexpected error:', err.message);
        errorResponse(res, 500, 'Signup failed. Please try again.', err.message);
    }
};

const login = async (req, res) => {
    try {
        return errorResponse(
            res,
            501,
            'Login is handled by Firebase Authentication on the frontend.',
            'Use signInWithEmailAndPassword(auth, email, password) in the client.'
        );
    } catch (err) {
        errorResponse(res, 500, 'Login failed. Please try again.', err.message);
    }
};

const googleAuth = async (req, res) => {
    successResponse(res, 'Use Firebase Client SDK for Google Auth on the frontend.', {
        provider: 'google',
        action: 'signInWithPopup(auth, new GoogleAuthProvider())',
    });
};

const verifyOtp = async (req, res) => {
    try {
        return errorResponse(
            res,
            410,
            'OTP verification is no longer supported after migrating to Firebase.',
            'Use Firebase email verification (sendEmailVerification) if needed.'
        );

    } catch (err) {
        console.error('[VerifyOTP] Unexpected error:', err.message);
        errorResponse(res, 500, 'OTP verification failed.', err.message);
    }
};

const resendOtp = async (req, res) => {
    try {
        return errorResponse(
            res,
            410,
            'OTP resend is no longer supported after migrating to Firebase.',
            'Use Firebase email verification if needed.'
        );

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
