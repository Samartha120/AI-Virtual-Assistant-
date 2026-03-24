const express = require('express');
const router = express.Router();
const sessionManager = require('../middleware/sessionManager');
const { adminDb } = require('../config/firebaseAdmin');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { logEvent } = require('../utils/logService');

// Only authenticated users can access their logs
router.use(sessionManager({ type: 'api', action: 'API_CALL', module: 'system_logs' }));

router.get('/system-logs', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 500);
    const type = typeof req.query.type === 'string' ? req.query.type : null;
    const moduleName = typeof req.query.module === 'string' ? req.query.module : null;

    let ref = adminDb
      .collection('users')
      .doc(String(userId))
      .collection('system_logs');

    // Optional filters (avoid composite index requirements by filtering in-memory if needed)
    // We keep orderBy on timestamp for UX.
    let queryRef = ref.orderBy('timestamp', 'desc').limit(limit);

    const snap = await queryRef.get();

    let logs = snap.docs.map((d) => {
      const data = d.data();
      const ts = data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp;
      return {
        id: d.id,
        ...data,
        timestamp: ts || null,
        timestampMillis: typeof data.timestampMillis === 'number'
          ? data.timestampMillis
          : (data.clientTimestamp || 0),
      };
    });

    if (type) logs = logs.filter((l) => String(l.type || '') === String(type));
    if (moduleName) logs = logs.filter((l) => String(l.module || '') === String(moduleName));

    return successResponse(res, 'System logs retrieved', { logs });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to retrieve system logs', err.message);
  }
});

router.post('/system-logs', async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      type,
      action,
      module,
      provider,
      route,
      clientTimestamp,
      message,
      description,
      status,
      durationMs,
      errorCode,
      errorMessage,
    } = req.body || {};

    // Fire-and-forget; respond immediately
    logEvent(userId, {
      type: type || 'module',
      action: action || 'UNKNOWN',
      module: module || null,
      provider: provider || null,
      route: typeof route === 'string' ? route : (req.originalUrl || req.path),
      description:
        typeof description === 'string'
          ? description
          : (typeof message === 'string' ? message : undefined),
      status: typeof status === 'number' ? status : undefined,
      durationMs: typeof durationMs === 'number' ? durationMs : undefined,
      errorCode: typeof errorCode === 'string' ? errorCode : undefined,
      errorMessage: typeof errorMessage === 'string' ? errorMessage : undefined,
      clientTimestamp: typeof clientTimestamp === 'number' ? clientTimestamp : undefined,
      metadata: req.session?.metadata,
    });

    return successResponse(res, 'System log queued', { ok: true });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to queue system log', err.message);
  }
});

module.exports = router;
