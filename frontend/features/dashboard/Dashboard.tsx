/* eslint-disable react/no-unescaped-entities */
'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Brain,
  CheckCircle,
  Database,
  MessageSquare,
  FileText,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { dashboardService } from '../../src/services/dashboardService';
import { ApiError } from '../../services/apiClient';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    tasksPending: 0,
    chatMessages: 0,
    knowledgeDocs: 0,
    ideasGenerated: 12
  });

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const resp = await dashboardService.getStats();
        if (resp && resp.data && resp.data.stats) {
          setStats({
            tasksPending: resp.data.stats.totalTasks || 0,
            chatMessages: resp.data.stats.totalMessages || 0,
            knowledgeDocs: resp.data.stats.totalKnowledgeItems || 0,
            ideasGenerated: 12
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return;
        console.error("Failed to fetch backend stats:", error);
      }
    };
    fetchDashboardStats();
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <header className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="heading-xl text-text-primary mb-2"
          >
            Command Center
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary"
          >
            NexusAI Enterprise OS connected.
          </motion.p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Nexus-2.0-Flash Protected
          </div>
        </div>
      </header>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Real Stats Row */}
        <Card className="p-5 flex items-center justify-between group hover:border-primary/20 transition-all duration-200">
          <div>
            <p className="caption uppercase tracking-wider mb-1">Knowledge Base</p>
            <h3 className="heading-md text-text-primary group-hover:text-primary transition-colors">{stats.knowledgeDocs} Docs</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
            <Database size={20} />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between group hover:border-emerald-500/20 transition-all duration-200">
          <div>
            <p className="caption uppercase tracking-wider mb-1">Active Tasks</p>
            <h3 className="heading-md text-text-primary group-hover:text-emerald-400 transition-colors">{stats.tasksPending} Pending</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <CheckCircle size={20} />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between group hover:border-blue-500/20 transition-all duration-200">
          <div>
            <p className="caption uppercase tracking-wider mb-1">Neural Chats</p>
            <h3 className="heading-md text-text-primary group-hover:text-blue-400 transition-colors">{stats.chatMessages} Messages</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
            <MessageSquare size={20} />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between group hover:border-amber-500/20 transition-all duration-200">
          <div>
            <p className="caption uppercase tracking-wider mb-1">AI Model</p>
            <h3 className="heading-md text-text-primary group-hover:text-amber-400 transition-colors">Nexus 2.0</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
            <Brain size={20} />
          </div>
        </Card>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div variants={item} onClick={() => navigate('/history/neural_chat')} className="cursor-pointer">
              <Card hoverEffect className="h-full flex flex-col justify-between min-h-[160px] bg-linear-to-br from-surface to-background">
                <div className="p-2 w-fit rounded-lg bg-primary/20 text-primary mb-4">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Neural Chat</h3>
                  <p className="text-sm text-gray-400">Collaborate with Nexus AI 2.0.</p>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={item} onClick={() => navigate('/history/doc_analyzer')} className="cursor-pointer">
              <Card hoverEffect className="h-full flex flex-col justify-between min-h-[160px] bg-linear-to-br from-surface to-background">
                <div className="p-2 w-fit rounded-lg bg-blue-500/20 text-blue-400 mb-4">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Doc Analyzer</h3>
                  <p className="text-sm text-gray-400">Extract insights from complex data.</p>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={item} onClick={() => navigate('/history/brainstormer')} className="cursor-pointer">
              <Card hoverEffect className="h-full flex flex-col justify-between min-h-[160px] bg-linear-to-br from-surface to-background">
                <div className="p-2 w-fit rounded-lg bg-amber-500/20 text-amber-400 mb-4">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Brainstormer</h3>
                  <p className="text-sm text-gray-400">Generate innovative ideas instantly.</p>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Recent Systems Log - Simulated */}
          <motion.div variants={item} className="mt-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              System Logs
            </h3>
            <Card className="overflow-hidden">
              <div className="divide-y divide-white/5">
                {[
                  { event: 'System initialization complete', time: '14:42:01', type: 'info' },
                  { event: 'Neural engine connected to Grok API', time: '14:41:55', type: 'success' },
                  { event: 'Database synchronization finished', time: '14:41:42', type: 'info' },
                  { event: 'Security protocols active', time: '14:41:30', type: 'success' },
                ].map((log, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w - 1.5 h - 1.5 rounded - full ${log.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'} `} />
                      <span className="text-sm text-gray-300 font-mono">{log.event}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{log.time}</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Storage Widget */}
          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="font-bold text-white mb-4">Storage</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Documents</span>
                    <span className="text-white">45%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-[45%] bg-primary rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Media</span>
                    <span className="text-white">28%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-[28%] bg-blue-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">System</span>
                    <span className="text-white">12%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-[12%] bg-emerald-500 rounded-full" />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex gap-2">
                <Button variant="secondary" size="sm" className="w-full text-xs">Clean Up</Button>
                <Button variant="secondary" size="sm" className="w-full text-xs">Upgrade</Button>
              </div>
            </Card>
          </motion.div>

          {/* AI Status */}
          <motion.div variants={item}>
            <Card className="p-6 bg-linear-to-b from-primary/10 to-transparent border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="text-primary fill-primary" size={20} />
                <h3 className="font-bold text-white">AI Capabilities</h3>
              </div>
              Running on Nexus AI 2.0 Flash architecture with enhanced context window.
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span>Natural Language Processing</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span>Computer Vision</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span>Predictive Analytics</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
