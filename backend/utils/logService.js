const { FieldValue } = require('firebase-admin/firestore');
const { adminDb } = require('../config/firebaseAdmin');

/**
 * Fire-and-forget system logging.
 * Collection: users/{userId}/system_logs/{logId}
 *
 * logData schema:
 * {
 *   type: 'auth' | 'api' | 'module' | 'ai',
 *   action: string,
 *   module?: string,
 *   provider?: string,
 *   route?: string,
 *   metadata?: { device?: string, browser?: string, ip?: string }
 * }
 */
function logEvent(userId, logData) {
  // Non-blocking by design: never throw to caller.
  if (!adminDb) return Promise.resolve(null);
  if (!userId) return Promise.resolve(null);

  const safe = (v) => (typeof v === 'string' ? v : v == null ? undefined : String(v));

  const doc = {
    type: safe(logData?.type) || 'api',
    action: safe(logData?.action) || 'UNKNOWN',
    module: safe(logData?.module) || null,
    provider: safe(logData?.provider) || null,
    route: safe(logData?.route) || null,
    // Source of truth
    timestamp: FieldValue.serverTimestamp(),
    // Convenience fields for UI sorting while waiting for serverTimestamp to resolve
    clientTimestamp: typeof logData?.clientTimestamp === 'number' ? logData.clientTimestamp : Date.now(),
    timestampMillis: Date.now(),
    details: {
      description: safe(logData?.description) || null,
      status: typeof logData?.status === 'number' ? logData.status : null,
      durationMs: typeof logData?.durationMs === 'number' ? logData.durationMs : null,
      errorCode: safe(logData?.errorCode) || null,
      errorMessage: safe(logData?.errorMessage) || null,
    },
    metadata: {
      device: safe(logData?.metadata?.device) || null,
      browser: safe(logData?.metadata?.browser) || null,
      ip: safe(logData?.metadata?.ip) || null,
    },
  };

  return adminDb
    .collection('users')
    .doc(String(userId))
    .collection('system_logs')
    .add(doc)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[SystemLog] write failed:', err?.message || err);
      return null;
    });
}

module.exports = {
  logEvent,
};
