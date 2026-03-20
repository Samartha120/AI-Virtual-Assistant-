import * as React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/layout/Shell';

import AuthPage from './features/auth/AuthPage';
import Dashboard from './features/dashboard/Dashboard';
import LiveAssistant from './features/dashboard/LiveAssistant';
import ChatInterface from './features/chat/ChatInterface';
import DocumentAnalyzer from './features/documents/DocumentAnalyzer';
import Brainstormer from './features/brainstormer/Brainstormer';
import TaskBoard from './features/tasks/TaskBoard';
import KnowledgeBase from './features/knowledge/KnowledgeBase';
import WritingStudio from './features/writing/WritingStudio';
import FocusTimer from './features/focus/FocusTimer';
import GoalTracker from './features/goals/GoalTracker';
import SettingsPage from './features/settings/SettingsPage';

import VerifyEmailPage from './pages/auth/verify-email';
import NotFoundPage from './pages/NotFoundPage';

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Shell>{children}</Shell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<AuthPage defaultMode="login" />} />
      <Route path="/signup" element={<AuthPage defaultMode="signup" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route path="/dashboard" element={<DashboardShell><Dashboard /></DashboardShell>} />
      <Route path="/live-assistant" element={<DashboardShell><LiveAssistant /></DashboardShell>} />
      <Route path="/neural-chat" element={<DashboardShell><ChatInterface /></DashboardShell>} />
      <Route path="/doc-analyzer" element={<DashboardShell><DocumentAnalyzer /></DashboardShell>} />
      <Route path="/brainstormer" element={<DashboardShell><Brainstormer /></DashboardShell>} />
      <Route path="/task-board" element={<DashboardShell><TaskBoard /></DashboardShell>} />
      <Route path="/knowledge-base" element={<DashboardShell><KnowledgeBase /></DashboardShell>} />
      <Route path="/writing-studio" element={<DashboardShell><WritingStudio /></DashboardShell>} />
      <Route path="/focus-timer" element={<DashboardShell><FocusTimer /></DashboardShell>} />
      <Route path="/goal-tracker" element={<DashboardShell><GoalTracker /></DashboardShell>} />
      <Route path="/settings" element={<DashboardShell><SettingsPage /></DashboardShell>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
