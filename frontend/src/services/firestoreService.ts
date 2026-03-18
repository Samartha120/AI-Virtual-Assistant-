import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseClient';
import type { KnowledgeItem } from '../types';

export type GoalCategory = 'work' | 'personal' | 'health' | 'learning';

export interface GoalKeyResultTask {
  id: string;
  title: string;
  done: boolean;
}

export interface GoalKeyResult {
  id: string;
  title: string;
  progress: number; // 0-100
  tasks?: GoalKeyResultTask[];
}

export interface GoalRecord {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  deadline: string;
  keyResults: GoalKeyResult[];
  archived: boolean;
}

function requireUserId(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

export async function fetchGoals(): Promise<GoalRecord[]> {
  const uid = requireUserId();
  const goalsRef = collection(db, 'users', uid, 'goals');
  const q = query(goalsRef, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    const keyResults = Array.isArray(data.keyResults) ? data.keyResults : [];

    return {
      id: d.id,
      title: String(data.title ?? ''),
      description: String(data.description ?? ''),
      category: (data.category ?? 'work') as GoalCategory,
      deadline: String(data.deadline ?? ''),
      keyResults: keyResults
        .filter((k: any) => k && typeof k === 'object')
        .map((k: any) => ({
          id: String(k.id ?? ''),
          title: String(k.title ?? ''),
          progress: Number(k.progress ?? 0),
          tasks: Array.isArray(k.tasks)
            ? k.tasks
                .filter((t: any) => t && typeof t === 'object')
                .map((t: any) => ({
                  id: String(t.id ?? ''),
                  title: String(t.title ?? ''),
                  done: Boolean(t.done),
                }))
                .filter((t: GoalKeyResultTask) => t.id && t.title)
            : [],
        }))
        .filter((k: GoalKeyResult) => k.id && k.title),
      archived: Boolean(data.archived),
    } satisfies GoalRecord;
  });
}

export async function createGoal(goal: GoalRecord): Promise<void> {
  const uid = requireUserId();
  const ref = doc(db, 'users', uid, 'goals', goal.id);

  await setDoc(ref, {
    title: goal.title,
    description: goal.description,
    category: goal.category,
    deadline: goal.deadline || '',
    keyResults: goal.keyResults,
    archived: Boolean(goal.archived),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateGoal(goalId: string, updates: Partial<Omit<GoalRecord, 'id'>>): Promise<void> {
  const uid = requireUserId();
  const ref = doc(db, 'users', uid, 'goals', goalId);

  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  } as any);
}

export async function deleteGoal(goalId: string): Promise<void> {
  const uid = requireUserId();
  const ref = doc(db, 'users', uid, 'goals', goalId);
  await deleteDoc(ref);
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base (users/{uid}/knowledge_base)
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
      title: String(data.title ?? ''),
      content: String(data.content ?? ''),
      type: (data.type ?? 'text') as any,
      dateAdded: createdAt ? createdAt.toLocaleDateString() : new Date().toLocaleDateString(),
    } satisfies KnowledgeItem;
  });
}

export async function createKnowledgeItem(
  item: Omit<KnowledgeItem, 'id' | 'dateAdded'>
): Promise<KnowledgeItem> {
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
  } satisfies KnowledgeItem;
}

export async function deleteKnowledgeItem(itemId: string): Promise<void> {
  const uid = requireUserId();
  const ref = doc(db, 'users', uid, 'knowledge_base', itemId);
  await deleteDoc(ref);
}
