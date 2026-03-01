/// <reference types="vite/client" />
/**
 * geminiService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  REFACTORED — Gemini is NO LONGER called directly from the browser.
 *
 * All AI calls proxy through the secure backend:
 *   Frontend → https://nexsus-ai.onrender.com → Gemini API
 *
 * Exports keep the SAME signatures as before so callers (ChatInterface,
 * Brainstormer, DocumentAnalyzer, TaskBoard) need ZERO changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://nexsus-ai.onrender.com';

// ── Internal fetch helper ─────────────────────────────────────────────────────
async function callBackend<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const msg = data?.error ?? `Backend error ${response.status}`;
    console.error(`[geminiService] ${path} failed:`, msg);
    throw new Error(msg);
  }

  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// askNexus — used by ChatInterface.tsx
// ─────────────────────────────────────────────────────────────────────────────
export const askNexus = async (
  prompt: string,
  _context?: string,
  _useSearch: boolean = false
): Promise<string> => {
  const data = await callBackend<{ reply: string }>('/api/chat', { message: prompt });
  return data.reply;
};

// ─────────────────────────────────────────────────────────────────────────────
// brainstormIdeas — used by Brainstormer.tsx
// ─────────────────────────────────────────────────────────────────────────────
export const brainstormIdeas = async (
  topic: string,
  _context?: string
): Promise<string> => {
  const data = await callBackend<{ ideas: string }>('/api/brainstorm', { topic });
  return data.ideas;
};

// ─────────────────────────────────────────────────────────────────────────────
// analyzeDocument — used by DocumentAnalyzer.tsx
// Returns raw JSON string (caller does JSON.parse)
// ─────────────────────────────────────────────────────────────────────────────
export const analyzeDocument = async (
  text: string,
  _context?: string
): Promise<string> => {
  const data = await callBackend<{ result: unknown }>('/api/analyze', { text });
  // Return as JSON string because DocumentAnalyzer.tsx calls JSON.parse() on the result
  return JSON.stringify(data.result);
};

// ─────────────────────────────────────────────────────────────────────────────
// generateTaskAnalysis — used by TaskBoard.tsx (AI Optimize button)
// ─────────────────────────────────────────────────────────────────────────────
export const generateTaskAnalysis = async (tasks: string): Promise<string> => {
  const data = await callBackend<{ advice: string }>('/api/tasks/ai', {
    action: 'analyze',
    tasks,
  });
  return data.advice;
};

// ─────────────────────────────────────────────────────────────────────────────
// decomposeTask — used by TaskBoard.tsx (task decompose via custom event)
// ─────────────────────────────────────────────────────────────────────────────
export const decomposeTask = async (
  task: string
): Promise<{ title: string; priority: 'low' | 'medium' | 'high' }[]> => {
  const data = await callBackend<{
    subtasks: { title: string; priority: 'low' | 'medium' | 'high' }[];
  }>('/api/tasks/ai', {
    action: 'decompose',
    taskTitle: task,
  });
  return data.subtasks;
};
