
export enum AppView {
  DASHBOARD = 'dashboard',
  LIVE_ASSISTANT = 'live',
  CHAT = 'chat',
  DOC_ANALYZER = 'docs',
  BRAINSTORMER = 'brainstorm',
  TASKS = 'tasks',
  KNOWLEDGE_BASE = 'knowledge'
}

export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  deadline?: string;
}

export interface BrainstormIdea {
  title: string;
  description: string;
  category: string;
}

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'research' | 'meeting';
  dateAdded: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: GroundingSource[];
}
