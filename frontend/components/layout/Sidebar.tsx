/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const menuItems: NavItem[] = [
  { path: '/dashboard',      label: 'Command Center',  icon: LayoutDashboard },
  { path: '/live-assistant', label: 'Live Assistant',  icon: Mic },
  { path: '/neural-chat',    label: 'Neural Chat',     icon: MessageSquare },
  { path: '/doc-analyzer',   label: 'Doc Analyzer',    icon: FileText },
  { path: '/brainstormer',   label: 'Brainstormer',    icon: Lightbulb },
  { path: '/task-board',     label: 'Task Board',      icon: CheckSquare },
  { path: '/knowledge-base', label: 'Knowledge Base',  icon: Database },
  { path: '/writing-studio', label: 'Writing Studio',  icon: PenLine },
  { path: '/focus-timer',    label: 'Focus Timer',     icon: Timer },
  { path: '/goal-tracker',   label: 'Goal Tracker',    icon: Target },
];

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <motion.aside
      initial={{ width: 280 }}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
      className="h-screen bg-sidebar-bg border-r border-border flex flex-col relative z-50"
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-9 z-50 p-1.5 rounded-full bg-surface border border-border text-text-tertiary hover:text-text-primary hover:border-primary/50 transition-all duration-200 shadow-sm backdrop-blur-sm"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="p-6 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-primary to-blue-500 shadow-md shadow-primary/20 flex items-center justify-center">
                <span className="font-bold text-white">N</span>
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight text-text-primary">NexusAI</h1>
                <p className="text-[10px] text-text-tertiary uppercase tracking-widest">Enterprise OS</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
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
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${isActive
                ? 'bg-primary/10 text-text-primary border border-primary/10'
                : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
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
                    className={`ml-4 text-sm font-medium relative z-10 ${isActive ? 'text-text-primary' : ''}`}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-md text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-60 pointer-events-none border border-white/10 shadow-xl">
                  {item.label}
                  <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-900/90" />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-4">
        {/* User Profile */}
        <div className={`w-full flex items-center p-2 rounded-xl bg-surface-muted border border-border ${isCollapsed ? 'justify-center' : ''} group relative`}>
          <NeuralAvatar state="idle" size="sm" className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-text-primary truncate w-32">{user?.displayName || user?.email || 'Nexus User'}</div>
              <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online</div>
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
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative ${pathname === '/settings'
              ? 'bg-primary/10 text-text-primary border border-primary/10 shadow-sm'
              : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
              } ${isCollapsed ? 'justify-center' : ''}`}
          >
            {pathname === '/settings' && (
              <motion.div
                layoutId="activeTabBottom"
                className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
              />
            )}
            <Settings size={20} className={`relative z-10 transition-colors ${pathname === '/settings' ? 'text-primary' : 'group-hover:text-primary'}`} />
            {!isCollapsed && <span className={`ml-4 text-sm font-medium relative z-10 ${pathname === '/settings' ? 'text-text-primary' : ''}`}>Settings</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900/90 backdrop-blur-md text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-60 pointer-events-none border border-white/10 shadow-xl">
                Settings
                <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-900/90" />
              </div>
            )}
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className={`w-full flex items-center p-3 rounded-xl hover:bg-red-500/10 text-text-tertiary hover:text-red-500 transition-all duration-200 ${isCollapsed ? 'justify-center' : ''} group relative`}
          >
            <LogOut size={20} className="relative z-10" />
            {!isCollapsed && <span className="ml-4 text-sm font-medium relative z-10">Logout</span>}
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
