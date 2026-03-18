/// <reference types="vite/client" />
/**
 * grokService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend AI client for NexusAI.
 *
 * IMPORTANT:
 * - Grok is NEVER called directly from the browser.
 * - All requests proxy through the backend (`/api/*`) where `GROK_API_KEY` lives.
 * - Exports keep legacy signatures so existing modules work unchanged.
 */

import { api, API_BASE_URL } from './apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Chat (Neural Chat + Writing Studio + other helpers)
// ─────────────────────────────────────────────────────────────────────────────

export const askNexus = async (
  prompt: string,
  _context?: string,
  _useSearch: boolean = false,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> => {
  const response = await api.post<{ success: boolean; reply?: string; data?: { reply: string } }>(
    '/api/chat',
    { message: prompt, history: history ?? [] }
  );
  return response.reply || response.data?.reply || '';
};

/**
 * Optional: real streaming if you want it later.
 * Returns an async iterator of text deltas.
 */
export async function* askNexusStream(
  prompt: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): AsyncGenerator<string> {
  // Use fetch directly for streaming; apiClient buffers JSON.
  // API_BASE_URL is already normalized (including stripping trailing "/api").
  const url = `${API_BASE_URL}/api/chat/stream`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cachedToken = localStorage.getItem('firebase-id-token');
  if (cachedToken) headers.Authorization = `Bearer ${cachedToken}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: prompt, history: history ?? [] }),
  });

  if (!resp.ok || !resp.body) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Stream request failed: ${resp.status} ${resp.statusText} ${body}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames: lines starting with "data: "
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const line = frame
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!line) continue;

      const data = line.replace(/^data:\s*/, '');
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data) as { delta?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (typeof parsed.delta === 'string' && parsed.delta.length > 0) yield parsed.delta;
      } catch {
        // Ignore malformed frames
      }
    }
  }
}

export const getChatHistory = async (): Promise<any[]> => {
  try {
    const response = await api.get<{ data: any[] }>('/api/ai/history');
    return response.data || [];
  } catch {
    return [];
  }
};

export const clearChatHistory = async (): Promise<void> => {
  try {
    await api.delete('/api/ai/history');
  } catch {
    // ignore
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Brainstormer
// ─────────────────────────────────────────────────────────────────────────────

export const brainstormIdeas = async (topic: string, _context?: string): Promise<string> => {
  const response = await api.post<{ ideas: string }>('/api/brainstorm', { topic });
  return response.ideas || '';
};

// ─────────────────────────────────────────────────────────────────────────────
// Doc Analyzer
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeDocument = async (text: string, _context?: string): Promise<string> => {
  const response = await api.post<{ result: unknown }>('/api/analyze', { text });
  return JSON.stringify(response.result);
};

// ─────────────────────────────────────────────────────────────────────────────
// Tasks AI
// ─────────────────────────────────────────────────────────────────────────────

export const generateTaskAnalysis = async (tasks: string): Promise<string> => {
  const response = await api.post<{ advice: string }>('/api/tasks/ai', {
    action: 'analyze',
    tasks,
  });
  return response.advice || '';
};

export const decomposeTask = async (
  task: string
): Promise<{ title: string; priority: 'low' | 'medium' | 'high' }[]> => {
  const response = await api.post<{
    subtasks: { title: string; priority: 'low' | 'medium' | 'high' }[];
  }>('/api/tasks/ai', {
    action: 'decompose',
    taskTitle: task,
  });
  return response.subtasks || [];
};
