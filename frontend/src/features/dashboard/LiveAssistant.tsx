
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const LiveAssistant: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const stopSession = useCallback(async () => {
    if (sessionPromiseRef.current) {
      const session = await sessionPromiseRef.current;
      session.close();
      sessionPromiseRef.current = null;
    }
    if (audioContextRef.current) await audioContextRef.current.close();
    if (outputAudioContextRef.current) await outputAudioContextRef.current.close();
    
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    
    setIsActive(false);
    setIsConnecting(false);
  }, []);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);

            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
               const text = message.serverContent.outputTranscription.text;
               setTranscripts(prev => [...prev.slice(-3), `Nexus: ${text}`]);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContextRef.current.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Live session error:', e);
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: 'You are NexusAI, an elite academic and professional assistant. Provide brief, ultra-intelligent, and concise verbal responses.',
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          outputAudioTranscription: {}
        }
      });

      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error('Failed to start Live session:', err);
      setIsConnecting(false);
      alert('Could not establish neural link. Ensure microphone access is granted and API key is valid.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center animate-fade-in">
      <div className="max-w-2xl w-full">
        <header className="mb-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-widest mb-4">
             Voice Neural Link v1.0
          </div>
          <h2 className="text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60 tracking-tight">
            Conversational Intelligence
          </h2>
          <p className="text-gray-500 text-lg">
            Direct audio-to-audio interaction with zero-latency reasoning.
          </p>
        </header>

        <div className="relative mb-16 flex justify-center">
          <div className={`w-64 h-64 rounded-full flex items-center justify-center transition-all duration-1000 relative z-10 ${
            isActive 
              ? 'bg-violet-600/20 shadow-[0_0_80px_rgba(139,92,246,0.2)] scale-110' 
              : 'bg-white/5 border border-white/5'
          }`}>
            <div className={`w-40 h-40 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl ${isActive ? 'animate-pulse' : ''}`}>
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
            className={`group relative px-12 py-5 rounded-[2rem] font-bold text-xl transition-all duration-500 overflow-hidden ${
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
  );
};

export default LiveAssistant;
