const { FieldValue } = require('firebase-admin/firestore');
const { adminDb } = require('../config/firebaseAdmin');

// Collections (keep names close to the legacy SQL tables)
const COL = {
  CHAT: 'chat_messages',
  TASKS: 'tasks',
  KNOWLEDGE: 'knowledge_base',
  SETTINGS: 'settings',
};

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

// ─── Chat Messages ──────────────────────────────────────────────

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
