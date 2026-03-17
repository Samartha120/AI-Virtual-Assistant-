import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage as IChatMessage } from '../../types';
import { askNexus } from '../../services/grokService';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { ChatMessage } from '../../components/chat/ChatMessage';
import { ChatInput } from '../../components/chat/ChatInput';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const simulateStreaming = async (fullText: string) => {
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
      if (!isStreaming) break; // Safety break

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

    setIsStreaming(false);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Add User Message
    const userMsg: IChatMessage = {
      role: 'user',
      text: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Get full response from API
      const responseText = await askNexus(text);

      // Start streaming simulation
      setIsLoading(false);
      await simulateStreaming(responseText);

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "I encountered a neural synchronization error. Please try again.",
        timestamp: Date.now()
      }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1115] relative overflow-hidden">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center opacity-50 select-none animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-primary/20 shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]">
                <span className="text-4xl">✨</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Nexus Enterprise OS</h2>
              <p className="text-sm text-gray-400 max-w-sm">
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
