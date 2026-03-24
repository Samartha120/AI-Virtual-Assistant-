import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { logSystemEvent } from './interactionService';

function isLogsRoute(pathname: string) {
  return pathname === '/system-logs';
}

function moduleFromPathname(pathname: string) {
  if (pathname.startsWith('/chat/live')) return 'live_assistant';
  if (pathname.startsWith('/chat/neural')) return 'neural_chat';
  if (pathname.startsWith('/chat/doc')) return 'doc_analyzer';
  if (pathname.startsWith('/chat/brainstorm')) return 'brainstormer';
  if (pathname.startsWith('/chat/write')) return 'writing_studio';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/task-board')) return 'task_board';
  if (pathname.startsWith('/knowledge-base')) return 'knowledge_base';
  if (pathname.startsWith('/focus-timer')) return 'focus_timer';
  if (pathname.startsWith('/goal-tracker')) return 'goal_tracker';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/system-logs')) return 'system_logs';
  return pathname.replace(/^\//, '') || 'root';
}

export function useAuditTrailNavigation() {
  const location = useLocation();
  const prevPathRef = React.useRef<string | null>(null);
  const enterAtRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const pathname = location.pathname;

    // First render: treat as module enter.
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname;
      enterAtRef.current = Date.now();

      if (!isLogsRoute(pathname)) {
        logSystemEvent({
          type: 'navigation',
          action: 'NAVIGATE_ENTER',
          module: moduleFromPathname(pathname),
          route: pathname,
          message: `Entered ${pathname}`,
        });
      }
      return;
    }

    const prev = prevPathRef.current;
    if (prev === pathname) return;

    const now = Date.now();
    const durationMs = Math.max(0, now - enterAtRef.current);

    // Leave previous route
    if (!isLogsRoute(prev)) {
      logSystemEvent({
        type: 'navigation',
        action: 'NAVIGATE_LEAVE',
        module: moduleFromPathname(prev),
        route: prev,
        durationMs,
        message: `Left ${prev} -> ${pathname}`,
      });
    }

    // Enter new route
    if (!isLogsRoute(pathname)) {
      logSystemEvent({
        type: 'navigation',
        action: 'NAVIGATE_ENTER',
        module: moduleFromPathname(pathname),
        route: pathname,
        message: `Entered ${pathname}`,
      });
    }

    prevPathRef.current = pathname;
    enterAtRef.current = now;
  }, [location.pathname]);
}

export function useAuditTrailTabClose() {
  const location = useLocation();

  React.useEffect(() => {
    const handler = () => {
      const pathname = location.pathname;
      if (isLogsRoute(pathname)) return;

      // Best-effort: use sendBeacon to avoid cancellation on unload.
      try {
        const token = localStorage.getItem('firebase-id-token');
        const url = `${window.location.origin}/api/system-logs`;

        const body = JSON.stringify({
          type: 'navigation',
          action: 'TAB_CLOSE',
          module: moduleFromPathname(pathname),
          route: pathname,
          message: `Tab/window closed on ${pathname}`,
          clientTimestamp: Date.now(),
        });

        const ok = navigator.sendBeacon(
          url,
          new Blob([body], {
            type: 'application/json',
          })
        );

        // If sendBeacon isn't available/failed, fallback (may be cancelled by browser)
        if (!ok) {
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body,
            keepalive: true,
          }).catch(() => undefined);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [location.pathname]);
}
