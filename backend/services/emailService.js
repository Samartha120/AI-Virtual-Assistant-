const { Resend } = require('resend');

// Lazy client — only instantiated when actually needed.
// Prevents server crash on startup if RESEND_API_KEY is not set.
let _resend = null;
function getResendClient() {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_placeholder')) {
    console.warn('[EmailService] RESEND_API_KEY not set — email sending disabled.');
    return null;
  }
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const SENDER_NAME = 'Nexus Enterprise OS';

/**
 * Send a signup OTP verification email to the user.
 * @param {string} toEmail  - recipient email
 * @param {string} otp      - 6-digit code
 * @param {string} fullName - user's display name (optional)
 */
async function sendOtpEmail(toEmail, otp, fullName = '') {
  const displayName = fullName || 'there';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Verify your email</title>
    </head>
    <body style="margin:0;padding:0;background:#0f0f12;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f12;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a24;border-radius:16px;border:1px solid #2a2a3a;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#6c47ff,#3b82f6);padding:32px;text-align:center;">
                  <div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
                    <span style="color:#fff;font-size:26px;font-weight:900;line-height:52px;width:52px;text-align:center;">N</span>
                  </div>
                  <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">Nexus Enterprise OS</h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:36px 40px;">
                  <p style="color:#e2e8f0;font-size:16px;margin:0 0 8px;">Hi ${displayName},</p>
                  <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6;">
                    Use the verification code below to complete your Nexus account setup. This code expires in <strong style="color:#e2e8f0;">10 minutes</strong>.
                  </p>
                  <!-- OTP Box -->
                  <div style="background:#0f0f18;border:2px solid #6c47ff;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                    <p style="color:#94a3b8;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Your verification code</p>
                    <span style="color:#fff;font-size:40px;font-weight:900;letter-spacing:12px;font-family:monospace;">${otp}</span>
                  </div>
                  <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;">
                    If you didn't create a Nexus account, please ignore this email. Do not share this code with anyone.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 40px;border-top:1px solid #2a2a3a;text-align:center;">
                  <p style="color:#475569;font-size:12px;margin:0;">© ${new Date().getFullYear()} Nexus Enterprise OS. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

  const client = getResendClient();
  if (!client) {
    console.warn(`[EmailService] Email disabled — would have sent OTP ${otp} to ${toEmail}`);
    return { id: 'disabled' };
  }

  const { data, error } = await client.emails.send({
    from: `${SENDER_NAME} <${FROM_ADDRESS}>`,
    to: [toEmail],
    subject: `${otp} is your Nexus verification code`,
    html,
  });

  if (error) {
    console.error('[EmailService] Resend error:', error);
    throw new Error(error.message || 'Failed to send verification email');
  }

  console.log(`[EmailService] OTP email sent to ${toEmail}, id: ${data?.id}`);
  return data;
}

module.exports = { sendOtpEmail };
