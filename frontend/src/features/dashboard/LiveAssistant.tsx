
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { askNexus, getSessionMessages } from '../../../services/aiService';
import { getUserFacingAiError } from '../../../services/errorUtils';
import { saveAIInteraction } from '../../../services/interactionService';
import { SessionsSidebar } from '../../../components/chat/SessionsSidebar';

const LiveAssistant: React.FC = () => {
  const MODULE_NAME = 'live_assistant';
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (currentSessionId) {
      getSessionMessages(currentSessionId).then(history => {
         const transcriptList = history.map((msg: any) => 
            msg.role === 'user' ? `You: ${msg.content}` : `Nexus: ${msg.content}`
         );
         setTranscripts(transcriptList);
      });
    } else {
      setTranscripts([]);
    }
  }, [currentSessionId]);

  const recognitionRef = useRef<any | null>(null);
  const stoppedRef = useRef(false);
  const processingRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  const pushLine = useCallback((line: string) => {
    setTranscripts((prev) => [...prev, line].slice(-6));
  }, []);

  const speak = useCallback((text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1;
      utter.volume = 1;
      window.speechSynthesis.speak(utter);
    } catch {
      // Non-fatal
    }
  }, []);

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (!stoppedRef.current && queueRef.current.length > 0) {
        const userText = (queueRef.current.shift() || '').trim();
        if (!userText) continue;
        pushLine(`You: ${userText}`);

        let replyText = '';
        try {
          const resp = await askNexus(userText, MODULE_NAME, currentSessionId);
          if (!currentSessionId) {
            setCurrentSessionId(resp.sessionId);
          }
          replyText = resp.reply;
        } catch (err) {
          console.error('LiveAssistant AI error:', err);
          replyText = getUserFacingAiError(err);
        }

        pushLine(`Nexus: ${replyText}`);
        speak(replyText);

        // Save interaction to Firestore
        saveAIInteraction('Live Assistant', userText, replyText);
      }
    } finally {
      processingRef.current = false;
    }
  }, [pushLine, speak, currentSessionId]);

  const stopSession = useCallback(async () => {
    stoppedRef.current = true;
    queueRef.current = [];
    processingRef.current = false;

    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    recognitionRef.current = null;

    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    setIsActive(false);
    setIsConnecting(false);
  }, []);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      stoppedRef.current = false;

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsConnecting(false);
        alert('Live Assistant requires Speech Recognition (Chrome / Edge).');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsActive(true);
        setIsConnecting(false);
        pushLine('Nexus: Neural link established. Speak when ready.');
      };

      recognition.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        pushLine('Nexus: Microphone link unstable. Reconnect to continue.');
        stopSession();
      };

      recognition.onend = () => {
        if (!stoppedRef.current) {
          try {
            setTimeout(() => {
              try {
                recognition.start();
              } catch {
                // ignore
              }
            }, 250);
          } catch {
            // ignore
          }
        }
      };

      recognition.onresult = (event: any) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += String(result[0]?.transcript || '');
          }
        }
        finalText = finalText.trim();
        if (!finalText) return;

        queueRef.current.push(finalText);
        drainQueue();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start Live session:', err);
      setIsConnecting(false);
      alert('Could not establish neural link. Ensure microphone access is granted.');
    }
  };

  return (
    <div className="flex h-full bg-background relative overflow-hidden">
      <SessionsSidebar 
        moduleName={MODULE_NAME} 
        currentSessionId={currentSessionId} 
        onSelectSession={setCurrentSessionId} 
      />
      <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] p-8 text-center animate-fade-in custom-scrollbar overflow-y-auto">
        <div className="max-w-2xl w-full">
        <header className="mb-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-widest mb-4">
             Voice Neural Link v1.0
          </div>
          <h2 className="text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-linear-to-br from-white to-white/60 tracking-tight">
            Conversational Intelligence
          </h2>
          <p className="text-gray-500 text-lg">
            Voice-to-text interaction with near real-time responses.
          </p>
        </header>

        <div className="relative mb-16 flex justify-center">
          <div className={`w-64 h-64 rounded-full flex items-center justify-center transition-all duration-1000 relative z-10 ${
            isActive 
              ? 'bg-violet-600/20 shadow-[0_0_80px_rgba(139,92,246,0.2)] scale-110' 
              : 'bg-white/5 border border-white/5'
          }`}>
            <div className={`w-40 h-40 rounded-full bg-linear-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl ${isActive ? 'animate-pulse' : ''}`}>
              <svg className={`w-20 h-20 text-white transition-all ${isActive ? 'scale-110' : 'scale-100 opacity-60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            
            {isActive && (
              <div className="absolute inset-0">
                <div className="absolute inset-0 border-2 border-violet-500/30 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-0 border border-violet-500/10 rounded-full animate-pulse scale-150"></div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-8">
          <button
            onClick={isActive ? stopSession : startSession}
            disabled={isConnecting}
            className={`group relative px-12 py-5 rounded-4xl font-bold text-xl transition-all duration-500 overflow-hidden ${
              isActive 
                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' 
                : 'bg-violet-600 text-white shadow-2xl shadow-violet-600/30 hover:bg-violet-700'
            } disabled:opacity-40`}
          >
            <span className="relative z-10">{isConnecting ? 'Synchronizing Core...' : isActive ? 'Disconnect Link' : 'Establish Neural Link'}</span>
          </button>

          {isActive && (
            <div className="w-full glass border border-white/10 rounded-[2.5rem] p-10 space-y-4 shadow-inner">
              <div className="flex items-center justify-center space-x-3 text-violet-400 mb-4">
                <div className="flex space-x-1">
                   <div className="w-1 h-3 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                   <div className="w-1 h-5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                   <div className="w-1 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                   <div className="w-1 h-6 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.3em] ml-2">Uplink Stable</span>
              </div>
              <div className="space-y-3 min-h-[120px] flex flex-col justify-end">
                {transcripts.length === 0 ? (
                  <p className="text-gray-500 italic text-sm">"Summarize my recent research entries..."</p>
                ) : (
                  transcripts.map((t, i) => (
                    <p key={i} className={`text-sm animate-fade-in ${t.startsWith('Nexus:') ? 'text-violet-400 font-medium' : 'text-gray-400'}`}>{t}</p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default LiveAssistant;
