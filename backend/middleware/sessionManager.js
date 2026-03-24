const authenticateUser = require('./authMiddleware');
const { logEvent } = require('../utils/logService');

function getClientIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.trim()) {
    return xfwd.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || null;
}

function parseUserAgent(uaRaw) {
  const ua = String(uaRaw || '').trim();
  if (!ua) return { device: null, browser: null };

  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';

  let device = 'Desktop';
  if (/android/i.test(ua)) device = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) device = 'iOS';

  return { device, browser };
}

/**
 * Session manager middleware
 * - Verifies Firebase ID token (via existing auth middleware)
 * - Ensures req.user.id exists
 * - Attaches req.session context
 * - Logs request metadata asynchronously
 */
function sessionManager(options = {}) {
  const {
    type = 'api',
    action = 'API_CALL',
    module: moduleName = null,
  } = options;

  return async (req, res, next) => {
    // Reuse existing token verification
    await authenticateUser(req, res, async (err) => {
      if (err) return next(err);

      const userId = req.user?.id;
      const ip = getClientIp(req);
      const { device, browser } = parseUserAgent(req.headers['user-agent']);

      const startedAt = Date.now();

      req.session = {
        userId,
        route: req.originalUrl || req.path,
        timestamp: startedAt,
        type,
        action,
        module: moduleName,
        metadata: { device, browser, ip },
      };

      // Log after response finishes to avoid delaying API.
      res.on('finish', () => {
        if (!userId) return;

        const route = req.originalUrl || req.path;
        // Avoid infinite/noisy logs: do not log reads of the logs endpoint itself.
        if (typeof route === 'string' && route.startsWith('/api/system-logs')) return;

        const durationMs = Math.max(0, Date.now() - startedAt);
        const status = res.statusCode;

        logEvent(userId, {
          type,
          action,
          module: moduleName,
          route,
          clientTimestamp: startedAt,
          metadata: { device, browser, ip },
          // extra details
          status,
          durationMs,
        });
      });

      next();
    });
  };
}

module.exports = sessionManager;
