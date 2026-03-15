import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebaseClient';
import type { KnowledgeItem, Task } from '../types';

function requireUserId(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTasks(): Promise<Task[]> {
  const uid = requireUserId();
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const q = query(tasksRef, orderBy('order', 'asc'));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      title: data.title,
      status: data.status,
      priority: data.priority,
      deadline: data.deadline,
      order: data.order,
    } satisfies Task;
  });
}

export async function createTask(task: Omit<Task, 'id'>): Promise<Task> {
  const uid = requireUserId();
  const tasksRef = collection(db, 'users', uid, 'tasks');

  const created = await addDoc(tasksRef, {
    title: task.title,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline ?? null,
    order: typeof task.order === 'number' ? task.order : Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { ...task, id: created.id };
}

export async function updateTask(taskId: string, updates: Partial<Omit<Task, 'id'>>): Promise<void> {
  const uid = requireUserId();
  const ref = doc(db, 'users', uid, 'tasks', taskId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  } as any);
}

export async function deleteTask(taskId: string): Promise<void> {
  const uid = requireUserId();
  const ref = doc(db, 'users', uid, 'tasks', taskId);
  await deleteDoc(ref);
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchKnowledgeItems(): Promise<KnowledgeItem[]> {
  const uid = requireUserId();
  const kbRef = collection(db, 'users', uid, 'knowledge_base');
  const q = query(kbRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    const createdAt: Date | null = data.createdAt?.toDate ? data.createdAt.toDate() : null;

    return {
      id: d.id,
      title: data.title,
      content: data.content,
      type: data.type,
      dateAdded: createdAt ? createdAt.toLocaleDateString() : new Date().toLocaleDateString(),
    } satisfies KnowledgeItem;
  });
}

export async function createKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'dateAdded'>): Promise<KnowledgeItem> {
  const uid = requireUserId();
  const kbRef = collection(db, 'users', uid, 'knowledge_base');

  const created = await addDoc(kbRef, {
    title: item.title,
    content: item.content,
    type: item.type,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: created.id,
    title: item.title,
    content: item.content,
    type: item.type,
    dateAdded: new Date().toLocaleDateString(),
  };
}

export async function deleteKnowledgeItem(itemId: string): Promise<void> {
  const uid = requireUserId();
  const ref = doc(db, 'users', uid, 'knowledge_base', itemId);
  await deleteDoc(ref);
}
