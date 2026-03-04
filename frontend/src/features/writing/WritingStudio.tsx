import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PenLine, Sparkles, Copy, RefreshCw, CheckCheck,
    WrapText, Smile, Briefcase, Globe, AlignLeft, Expand, Loader2
} from 'lucide-react';
import { askNexus } from '../../services/geminiService';

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
            const result = await askNexus(action.prompt(original));
            setOutput(result);
        } catch {
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
        <div className="h-full flex flex-col" style={{ color: 'var(--text)' }}>
            {/* Header */}
            <div className="p-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
                        <PenLine size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>AI Writing Studio</h1>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Transform your text with AI-powered actions</p>
                    </div>
                </div>
            </div>

            {/* Action Buttons Row */}
            <div className="px-6 py-3 flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
                {ACTIONS.map((action) => (
                    <button
                        key={action.id}
                        onClick={() => runAction(action)}
                        disabled={isLoading || !original.trim()}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${action.color} disabled:opacity-40 disabled:cursor-not-allowed ${activeAction === action.id && isLoading ? 'ring-2 ring-offset-1 ring-offset-transparent ring-current' : ''}`}
                    >
                        {activeAction === action.id && isLoading
                            ? <Loader2 size={13} className="animate-spin" />
                            : action.icon}
                        {action.label}
                    </button>
                ))}
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex min-h-0">
                {/* Original */}
                <div className="flex-1 flex flex-col border-r" style={{ borderColor: 'var(--border)' }}>
                    <div className="px-4 py-2 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <span className="font-semibold uppercase tracking-wider">Your Text</span>
                        <span>{wordCount} words · {mins} min read</span>
                    </div>
                    <textarea
                        value={original}
                        onChange={(e) => setOriginal(e.target.value)}
                        placeholder="Start writing or paste your text here…&#10;&#10;Then click any AI action above to transform it."
                        className="flex-1 w-full p-5 resize-none text-sm leading-relaxed focus:outline-none custom-scrollbar"
                        style={{ background: 'var(--bg)', color: 'var(--text)' }}
                    />
                </div>

                {/* AI Output */}
                <div className="flex-1 flex flex-col">
                    <div className="px-4 py-2 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
                            <Sparkles size={12} className="text-violet-400" />
                            AI Output
                            {activeAction && !isLoading && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-violet-500/15 text-violet-400 capitalize">{activeAction}</span>
                            )}
                        </div>
                        {output && (
                            <div className="flex items-center gap-2">
                                <button onClick={replace} className="flex items-center gap-1 px-2 py-1 rounded bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition-colors">
                                    {replaced ? <CheckCheck size={12} /> : <RefreshCw size={12} />}
                                    {replaced ? 'Replaced!' : 'Replace'}
                                </button>
                                <button onClick={copy} className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/15 transition-colors" style={{ color: 'var(--text-muted)' }}>
                                    {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar" style={{ background: 'var(--surface)' }}>
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                    <div className="w-12 h-12 rounded-full bg-violet-500/15 flex items-center justify-center">
                                        <Loader2 size={22} className="animate-spin text-violet-400" />
                                    </div>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        AI is {ACTIONS.find(a => a.id === activeAction)?.label.toLowerCase()}ing your text…
                                    </p>
                                </motion.div>
                            ) : output ? (
                                <motion.p key="output" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                                    {output}
                                </motion.p>
                            ) : (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
                                    <Sparkles size={32} className="text-violet-400" />
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        Select an AI action above<br />to transform your text
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WritingStudio;
