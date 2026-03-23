/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Bot, FileText, Lightbulb, MessageSquare, Paperclip, Send, Loader2, Play, X } from 'lucide-react';
import { getSessionMessages, getAiSessions, askNexus } from '../../services/aiService';
import { getUserFacingAiError } from '../../services/errorUtils';
import { saveAIInteraction } from '../../services/interactionService';
import { ChatMessage as IChatMessage, AnalysisResult } from '../../types';
import { SessionsSidebar } from '../../components/chat/SessionsSidebar';
import { ChatMessage } from '../../components/chat/ChatMessage';
import { Button } from '../../components/ui/Button';

// For doc analyzer file extraction
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const HistoryViewer: React.FC = () => {
  const { moduleName } = useParams<{ moduleName: string }>();
  // The module is mapped directly from URL path (/history/neural_chat)
  const activeModule = moduleName || 'neural_chat';
  
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string, content: string, size: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingRef = useRef(false);

  // Auto-scroll logic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => { streamingRef.current = false; };
  }, []);

  // 1. Auto load latest session default ON MOUNT IF NONE SELECTED
  useEffect(() => {
    const loadLatestSession = async () => {
      if (currentSessionId !== undefined) return; 
      try {
        const sessions = await getAiSessions(activeModule);
        if (sessions && sessions.length > 0) {
          setCurrentSessionId(sessions[0].id);
        } else {
          setCurrentSessionId(undefined);
        }
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    };
    loadLatestSession();
  }, [activeModule, currentSessionId]);

  // 2. Load Messages for current session
  useEffect(() => {
    if (currentSessionId) {
      setIsLoading(true);
      getSessionMessages(currentSessionId).then(history => {
        if (history && history.length > 0) {
           const mappedHistory: IChatMessage[] = history.map((msg: any) => ({
             role: msg.role === 'assistant' ? 'model' : 'user',
             text: msg.content,
             timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
           }));
           setMessages(mappedHistory);
        } else {
           setMessages([]);
        }
      }).finally(() => setIsLoading(false));
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // --- File extraction for Doc Analyzer ---
  const extractTextFromPPTX = async (file: File): Promise<string> => {
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      let fullText = '';
      const slideFiles = Object.keys(content.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
      for (const slideName of slideFiles) {
        const xmlContent = await content.file(slideName)?.async('string');
        if (xmlContent) {
          const textMatches = xmlContent.match(/<a:t>([^<]*)<\/a:t>/g);
          if (textMatches) {
            const slideText = textMatches.map(t => t.replace(/<\/?a:t>/g, '')).join(' ');
            fullText += slideText + '\n\n';
          }
        }
      }
      return fullText.trim();
    } catch (error) {
      throw new Error('Failed to extract text from Presentation.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    let extractedText = '';

    try {
      if (['txt', 'md', 'csv', 'json', 'js', 'ts', 'html', 'css'].includes(extension || '')) {
        extractedText = await file.text();
      } else if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (['xlsx', 'xls'].includes(extension || '')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        extractedText = XLSX.utils.sheet_to_csv(worksheet);
      } else if (extension === 'pptx') {
        extractedText = await extractTextFromPPTX(file);
      } else {
        alert('Unsupported file format.');
        return;
      }

      setAttachedFile({ name: file.name, content: extractedText, size: file.size });
    } catch (err) {
      console.error('File parsing error', err);
      alert('Failed to parse the file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Interaction Execution ---
  const simulateStreaming = async (fullText: string) => {
    streamingRef.current = true;
    const aiMsg: IChatMessage = { role: 'model', text: '', timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);

    const chunkSize = 5;
    let currentText = '';

    for (let i = 0; i < fullText.length; i += chunkSize) {
      if (!streamingRef.current) break;
      const chunk = fullText.slice(i, i + chunkSize);
      currentText += chunk;
      setMessages(prev => {
        const newArr = [...prev];
        const lastMsg = newArr[newArr.length - 1];
        if (lastMsg.role === 'model') lastMsg.text = currentText;
        return newArr;
      });
      await new Promise(r => setTimeout(r, 10)); // pseudo streaming
    }
    streamingRef.current = false;
  };

  const handleSend = async () => {
    const isDocAnalyzer = activeModule === 'doc_analyzer';
    const activeText = attachedFile ? attachedFile.content : inputText;
    
    if (!activeText.trim() || isGenerating) return;

    const userDisplayMsg = (attachedFile && isDocAnalyzer) 
      ? `[Attached File: ${attachedFile.name}]\n\n${inputText}` 
      : inputText;

    setInputText('');
    setAttachedFile(null);
    streamingRef.current = false;

    const userMsg: IChatMessage = { role: 'user', text: userDisplayMsg, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const response = await askNexus(activeText, activeModule, currentSessionId);
      
      if (!currentSessionId) {
        setCurrentSessionId(response.sessionId);
      }

      saveAIInteraction(activeModule, activeText.slice(0, 1000), typeof response.reply === 'string' ? response.reply : JSON.stringify(response.reply)).catch(console.warn);

      // Raw json structural parsing bypasses streaming, Neural Chat uses streaming
      if (activeModule === 'doc_analyzer') {
        setMessages(prev => [...prev, { role: 'model', text: typeof response.reply === 'string' ? response.reply : JSON.stringify(response.reply), timestamp: Date.now() }]);
      } else {
        await simulateStreaming(response.reply);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: getUserFacingAiError(error), timestamp: Date.now() }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const getModuleIcon = () => {
    if (activeModule === 'doc_analyzer') return <FileText size={20} />;
    if (activeModule === 'brainstormer') return <Lightbulb size={20} />;
    return <MessageSquare size={20} />;
  };

  const AnalysisSection = ({ title, items, color = "primary" }: { title: string, items: string[], color?: "primary" | "secondary" | "accent" }) => (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${color === 'primary' ? 'bg-primary' : color === 'secondary' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
        {title}
      </h3>
      <div className="space-y-2">
        {(Array.isArray(items) ? items : []).map((item, i) => (
          <div key={i} className="flex gap-3 text-sm text-gray-200 p-3 rounded-lg bg-surface/50 border border-border hover:bg-white/5 transition-colors">
            <span className="text-primary font-mono select-none">{String(i + 1).padStart(2, '0')}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-background relative overflow-hidden">
      {/* LEFT PANEL - 25% WIDTH */}
      <SessionsSidebar 
        moduleName={activeModule} 
        currentSessionId={currentSessionId} 
        onSelectSession={(id) => setCurrentSessionId(id)} 
      />
      
      {/* RIGHT PANEL - MAIN CHAT VIEW - 75% WIDTH */}
      <div className="flex-1 flex flex-col relative h-full">
        
        {/* HEADER */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {getModuleIcon()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary capitalize">{activeModule.replace('_', ' ')}</h2>
              <p className="text-xs text-text-tertiary">{currentSessionId ? "Active Session" : "New Chat"}</p>
            </div>
          </div>
          
        </header>

        {/* CHAT MESSAGES */}
        <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* EMPTY STATE */}
            {!isLoading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center select-none animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
                  {getModuleIcon()}
                </div>
                <h2 className="heading-lg text-text-primary mb-2">No conversations yet</h2>
              <p className="body-sm text-text-secondary max-w-sm mb-6">
                Select a past session from the sidebar to view your activity logs.
              </p>
              {/* Removed Start New Chat button */}
            </div>
            )}
            
            {/* CHAT HISTORY MAPPING */}
            {messages.map((msg, idx) => {
              // 1. User messages and standard AI string responses (Brainstorm/Neural)
              if (msg.role === 'user' || activeModule !== 'doc_analyzer') {
                return (
                  <ChatMessage 
                    key={idx} 
                    role={msg.role} 
                    content={msg.text} 
                    isStreaming={isGenerating && idx === messages.length - 1 && msg.role === 'model'}
                  />
                );
              }

              // 2. Structured JSON parsing specifically mapped for Doc Analyzer architecture
              let parsed: AnalysisResult | null = null;
              try {
                const cleaned = msg.text.replace(/```json\s*/i, '').replace(/```\s*/i, '').replace(/\s*```/g, '').trim();
                parsed = JSON.parse(cleaned);
              } catch (e) {
                return <ChatMessage key={idx} role="model" content={msg.text} />;
              }

              if (!parsed) return <ChatMessage key={idx} role="model" content={msg.text} />;

              // Unified Custom Formatter for document analysis output
              return (
                <div key={idx} className="flex w-full gap-4 p-6 flex-row">
                   <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-emerald-500/5 border-emerald-500/10 text-emerald-500">
                       <Bot className="h-4 w-4" />
                   </div>
                   <div className="flex-1 overflow-hidden text-left bg-surface border border-border text-text-primary rounded-2xl px-6 py-6 shadow-sm">
                      <div className="space-y-8">
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Executive Summary
                          </h3>
                          <p className="text-sm text-white leading-relaxed">{parsed.summary}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <AnalysisSection title="Key Insights" items={parsed.keyPoints || []} color="secondary" />
                          <AnalysisSection title="Action Items" items={parsed.actionItems || []} color="accent" />
                        </div>
                      </div>
                   </div>
                </div>
              );
            })}

            {isGenerating && activeModule === 'doc_analyzer' && (
              <div className="flex items-center gap-2 text-primary/50 text-xs font-mono ml-16 animate-pulse">
                <span>Analyzing intelligence...</span>
                <span className="flex gap-1">
                  <span className="w-1 h-1 bg-primary/50 rounded-full animate-bounce delay-75" />
                  <span className="w-1 h-1 bg-primary/50 rounded-full animate-bounce delay-150" />
                  <span className="w-1 h-1 bg-primary/50 rounded-full animate-bounce delay-300" />
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* INPUT UI REMOVED - STRICTLY READ-ONLY HISTORY VIEWER ACTING AS ARCHIVE ONLY */}
      </div>
    </div>
  );
};

export default HistoryViewer;
