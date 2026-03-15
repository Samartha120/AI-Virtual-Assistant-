
import * as React from 'react';
import { AppView } from './types';
import Shell from './components/layout/Shell';
import { useStore } from './store/useStore';
import Dashboard from './features/dashboard/Dashboard';
import LiveAssistant from './features/dashboard/LiveAssistant';
import DocumentAnalyzer from './features/documents/DocumentAnalyzer';
import Brainstormer from './features/brainstormer/Brainstormer';
import TaskBoard from './features/tasks/TaskBoard';
import KnowledgeBase from './features/knowledge/KnowledgeBase';
import ChatInterface from './features/chat/ChatInterface';
import SettingsPage from './features/settings/SettingsPage';
import AuthPage from './features/auth/AuthPage';
import WritingStudio from './features/writing/WritingStudio';
import FocusTimer from './features/focus/FocusTimer';
import GoalTracker from './features/goals/GoalTracker';
import VerifyEmailPage from './pages/auth/verify-email';

const App: React.FC = () => {
  const { currentView, isAuthenticated, isVerified, requireVerification, initAuthListener } = useStore();

  React.useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => unsubscribe();
  }, [initAuthListener]);

  const renderView = () => {
    console.log("App renderView executing. currentView is:", currentView);
    if (currentView === AppView.SETTINGS) {
      console.log("Rendering SettingsPage!");
    }
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard />;
      case AppView.LIVE_ASSISTANT:
        return <LiveAssistant />;
      case AppView.CHAT:
        return <ChatInterface />;
      case AppView.DOC_ANALYZER:
        return <DocumentAnalyzer />;
      case AppView.BRAINSTORMER:
        return <Brainstormer />;
      case AppView.TASKS:
        return <TaskBoard />;
      case AppView.KNOWLEDGE_BASE:
        return <KnowledgeBase />;
      case AppView.WRITING_STUDIO:
        return <WritingStudio />;
      case AppView.FOCUS_TIMER:
        return <FocusTimer />;
      case AppView.GOALS:
        return <GoalTracker />;
      case AppView.SETTINGS:
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  if (requireVerification && !isVerified) {
    return <VerifyEmailPage />;
  }

  return (
    <Shell>
      {renderView()}
    </Shell>
  );
};

export default App;
