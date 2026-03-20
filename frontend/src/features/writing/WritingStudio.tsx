import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PenLine, Sparkles, Copy, RefreshCw, CheckCheck,
    WrapText, Smile, Briefcase, Globe, AlignLeft, Expand, Loader2
} from 'lucide-react';
import { askNexus } from '../../services/grokService';
import { saveAIInteraction } from '../../services/interactionService';

// ─────────────────────────────── types ────────────────────────────────────────
type Action = {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    prompt: (text: string) => string;
};

// ─────────────────────────────── actions ──────────────────────────────────────
const ACTIONS: Action[] = [
    {
        id: 'rewrite',
        label: 'Rewrite',
        icon: <RefreshCw size={15} />,
        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20',
        prompt: (t) => `Rewrite the following text to improve clarity, flow, and impact. Keep the same meaning but make it significantly better. Return only the rewritten text:\n\n${t}`,
    },
    {
        id: 'grammar',
        label: 'Fix Grammar',
        icon: <CheckCheck size={15} />,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20',
        prompt: (t) => `Fix all grammar, spelling, and punctuation errors in the following text. Return only the corrected text:\n\n${t}`,
    },
    {
        id: 'formal',
        label: 'Make Formal',
        icon: <Briefcase size={15} />,
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20',
        prompt: (t) => `Rewrite the following text in a professional and formal tone suitable for business communication. Return only the rewritten text:\n\n${t}`,
    },
    {
        id: 'casual',
        label: 'Make Casual',
        icon: <Smile size={15} />,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20',
        prompt: (t) => `Rewrite the following text in a friendly, casual, and conversational tone. Return only the rewritten text:\n\n${t}`,
    },
    {
        id: 'translate',
        label: 'Translate',
        icon: <Globe size={15} />,
        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20',
        prompt: (t) => `Detect the language of the following text and translate it to English (or if already English, translate to Spanish). Return only the translated text:\n\n${t}`,
    },
    {
        id: 'summarize',
        label: 'Summarize',
        icon: <AlignLeft size={15} />,
        color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20',
        prompt: (t) => `Summarize the following text into concise, clear bullet points capturing only the most essential information. Return only the bullet-point summary:\n\n${t}`,
    },
    {
        id: 'expand',
        label: 'Expand',
        icon: <Expand size={15} />,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20',
        prompt: (t) => `Expand the following text with more detail, examples, and depth. Keep the same tone and message but make it substantially longer and richer. Return only the expanded text:\n\n${t}`,
    },
    {
        id: 'wrap',
        label: 'Wrap Up',
        icon: <WrapText size={15} />,
        color: 'text-teal-400 bg-teal-500/10 border-teal-500/20 hover:bg-teal-500/20',
        prompt: (t) => `Write a strong, compelling conclusion paragraph for the following text. Return only the conclusion:\n\n${t}`,
    },
];

// ─────────────────────────────── helpers ──────────────────────────────────────
const readingTime = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.ceil(words / 200);
    return mins;
};

// ─────────────────────────────── component ────────────────────────────────────
const WritingStudio: React.FC = () => {
    const [original, setOriginal] = useState('');
    const [output, setOutput] = useState('');
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [replaced, setReplaced] = useState(false);

    const wordCount = useMemo(
        () => original.trim().split(/\s+/).filter(Boolean).length,
        [original]
    );
    const mins = useMemo(() => readingTime(original), [original]);

    const runAction = async (action: Action) => {
        if (!original.trim()) return;
        setIsLoading(true);
        setActiveAction(action.id);
        setOutput('');
        try {
            const prompt = action.prompt(original);
            const result = await askNexus(prompt);
            setOutput(result);

            // Save interaction to Firestore
            await saveAIInteraction(`Writing Studio: ${action.label}`, original, result);
        } catch (error) {
            setOutput('❌ AI action failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const copy = () => {
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const replace = () => {
        setOriginal(output);
        setOutput('');
        setReplaced(true);
        setTimeout(() => setReplaced(false), 2000);
    };

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="p-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4 mb-1">
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                        <PenLine size={24} />
                    </div>
                    <div>
                        <h1 className="heading-lg text-text-primary">AI Writing Studio</h1>
                        <p className="body-sm text-text-secondary">Transform your text with AI-powered actions</p>
                    </div>
                </div>
            </div>

            {/* Action Buttons Row */}
            <div className="px-8 py-4 flex flex-wrap gap-2.5 border-b border-border bg-surface/30">
                {ACTIONS.map((action) => (
                    <button
                        key={action.id}
                        onClick={() => runAction(action)}
                        disabled={isLoading || !original.trim()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all duration-200 ${action.color} disabled:opacity-40 disabled:cursor-not-allowed shadow-sm`}
                    >
                        {activeAction === action.id && isLoading
                            ? <Loader2 size={14} className="animate-spin" />
                            : action.icon}
                        {action.label}
                    </button>
                ))}
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex min-h-0">
                {/* Original */}
                <div className="flex-1 flex flex-col border-r border-border">
                    <div className="px-6 py-3 flex items-center justify-between border-b border-border bg-surface/20">
                        <span className="caption font-bold uppercase tracking-widest text-text-tertiary">Your Text</span>
                        <span className="caption text-text-tertiary">{wordCount} words · {mins} min read</span>
                    </div>
                    <textarea
                        value={original}
                        onChange={(e) => setOriginal(e.target.value)}
                        placeholder="Start writing or paste your text here…"
                        className="flex-1 w-full p-8 resize-none text-sm leading-relaxed text-text-primary bg-background focus:outline-none custom-scrollbar"
                    />
                </div>

                {/* AI Output */}
                <div className="flex-1 flex flex-col">
                    <div className="px-6 py-3 flex items-center justify-between border-b border-border bg-surface/20">
                        <div className="flex items-center gap-2 caption font-bold uppercase tracking-widest text-text-tertiary">
                            <Sparkles size={14} className="text-primary" />
                            AI Output
                            {activeAction && !isLoading && (
                                <span className="ml-2 px-2 py-0.5 rounded-lg text-[10px] bg-primary/5 border border-primary/10 text-primary capitalize tracking-normal">{activeAction}</span>
                            )}
                        </div>
                        {output && (
                            <div className="flex items-center gap-2">
                                <button onClick={replace} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 border border-primary/10 text-primary hover:bg-primary/20 transition-all text-[10px] font-bold uppercase tracking-wider">
                                    {replaced ? <CheckCheck size={12} /> : <RefreshCw size={12} />}
                                    {replaced ? 'Replaced!' : 'Replace'}
                                </button>
                                <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-all text-[10px] font-bold uppercase tracking-wider">
                                    {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-surface/10">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
                                <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                <p className="caption text-text-tertiary animate-pulse uppercase tracking-widest">Nexus is thinking...</p>
                            </div>
                        ) : output ? (
                            <div className="prose prose-invert prose-sm max-w-none text-text-primary leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {output}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                                <Sparkles size={32} className="text-text-tertiary" />
                                <p className="text-sm text-text-tertiary max-w-[200px]">Select an AI action above to see results here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WritingStudio;
