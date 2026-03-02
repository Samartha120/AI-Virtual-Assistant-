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

import { api } from './apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// ── Core request helper ───────────────────────────────────────────────────────
// We now rely on apiClient.ts which safely injects the sb-access-token!
// askNexus — used by ChatInterface.tsx
// ─────────────────────────────────────────────────────────────────────────────
export const askNexus = async (
  prompt: string,
  _context?: string,
  _useSearch: boolean = false
): Promise<string> => {
  const response = await api.post<{ data: { reply: string, messageId: string, role: string } }>('/api/ai/chat', { message: prompt });
  return response.data?.reply || "";
};

export const getChatHistory = async (): Promise<any[]> => {
  const response = await api.get<{ data: any[] }>('/api/ai/history');
  return response.data || [];
};

export const clearChatHistory = async (): Promise<void> => {
  await api.delete('/api/ai/history');
};

// ─────────────────────────────────────────────────────────────────────────────
// brainstormIdeas — used by Brainstormer.tsx
// ─────────────────────────────────────────────────────────────────────────────
export const brainstormIdeas = async (
  topic: string,
  _context?: string
): Promise<string> => {
  const response = await api.post<{ ideas: string }>('/api/brainstorm', { topic });
  return response.ideas || "";
};

// ─────────────────────────────────────────────────────────────────────────────
// analyzeDocument — used by DocumentAnalyzer.tsx
// Returns raw JSON string (caller does JSON.parse)
// ─────────────────────────────────────────────────────────────────────────────
export const analyzeDocument = async (
  text: string,
  _context?: string
): Promise<string> => {
  const response = await api.post<{ result: unknown }>('/api/analyze', { text });
  // Return as JSON string because DocumentAnalyzer.tsx calls JSON.parse() on the result
  return JSON.stringify(response.result);
};

// ─────────────────────────────────────────────────────────────────────────────
// generateTaskAnalysis — used by TaskBoard.tsx (AI Optimize button)
// ─────────────────────────────────────────────────────────────────────────────
export const generateTaskAnalysis = async (tasks: string): Promise<string> => {
  const response = await api.post<{ advice: string }>('/api/tasks/ai', {
    action: 'analyze',
    tasks,
  });
  return response.advice || "";
};

// ─────────────────────────────────────────────────────────────────────────────
// decomposeTask — used by TaskBoard.tsx (task decompose via custom event)
// ─────────────────────────────────────────────────────────────────────────────
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
