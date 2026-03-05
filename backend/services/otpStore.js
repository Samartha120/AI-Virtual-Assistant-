/**
 * In-memory OTP store with automatic expiry.
 * Maps email → { otp, expiresAt }
 * OTPs are valid for 10 minutes.
 */

const store = new Map();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cryptographically-safe 6-digit OTP and store it.
 * @param {string} email
 * @returns {string} the generated OTP
 */
function setOtp(email) {
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    store.set(email.toLowerCase(), {
        otp,
        expiresAt: Date.now() + OTP_TTL_MS,
    });
    return otp;
}

/**
 * Verify an OTP for a given email.
 * Returns true and deletes the entry on success.
 * Returns false if the OTP is wrong or expired.
 * @param {string} email
 * @param {string} otp
 * @returns {boolean}
 */
function verifyOtp(email, otp) {
    const entry = store.get(email.toLowerCase());
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
        store.delete(email.toLowerCase());
        return false;
    }
    if (entry.otp !== String(otp)) return false;
    store.delete(email.toLowerCase()); // one-time use
    return true;
}

/**
 * Check if there's a valid (non-expired) OTP in the store for this email.
 * @param {string} email
 * @returns {boolean}
 */
function hasOtp(email) {
    const entry = store.get(email.toLowerCase());
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
        store.delete(email.toLowerCase());
        return false;
    }
    return true;
}

module.exports = { setOtp, verifyOtp, hasOtp };
