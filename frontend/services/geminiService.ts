/// <reference types="vite/client" />
/**
 * geminiService.ts (frontend/services — legacy location)
 * Re-exports from the canonical src/services/geminiService.ts
 * so any imports via '../../services/geminiService' still work.
 */
export {
  askNexus,
  brainstormIdeas,
  analyzeDocument,
  generateTaskAnalysis,
  decomposeTask,
  getChatHistory,
  clearChatHistory,
} from '../src/services/geminiService';
