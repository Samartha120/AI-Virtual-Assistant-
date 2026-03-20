/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage as IChatMessage, KnowledgeItem } from '../../types';
import { askNexus, getChatHistory } from '../../services/grokService';
import { getUserFacingAiError } from '../../services/errorUtils';
import { saveAIInteraction } from '../../services/interactionService';
import { fetchKnowledgeItems } from '../../services/firestoreService';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { ChatMessage } from '../../components/chat/ChatMessage';
import { ChatInput } from '../../components/chat/ChatInput';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      streamingRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        // Load chat history
        const history = await getChatHistory();
        if (history && history.length > 0) {
          const mappedHistory: IChatMessage[] = history.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            text: msg.content,
            timestamp: msg.created_at ? new Date(msg.created_at).getTime() : Date.now()
          }));
          setMessages(mappedHistory);
        }

        // Load knowledge base for context
        const kb = await fetchKnowledgeItems();
        setKnowledgeBase(kb);
      } catch (error) {
        console.error("Failed to load chat history or knowledge:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const simulateStreaming = async (fullText: string) => {
    streamingRef.current = true;
    setIsStreaming(true);
    const aiMsg: IChatMessage = {
      role: 'model',
      text: '',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, aiMsg]);

    const chunkSize = 5;
    let currentText = '';

    for (let i = 0; i < fullText.length; i += chunkSize) {
      if (!streamingRef.current) break; // Safety break

      const chunk = fullText.slice(i, i + chunkSize);
      currentText += chunk;

      setMessages(prev => {
        const newArr = [...prev];
        const lastMsg = newArr[newArr.length - 1];
        if (lastMsg.role === 'model') {
          lastMsg.text = currentText;
        }
        return newArr;
      });

      await new Promise(r => setTimeout(r, 15)); // Typing speed
    }

    streamingRef.current = false;
    setIsStreaming(false);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Stop any in-progress streaming before sending a new message
    streamingRef.current = false;
    setIsStreaming(false);

    // Add User Message
    const userMsg: IChatMessage = {
      role: 'user',
      text: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build context from Knowledge Base
      let context = '';
      if (knowledgeBase.length > 0) {
        context = "Use the following context from the user's Knowledge Base if relevant to answer the query:\n\n";
        knowledgeBase.forEach(item => {
          context += `[${item.type.toUpperCase()}: ${item.title}]\n${item.content}\n\n`;
        });
      }

      // Get full response from API
      const history = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      
      const responseText = await askNexus(text, context, false, history as any);

      if (!responseText || !responseText.trim()) {
        throw new Error('Empty AI response');
      }

      // Save interaction to Firestore
      await saveAIInteraction('Neural Chat', text, responseText);

      // Start streaming simulation
      setIsLoading(false);
      await simulateStreaming(responseText);

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: getUserFacingAiError(error),
        timestamp: Date.now()
      }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center select-none animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20 subtle-glow">
                <span className="text-3xl">✨</span>
              </div>
              <h2 className="heading-lg text-text-primary mb-2">Nexus Enterprise OS</h2>
              <p className="body-sm text-text-secondary max-w-sm">
                Ready to accelerate your productivity. Ask me anything.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              role={msg.role}
              content={msg.text}
              isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'model'}
            />
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-primary/50 text-xs font-mono ml-16 animate-pulse">
              <span>Thinking</span>
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

      <ChatInput onSend={handleSend} isLoading={isLoading || isStreaming} />
    </div>
  );
};

export default ChatInterface;
