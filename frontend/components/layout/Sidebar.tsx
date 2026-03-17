import React, { useState } from 'react';
import { AppView } from '../../types';
import {
  LayoutDashboard,
  Mic,
  MessageSquare,
  FileText,
  Lightbulb,
  CheckSquare,
  Database,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  PenLine,
  Timer,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { NeuralAvatar } from '../ui/NeuralAvatar';

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useStore();

  const menuItems = [
    { id: AppView.DASHBOARD, label: 'Command Center', icon: LayoutDashboard },
    { id: AppView.LIVE_ASSISTANT, label: 'Live Assistant', icon: Mic },
    { id: AppView.CHAT, label: 'Neural Chat', icon: MessageSquare },
    { id: AppView.DOC_ANALYZER, label: 'Doc Analyzer', icon: FileText },
    { id: AppView.BRAINSTORMER, label: 'Brainstormer', icon: Lightbulb },
    { id: AppView.TASKS, label: 'Task Board', icon: CheckSquare },
    { id: AppView.KNOWLEDGE_BASE, label: 'Knowledge Base', icon: Database },
    { id: AppView.WRITING_STUDIO, label: 'Writing Studio', icon: PenLine },
    { id: AppView.FOCUS_TIMER, label: 'Focus Timer', icon: Timer },
    { id: AppView.GOALS, label: 'Goal Tracker', icon: Target },
  ];

  return (
    <motion.aside
      initial={{ width: 280 }}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
      className="h-screen bg-surface/50 backdrop-blur-xl border-r border-white/5 flex flex-col relative z-50 shadow-2xl"
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-9 z-50 p-1.5 rounded-full bg-surface border border-white/10 text-gray-400 hover:text-white hover:border-primary/50 transition-all duration-200 shadow-lg backdrop-blur-sm"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="p-6 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-primary to-blue-500 shadow-lg shadow-primary/30 flex items-center justify-center">
                <span className="font-bold text-white">N</span>
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">NexusAI</h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Enterprise OS</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-8 h-8 mx-auto rounded-lg bg-linear-to-tr from-primary to-blue-500 shadow-lg shadow-primary/30 flex items-center justify-center"
            >
              <span className="font-bold text-white">N</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className={`flex-1 px-4 py-6 space-y-2 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto custom-scrollbar'}`}>
        {menuItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${isActive
                ? 'bg-primary/10 text-white shadow-lg shadow-primary/10'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                } ${isCollapsed ? 'justify-center' : ''}`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                />
              )}
              <item.icon
                size={20}
                className={`relative z-10 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-primary'}`}
              />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className={`ml-4 text-sm font-medium relative z-10 ${isActive ? 'text-white' : ''}`}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-md text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-60 pointer-events-none border border-white/10 shadow-xl">
                  {item.label}
                  {/* Arrow for tooltip */}
                  <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-900/90" />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-4">
        {/* User Profile */}
        <div className={`w-full flex items-center p-2 rounded-xl bg-white/5 border border-white/5 ${isCollapsed ? 'justify-center' : ''} group relative`}>
          <NeuralAvatar state="idle" size="sm" className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate w-40">{user?.displayName || user?.email || 'Nexus User'}</div>
              <div className="text-[10px] text-emerald-400">Online</div>
            </div>
          )}
          {isCollapsed && (
            <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-md text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-60 pointer-events-none border border-white/10 shadow-xl">
              Profile
              <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-900/90" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <button
            onClick={() => onViewChange(AppView.SETTINGS)}
            className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${activeView === AppView.SETTINGS
              ? 'bg-primary/10 text-white shadow-lg shadow-primary/10'
              : 'hover:bg-white/5 text-gray-400 hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
          >
            {activeView === AppView.SETTINGS && (
              <motion.div
                layoutId="activeTabBottom"
                className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
              />
            )}
            <Settings size={20} className={`relative z-10 transition-colors ${activeView === AppView.SETTINGS ? 'text-primary' : 'group-hover:text-primary'}`} />
            {!isCollapsed && <span className={`ml-4 text-sm font-medium relative z-10 ${activeView === AppView.SETTINGS ? 'text-white' : ''}`}>Settings</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-md text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-60 pointer-events-none border border-white/10 shadow-xl">
                Settings
                <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-900/90" />
              </div>
            )}
          </button>
          <button
            onClick={logout}
            className={`w-full flex items-center p-3 rounded-xl hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors ${isCollapsed ? 'justify-center' : ''} group relative`}
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="ml-4 text-sm font-medium">Logout</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-md text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-60 pointer-events-none border border-white/10 shadow-xl">
                Logout
                <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-900/90" />
              </div>
            )}
          </button>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
