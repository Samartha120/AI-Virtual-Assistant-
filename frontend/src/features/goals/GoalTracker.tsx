import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Target, Plus, Trash2, Sparkles, ChevronDown, ChevronUp,
    Loader2, CheckCircle2, Clock, Briefcase, User, Heart, BookOpen
} from 'lucide-react';
import { askNexus } from '../../services/geminiService';

// ─────────────────────── types ────────────────────────────────────────────────
type Category = 'work' | 'personal' | 'health' | 'learning';

interface KeyResult {
    id: string;
    title: string;
    progress: number; // 0-100
}

interface Goal {
    id: string;
    title: string;
    description: string;
    category: Category;
    deadline: string;
    keyResults: KeyResult[];
    aiCoach: string | null;
    loadingCoach: boolean;
    expanded: boolean;
    archived: boolean;
}

// ─────────────────────── helpers ──────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const daysLeft = (deadline: string) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
    return diff;
};

const avgProgress = (krs: KeyResult[]) =>
    krs.length === 0 ? 0 : Math.round(krs.reduce((s, k) => s + k.progress, 0) / krs.length);

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    work: { label: 'Work', icon: <Briefcase size={13} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    personal: { label: 'Personal', icon: <User size={13} />, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    health: { label: 'Health', icon: <Heart size={13} />, color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    learning: { label: 'Learning', icon: <BookOpen size={13} />, color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
};

// ─────────────────────────── Ring ─────────────────────────────────────────────
const ProgressRing: React.FC<{ pct: number; color: string; size?: number }> = ({ pct, color, size = 56 }) => {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth="5" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
    );
};

// ─────────────────────────── main component ───────────────────────────────────
const GoalTracker: React.FC = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [filter, setFilter] = useState<Category | 'all'>('all');
    const [showForm, setShowForm] = useState(false);

    // form state
    const [formTitle, setFormTitle] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formCat, setFormCat] = useState<Category>('work');
    const [formDeadline, setFormDeadline] = useState('');
    const [formKRs, setFormKRs] = useState<string[]>(['']);

    const addGoal = () => {
        if (!formTitle.trim()) return;
        const krs: KeyResult[] = formKRs.filter(k => k.trim()).map(k => ({ id: uid(), title: k.trim(), progress: 0 }));
        setGoals(prev => [{
            id: uid(), title: formTitle.trim(), description: formDesc.trim(),
            category: formCat, deadline: formDeadline,
            keyResults: krs.length ? krs : [{ id: uid(), title: 'Complete the objective', progress: 0 }],
            aiCoach: null, loadingCoach: false, expanded: true, archived: false,
        }, ...prev]);
        setFormTitle(''); setFormDesc(''); setFormCat('work'); setFormDeadline(''); setFormKRs(['']); setShowForm(false);
    };

    const updateKR = (goalId: string, krId: string, progress: number) => {
        setGoals(prev => prev.map(g => g.id !== goalId ? g : {
            ...g, keyResults: g.keyResults.map(k => k.id === krId ? { ...k, progress } : k)
        }));
    };

    const deleteGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));

    const toggleExpand = (id: string) =>
        setGoals(prev => prev.map(g => g.id === id ? { ...g, expanded: !g.expanded } : g));

    const archiveGoal = (id: string) =>
        setGoals(prev => prev.map(g => g.id === id ? { ...g, archived: true, expanded: false } : g));

    const getAiCoach = async (goal: Goal) => {
        setGoals(prev => prev.map(g => g.id !== goal.id ? g : { ...g, loadingCoach: true, aiCoach: null }));
        const krSummary = goal.keyResults.map(k => `- ${k.title}: ${k.progress}% complete`).join('\n');
        const prompt = `You are an OKR (Objectives and Key Results) coach. The user has this goal:

Objective: "${goal.title}"
Category: ${goal.category}
Deadline: ${goal.deadline || 'Not set'}
Description: ${goal.description || 'None'}

Key Results progress:
${krSummary}

Analyze their progress and give them:
1. A brief honest assessment (1–2 sentences)
2. The biggest gap or risk
3. Two specific, actionable next steps they should do this week

Keep your response under 150 words. Be direct and motivating.`;
        try {
            const tip = await askNexus(prompt);
            setGoals(prev => prev.map(g => g.id !== goal.id ? g : { ...g, aiCoach: tip, loadingCoach: false }));
        } catch {
            setGoals(prev => prev.map(g => g.id !== goal.id ? g : { ...g, aiCoach: 'Could not load coaching tip. Please try again.', loadingCoach: false }));
        }
    };

    const filtered = goals.filter(g => !g.archived && (filter === 'all' || g.category === filter));
    const archived = goals.filter(g => g.archived);

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ color: 'var(--text)' }}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
                        <Target size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Goal & OKR Tracker</h1>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set objectives · Track key results · AI coaching</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}>
                    <Plus size={16} /> New Goal
                </button>
            </div>

            {/* New Goal Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="border-b overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                        <div className="px-6 py-5 space-y-4" style={{ background: 'var(--surface)' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Objective</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                                    placeholder="Objective title (e.g. Launch product MVP)"
                                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <input value={formDeadline} onChange={e => setFormDeadline(e.target.value)} type="date"
                                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            </div>
                            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
                                placeholder="Brief description (optional)"
                                rows={2}
                                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
                                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />

                            {/* Category */}
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(CATEGORY_META) as Category[]).map(cat => (
                                    <button key={cat} onClick={() => setFormCat(cat)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                                        style={{
                                            background: formCat === cat ? CATEGORY_META[cat].bg : 'transparent',
                                            color: formCat === cat ? CATEGORY_META[cat].color : 'var(--text-muted)',
                                            borderColor: formCat === cat ? CATEGORY_META[cat].color + '60' : 'var(--border)',
                                        }}>
                                        {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
                                    </button>
                                ))}
                            </div>

                            {/* Key Results */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Key Results</label>
                                {formKRs.map((kr, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input value={kr} onChange={e => { const n = [...formKRs]; n[i] = e.target.value; setFormKRs(n); }}
                                            placeholder={`Key Result ${i + 1}`}
                                            className="flex-1 px-3 py-2 rounded-xl text-sm focus:outline-none"
                                            style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                        {formKRs.length > 1 && (
                                            <button onClick={() => setFormKRs(prev => prev.filter((_, j) => j !== i))}
                                                className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {formKRs.length < 5 && (
                                    <button onClick={() => setFormKRs(prev => [...prev, ''])}
                                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
                                        <Plus size={12} /> Add Key Result
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={addGoal} disabled={!formTitle.trim()}
                                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
                                    Create Goal
                                </button>
                                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm transition-colors"
                                    style={{ color: 'var(--text-muted)', background: 'var(--card-bg)' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filter Bar */}
            <div className="px-6 py-3 flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
                {(['all', ...Object.keys(CATEGORY_META)] as (Category | 'all')[]).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
                        style={{
                            background: filter === f ? 'rgba(139,92,246,0.2)' : 'var(--card-bg)',
                            color: filter === f ? '#a78bfa' : 'var(--text-muted)',
                            border: `1px solid ${filter === f ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
                        }}>
                        {f === 'all' ? '🎯 All Goals' : `${CATEGORY_META[f as Category].label}`}
                    </button>
                ))}
                <span className="ml-auto text-xs self-center" style={{ color: 'var(--text-muted)' }}>{filtered.length} active goals</span>
            </div>

            {/* Goals List */}
            <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar space-y-4">
                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-20 opacity-50 select-none">
                        <Target size={48} className="text-violet-400 mb-4" />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No goals yet.<br />Click "New Goal" to set your first objective.</p>
                    </div>
                )}

                <AnimatePresence>
                    {filtered.map(goal => {
                        const pct = avgProgress(goal.keyResults);
                        const meta = CATEGORY_META[goal.category];
                        const days = daysLeft(goal.deadline);
                        const isComplete = pct === 100;

                        return (
                            <motion.div key={goal.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                                className="rounded-2xl border overflow-hidden"
                                style={{ background: 'var(--surface)', borderColor: isComplete ? '#10b98160' : 'var(--border)' }}>
                                {/* Goal Header */}
                                <div className="p-5 flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="relative shrink-0">
                                            <ProgressRing pct={pct} color={isComplete ? '#10b981' : meta.color} />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[11px] font-bold" style={{ color: isComplete ? '#10b981' : meta.color }}>{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h3 className="font-bold text-base truncate" style={{ color: 'var(--text)' }}>{goal.title}</h3>
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                                    style={{ background: meta.bg, color: meta.color }}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                                {isComplete && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                                            </div>
                                            {goal.description && <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{goal.description}</p>}
                                            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
                                                {goal.deadline && (
                                                    <span className="flex items-center gap-1" style={{ color: days !== null && days < 7 ? '#f87171' : 'var(--text-subtle)' }}>
                                                        <Clock size={11} />
                                                        {days !== null && days >= 0 ? `${days}d left` : days !== null ? 'Overdue' : goal.deadline}
                                                    </span>
                                                )}
                                                <span>{goal.keyResults.length} key result{goal.keyResults.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => getAiCoach(goal)} disabled={goal.loadingCoach}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:scale-105 disabled:opacity-50"
                                            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.25)' }}>
                                            {goal.loadingCoach ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            AI Coach
                                        </button>
                                        {isComplete && (
                                            <button onClick={() => archiveGoal(goal.id)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                                                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.25)' }}>
                                                Archive ✓
                                            </button>
                                        )}
                                        <button onClick={() => deleteGoal(goal.id)}
                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                        <button onClick={() => toggleExpand(goal.id)}
                                            className="p-1.5 rounded-lg transition-colors"
                                            style={{ color: 'var(--text-muted)', background: 'var(--card-bg)' }}>
                                            {goal.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded: Key Results + AI Coach */}
                                <AnimatePresence>
                                    {goal.expanded && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                            className="overflow-hidden">
                                            <div className="border-t px-5 pb-5 pt-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
                                                {/* Key Results */}
                                                <div className="space-y-3">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Key Results</h4>
                                                    {goal.keyResults.map(kr => (
                                                        <div key={kr.id} className="space-y-1.5">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm" style={{ color: 'var(--text)' }}>{kr.title}</span>
                                                                <span className="text-xs font-bold" style={{ color: kr.progress === 100 ? '#10b981' : meta.color }}>{kr.progress}%</span>
                                                            </div>
                                                            <input type="range" min={0} max={100} value={kr.progress}
                                                                onChange={e => updateKR(goal.id, kr.id, Number(e.target.value))}
                                                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                                                style={{ accentColor: kr.progress === 100 ? '#10b981' : meta.color }} />
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* AI Coach Panel */}
                                                <AnimatePresence>
                                                    {(goal.loadingCoach || goal.aiCoach) && (
                                                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                                            className="rounded-xl p-4 border"
                                                            style={{ background: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.2)' }}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Sparkles size={13} className="text-violet-400" />
                                                                <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">AI Coach Analysis</span>
                                                            </div>
                                                            {goal.loadingCoach ? (
                                                                <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                                                    <div className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
                                                                    <span className="text-sm">Analyzing your progress…</span>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{goal.aiCoach}</p>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Archived */}
                {archived.length > 0 && (
                    <div className="mt-8">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-subtle)' }}>
                            ✅ Completed & Archived ({archived.length})
                        </p>
                        <div className="space-y-2">
                            {archived.map(g => (
                                <div key={g.id} className="px-4 py-3 rounded-xl border flex items-center justify-between opacity-50"
                                    style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{g.title}</span>
                                    <span className="text-xs text-emerald-400">100% ✓</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GoalTracker;
