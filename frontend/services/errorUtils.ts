import { ApiError } from './apiClient';

export function getUserFacingAiError(err: unknown): string {
  const fallback = 'I encountered a neural synchronization error. Please try again.';

  if (!err || typeof err !== 'object') return fallback;

  if (err instanceof ApiError) {
    // Backend Grok integration error codes
    switch (err.code) {
      case 'GROK_KEY_SUSPECT':
        return 'AI backend is misconfigured (wrong GROK_API_KEY). Please update the key on the backend and redeploy.';
      case 'GROK_KEY_MISSING':
        return 'AI backend is missing GROK_API_KEY. Please set it on the backend and redeploy.';
      case 'GROK_AUTH_INVALID':
        return 'AI backend key is invalid/unauthorized. Please update GROK_API_KEY on the backend.';
      case 'GROK_RATE_LIMIT':
        return 'AI rate limit reached. Please wait a moment and try again.';
      case 'GROK_UPSTREAM':
        return 'AI provider is temporarily unavailable. Please try again.';
      default:
        // If backend provided a message, use a short safe version.
        return err.message || fallback;
    }
  }

  const anyErr = err as { message?: unknown };
  if (typeof anyErr.message === 'string' && anyErr.message.trim()) return anyErr.message;
  return fallback;
}
