const { FieldValue } = require('firebase-admin/firestore');
const { adminDb } = require('../config/firebaseAdmin');

// Collections (keep names close to the legacy SQL tables)
const COL = {
  CHAT: 'chat_messages',
  TASKS: 'tasks',
  KNOWLEDGE: 'knowledge_base',
  SETTINGS: 'settings',
  AI_INTERACTIONS: 'ai_interactions',
};

function truncateText(value, maxChars) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (!maxChars || s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}…`;
}

/**
 * Logs AI module outputs in Firestore.
 * Uses Admin SDK (bypasses client security rules), so it can persist even when
 * client-side logging fails.
 */
async function saveAIInteraction({
  userId = null,
  module,
  prompt,
  response,
  provider = null,
  notice = null,
  endpoint = null,
  meta = null,
}) {
  if (!adminDb) {
    console.warn('[Firestore] adminDb not initialized. Skipping AI interaction log.');
    return null;
  }

  const safeModule = String(module || 'AI');
  const promptText = truncateText(prompt, 20000);
  const responseText = truncateText(response, 20000);

  return adminDb.collection(COL.AI_INTERACTIONS).add({
    userId: userId ? String(userId) : null,
    module: safeModule,
    prompt: promptText,
    response: responseText,
    content: responseText,
    provider: provider ? String(provider) : null,
    notice: notice ? String(notice) : null,
    endpoint: endpoint ? String(endpoint) : null,
    meta: meta && typeof meta === 'object' ? meta : null,
    createdAt: FieldValue.serverTimestamp(),
    source: 'backend',
  });
}

function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function getCount(queryRef) {
  // Prefer Firestore aggregation query if available
  if (typeof queryRef.count === 'function') {
    const snap = await queryRef.count().get();
    return snap.data().count || 0;
  }
  const snap = await queryRef.get();
  return snap.size;
}

function toMillis(ts) {
  if (!ts) return 0;
  try {
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

// ─── AI Sessions & Messages ──────────────────────────────────────

async function createAiSession(userId, module, title = 'New Conversation') {
  if (!userId || !module) throw new Error('userId and module are required to create a session');
  const userRef = adminDb.collection('users').doc(String(userId));
  const sessionRef = userRef.collection('ai_sessions').doc(); // Auto-ID

  // Ensure the user doc exists for easier browsing and consistency.
  await userRef.set(
    {
      user_id: String(userId),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const sessionData = {
    module: String(module),
    title: String(title),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    hasAssistant: false,
  };

  await sessionRef.set(sessionData);
  const saved = await sessionRef.get();
  return { id: saved.id, ...saved.data() };
}

/**
 * Persist a single chat turn (user + assistant) atomically.
 * - Creates a new session if sessionId is not provided
 * - Writes both messages and updates session metadata in a single Firestore batch
 * - Also syncs legacy chat_messages and ai_interactions in the same batch
 */
async function persistChatTurn({
  userId,
  module,
  sessionId = null,
  title = null,
  userMessage,
  assistantMessage,
  provider = null,
  notice = null,
  inputType = 'text',
  endpoint = null,
  meta = null,
}) {
  if (!adminDb) {
    console.warn('[Firestore] adminDb not initialized. Skipping chat persistence.');
    return null;
  }
  if (!userId) throw new Error('userId is required');
  if (!module) throw new Error('module is required');
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
    throw new Error('userMessage must be a non-empty string');
  }
  if (!assistantMessage || typeof assistantMessage !== 'string' || assistantMessage.trim() === '') {
    throw new Error('assistantMessage must be a non-empty string');
  }

  const userIdStr = String(userId);
  const userRef = adminDb.collection('users').doc(userIdStr);
  const sessionRef = sessionId
    ? userRef.collection('ai_sessions').doc(String(sessionId))
    : userRef.collection('ai_sessions').doc();

  const newSessionId = sessionRef.id;
  const batch = adminDb.batch();

  // Ensure user doc exists (helps browsing + consistency)
  batch.set(
    userRef,
    {
      user_id: userIdStr,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const sessionUpdate = {
    module: String(module),
    updatedAt: FieldValue.serverTimestamp(),
    hasAssistant: true,
    lastPrompt: truncateText(userMessage.trim(), 200),
    lastResponse: truncateText(assistantMessage.trim(), 200),
    lastProvider: provider ? String(provider) : null,
  };

  if (!sessionId) {
    sessionUpdate.createdAt = FieldValue.serverTimestamp();
    sessionUpdate.title = title ? String(title) : 'New Conversation';
  } else if (title) {
    // Allow explicit title update only if caller provides one.
    sessionUpdate.title = String(title);
  }

  batch.set(sessionRef, sessionUpdate, { merge: true });

  const messagesRef = sessionRef.collection('messages');
  const userMsgRef = messagesRef.doc();
  const assistantMsgRef = messagesRef.doc();

  batch.set(userMsgRef, {
    role: 'user',
    content: userMessage.trim(),
    inputType: inputType === 'voice' ? 'voice' : 'text',
    createdAt: FieldValue.serverTimestamp(),
  });

  batch.set(assistantMsgRef, {
    role: 'assistant',
    content: assistantMessage.trim(),
    inputType: 'text',
    provider: provider ? String(provider) : null,
    notice: notice ? String(notice) : null,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Legacy chat_messages sync (Command Center)
  const legacyUserRef = adminDb.collection(COL.CHAT).doc();
  const legacyAssistantRef = adminDb.collection(COL.CHAT).doc();

  batch.set(legacyUserRef, {
    user_id: userIdStr,
    role: 'user',
    content: userMessage.trim(),
    module: String(module),
    session_id: String(newSessionId),
    created_at: FieldValue.serverTimestamp(),
  });

  batch.set(legacyAssistantRef, {
    user_id: userIdStr,
    role: 'assistant',
    content: assistantMessage.trim(),
    module: String(module),
    session_id: String(newSessionId),
    created_at: FieldValue.serverTimestamp(),
  });

  // ai_interactions log (module outputs)
  const interactionRef = adminDb.collection(COL.AI_INTERACTIONS).doc();
  batch.set(interactionRef, {
    userId: userIdStr,
    module: String(module || 'AI'),
    prompt: truncateText(userMessage.trim(), 20000),
    response: truncateText(assistantMessage.trim(), 20000),
    content: truncateText(assistantMessage.trim(), 20000),
    provider: provider ? String(provider) : null,
    notice: notice ? String(notice) : null,
    endpoint: endpoint ? String(endpoint) : null,
    meta: meta && typeof meta === 'object' ? meta : null,
    createdAt: FieldValue.serverTimestamp(),
    source: 'backend',
  });

  await batch.commit();
  return {
    sessionId: newSessionId,
    userMessageId: userMsgRef.id,
    assistantMessageId: assistantMsgRef.id,
  };
}

async function getAiSessions(userId, moduleName = null) {
  if (!userId) return [];
  
  const baseRef = adminDb
    .collection('users')
    .doc(String(userId))
    .collection('ai_sessions');

  const mapDocs = (snap) => {
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      };
    });
  };

  const sortByUpdatedDesc = (arr) => {
    arr.sort((a, b) => {
      const aTime = toMillis(a.updatedAt);
      const bTime = toMillis(b.updatedAt);
      return bTime - aTime;
    });
    return arr;
  };

  // Filter out sessions that never successfully saved an assistant response.
  // For older sessions missing `hasAssistant`, probe the messages subcollection.
  const filterHasAssistant = async (sessions) => {
    const withFlag = sessions.filter((s) => s.hasAssistant === true);
    const missingFlag = sessions.filter((s) => s.hasAssistant === undefined || s.hasAssistant === null);

    if (missingFlag.length === 0) return withFlag;

    const checks = await Promise.all(
      missingFlag.map(async (s) => {
        try {
          const msgSnap = await baseRef
            .doc(String(s.id))
            .collection('messages')
            .where('role', '==', 'assistant')
            .limit(1)
            .get();
          const has = !msgSnap.empty;
          // Best-effort backfill so future reads are cheap.
          baseRef
            .doc(String(s.id))
            .set({ hasAssistant: has }, { merge: true })
            .catch(() => undefined);
          return has ? { ...s, hasAssistant: true } : null;
        } catch {
          return null;
        }
      })
    );

    const backfilled = checks.filter(Boolean);
    return sortByUpdatedDesc([...withFlag, ...backfilled]);
  };

  if (moduleName) {
    // NOTE: Avoid requiring a composite index for
    // where('module'=='x') + orderBy('updatedAt') by sorting in memory.
    try {
      const snap = await baseRef.where('module', '==', String(moduleName)).limit(50).get();
      const sessions = sortByUpdatedDesc(mapDocs(snap));
      return filterHasAssistant(sessions);
    } catch (err) {
      console.warn('[Firestore] getAiSessions primary query failed, falling back:', err?.message || err);
      const snap = await baseRef.orderBy('updatedAt', 'desc').limit(50).get();
      const all = mapDocs(snap);
      const filtered = all.filter((s) => String(s.module || '') === String(moduleName));
      const sessions = sortByUpdatedDesc(filtered);
      return filterHasAssistant(sessions);
    }
  }

  const snap = await baseRef.orderBy('updatedAt', 'desc').limit(50).get();
  const sessions = mapDocs(snap);
  return filterHasAssistant(sessions);
}

async function getSessionMessages(userId, sessionId, limit = 50) {
  if (!userId || !sessionId) return [];
  
  const snap = await adminDb
    .collection('users')
    .doc(String(userId))
    .collection('ai_sessions')
    .doc(String(sessionId))
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
    };
  });
}

async function saveSessionMessage(userId, sessionId, role, content, inputType = 'text') {
  if (!userId || !sessionId) throw new Error('userId and sessionId are required');
  
  const sessionRef = adminDb
    .collection('users')
    .doc(String(userId))
    .collection('ai_sessions')
    .doc(String(sessionId));

  const messagesRef = sessionRef.collection('messages');
  
  const messageData = {
    role,
    content,
    inputType,
    createdAt: FieldValue.serverTimestamp(),
  };

  const docRef = await messagesRef.add(messageData);
  
  // Also update session's updatedAt timestamp
  await sessionRef.update({
    updatedAt: FieldValue.serverTimestamp()
  });

  const saved = await docRef.get();
  return { id: docRef.id, ...saved.data() };
}

// ─── Legacy Chat Messages (Deprecated, but keep for fallback) ───
// NOTE: Command Center stats currently depend on this collection.
// Keep it in sync with the newer ai_sessions/messages storage.
const saveChatMessage = async (userId, role, content, module = null, sessionId = null) => {
  const docRef = await adminDb.collection(COL.CHAT).add({
    user_id: userId,
    role,
    content,
    module: module ? String(module) : null,
    session_id: sessionId ? String(sessionId) : null,
    created_at: FieldValue.serverTimestamp(),
  });

  const saved = await docRef.get();
  return { id: docRef.id, ...saved.data() };
};

const getChatHistory = async (userId, limit = 50) => {
  const snap = await adminDb
    .collection(COL.CHAT)
    .where('user_id', '==', userId)
    .orderBy('created_at', 'asc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
    };
  });
};

const clearChatHistory = async (userId) => {
  const snap = await adminDb.collection(COL.CHAT).where('user_id', '==', userId).get();
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

// ─── Settings ──────────────────────────────────────────────────

const getUserSettings = async (userId) => {
  const doc = await adminDb.collection(COL.SETTINGS).doc(userId).get();
  return doc.exists ? { id: doc.id, user_id: userId, ...doc.data() } : null;
};

const updateUserSettings = async (userId, settings) => {
  const ref = adminDb.collection(COL.SETTINGS).doc(userId);
  await ref.set(
    {
      ...settings,
      user_id: userId,
      updated_at: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const saved = await ref.get();
  return { id: saved.id, ...saved.data() };
};

// ─── Tasks ─────────────────────────────────────────────────────

const getUserTasks = async (userId) => {
  const snap = await adminDb
    .collection(COL.TASKS)
    .where('user_id', '==', userId)
    .orderBy('created_at', 'desc')
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
    };
  });
};

const createTask = async (userId, taskData) => {
  const docRef = await adminDb.collection(COL.TASKS).add({
    user_id: userId,
    title: taskData.title,
    description: taskData.description || '',
    status: taskData.status || 'todo',
    priority: taskData.priority || 'medium',
    due_date: toIsoDate(taskData.due_date),
    created_at: FieldValue.serverTimestamp(),
  });

  const saved = await docRef.get();
  return { id: docRef.id, ...saved.data() };
};

const updateTask = async (taskId, userId, taskData) => {
  const ref = adminDb.collection(COL.TASKS).doc(taskId);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const data = existing.data();
  if (data?.user_id !== userId) return null;

  await ref.set(
    {
      ...taskData,
      due_date: taskData.due_date !== undefined ? toIsoDate(taskData.due_date) : undefined,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const saved = await ref.get();
  return { id: saved.id, ...saved.data() };
};

const deleteTask = async (taskId, userId) => {
  const ref = adminDb.collection(COL.TASKS).doc(taskId);
  const existing = await ref.get();
  if (!existing.exists) return;

  const data = existing.data();
  if (data?.user_id !== userId) return;

  await ref.delete();
};

// ─── Knowledge Base ────────────────────────────────────────────

const getKnowledgeItems = async (userId) => {
  const snap = await adminDb
    .collection(COL.KNOWLEDGE)
    .where('user_id', '==', userId)
    .orderBy('created_at', 'desc')
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
    };
  });
};

const createKnowledgeItem = async (userId, itemData) => {
  const docRef = await adminDb.collection(COL.KNOWLEDGE).add({
    user_id: userId,
    title: itemData.title,
    content: itemData.content,
    type: itemData.type || 'text',
    tags: itemData.tags || [],
    file_url: itemData.file_url || null,
    created_at: FieldValue.serverTimestamp(),
  });

  const saved = await docRef.get();
  return { id: docRef.id, ...saved.data() };
};

const deleteKnowledgeItem = async (itemId, userId) => {
  const ref = adminDb.collection(COL.KNOWLEDGE).doc(itemId);
  const existing = await ref.get();
  if (!existing.exists) return;

  const data = existing.data();
  if (data?.user_id !== userId) return;

  await ref.delete();
};

module.exports = {
  COL,
  getCount,
  saveAIInteraction,
  createAiSession,
  getAiSessions,
  getSessionMessages,
  persistChatTurn,
  saveSessionMessage,
  saveChatMessage,
  getChatHistory,
  clearChatHistory,
  getUserSettings,
  updateUserSettings,
  getUserTasks,
  createTask,
  updateTask,
  deleteTask,
  getKnowledgeItems,
  createKnowledgeItem,
  deleteKnowledgeItem,
};
