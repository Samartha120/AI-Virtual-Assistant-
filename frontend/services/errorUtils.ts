import { ApiError } from './apiClient';

export function getUserFacingAiError(err: unknown): string {
  const fallback = 'I encountered a neural synchronization error. Please try again.';

  if (!err || typeof err !== 'object') return fallback;

  if (err instanceof ApiError) {
    // Backend Grok integration error codes
    switch (err.code) {
      case 'HF_KEY_SUSPECT':
        return 'AI backend is misconfigured (wrong HF_API_KEY). Please update the key on the backend and redeploy.';
      case 'HF_KEY_MISSING':
        return 'AI backend is missing HF_API_KEY. Please set it on the backend and redeploy.';
      case 'HF_AUTH_INVALID':
        return 'AI backend key is invalid/unauthorized. Please update HF_API_KEY on the backend.';
      case 'HF_RATE_LIMIT':
        return 'AI rate limit reached. Please wait a moment and try again.';
      case 'HF_UPSTREAM':
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
