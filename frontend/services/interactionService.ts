import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebaseClient';
import { api } from '../src/services/apiClient';

/**
 * Saves an AI interaction to Firestore in the 'ai_interactions' collection.
 * This is designed to be a fire-and-forget operation to not affect UI performance.
 * 
 * @param module - The name of the AI module (e.g., 'Neural Chat', 'Doc Analyzer')
 * @param prompt - The user's input prompt
 * @param response - The AI's generated response
 */
export async function saveAIInteraction(module: string, prompt: string, response: string) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn(`[Firestore] No user logged in. Skipping interaction log for ${module}.`);
      return;
    }

    // Return the promise so callers can await it if they need persistence guarantee
    return await addDoc(collection(db, 'ai_interactions'), {
      userId: user.uid,
      module,
      prompt,
      response,
      createdAt: serverTimestamp(),
    });
    
  } catch (err) {
    console.error(`[Firestore Error] saveAIInteraction failed for ${module}:`, err);
    throw err;
  }
}

export type SystemLogType = 'auth' | 'api' | 'module' | 'ai';

export async function logSystemEvent(event: {
  type: SystemLogType;
  action: string;
  module?: string;
  provider?: string;
  description?: string;
  errorCode?: string;
  errorMessage?: string;
}) {
  // Fire-and-forget: do not block UI.
  try {
    const payload = {
      ...event,
      clientTimestamp: Date.now(),
    };

    api.post('/system-logs', payload).catch(() => undefined);
  } catch {
    // ignore
  }
}
