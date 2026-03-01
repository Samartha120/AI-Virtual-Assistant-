
import { Task, KnowledgeItem, BrainstormIdea } from '../types';

const STORAGE_KEYS = {
  TASKS: 'nexus_tasks',
  KNOWLEDGE: 'nexus_knowledge',
  IDEAS: 'nexus_ideas'
};

export const storage = {
  getTasks: (): Task[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]'),
  saveTasks: (tasks: Task[]) => localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks)),

  getKnowledge: (): KnowledgeItem[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.KNOWLEDGE) || '[]'),
  saveKnowledge: (items: KnowledgeItem[]) => localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(items)),

  getIdeas: (): BrainstormIdea[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.IDEAS) || '[]'),
  saveIdeas: (ideas: BrainstormIdea[]) => localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(ideas)),
};
