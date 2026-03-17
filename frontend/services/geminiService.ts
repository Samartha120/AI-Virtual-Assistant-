/// <reference types="vite/client" />
/**
 * geminiService.ts (frontend/services — legacy location)
 * Legacy compatibility shim.
 *
 * Gemini/Google AI has been fully removed.
 * We keep this filename so any existing imports via '../../services/geminiService'
 * continue to work, but all calls are proxied to the backend Grok integration.
 */
export {
  askNexus,
  brainstormIdeas,
  analyzeDocument,
  generateTaskAnalysis,
  decomposeTask,
  getChatHistory,
  clearChatHistory,
  askNexusStream,
} from './grokService';
