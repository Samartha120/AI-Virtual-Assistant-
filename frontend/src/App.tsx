
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

const App: React.FC = () => {
  const { currentView, setCurrentView } = useStore();

  const renderView = () => {
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
      case AppView.SETTINGS:
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Shell>
      {renderView()}
    </Shell>
  );
};

export default App;
