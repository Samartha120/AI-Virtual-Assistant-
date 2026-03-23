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

// ─── AI Sessions & Messages ──────────────────────────────────────

async function createAiSession(userId, module, title = 'New Conversation') {
  if (!userId || !module) throw new Error('userId and module are required to create a session');
  const userRef = adminDb.collection('users').doc(String(userId));
  const sessionRef = userRef.collection('ai_sessions').doc(); // Auto-ID

  const sessionData = {
    module: String(module),
    title: String(title),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await sessionRef.set(sessionData);
  const saved = await sessionRef.get();
  return { id: saved.id, ...saved.data() };
}

async function getAiSessions(userId, moduleName = null) {
  if (!userId) return [];
  
  let query = adminDb
    .collection('users')
    .doc(String(userId))
    .collection('ai_sessions');

  if (moduleName) {
    query = query.where('module', '==', String(moduleName));
  }

  query = query.orderBy('updatedAt', 'desc').limit(50);
  
  const snap = await query.get();
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    };
  });
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
const saveChatMessage = async (userId, role, content) => {
  const docRef = await adminDb.collection(COL.CHAT).add({
    user_id: userId,
    role,
    content,
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
