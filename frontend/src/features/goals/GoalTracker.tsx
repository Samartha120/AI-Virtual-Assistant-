import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Target, Plus, Trash2, Sparkles, ChevronDown, ChevronUp,
    Loader2, CheckCircle2, Clock, Briefcase, User, Heart, BookOpen
} from 'lucide-react';
import { askNexus } from '../../services/aiService';
import { storage } from '../../services/storageService';
import {
    createGoal as createGoalRecord,
    deleteGoal as deleteGoalRecord,
    fetchGoals,
    updateGoal as updateGoalRecord,
} from '../../services/firestoreService';
import { logSystemEvent } from '../../../services/interactionService';

// ─────────────────────── types ────────────────────────────────────────────────
type Category = 'work' | 'personal' | 'health' | 'learning';

interface KeyResult {
    id: string;
    title: string;
    progress: number; // 0-100
    tasks: KRTask[];
}

interface KRTask {
    id: string;
    title: string;
    done: boolean;
    taskId?: string; // optional link to Task Board task
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

const makeDefaultTask = (krTitle: string, done = false): KRTask => ({
    id: uid(),
    title: `Finish: ${krTitle}`,
    done,
    taskId: undefined,
});

const daysLeft = (deadline: string) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
    return diff;
};

const avgProgress = (krs: KeyResult[]) =>
    krs.length === 0 ? 0 : Math.round(krs.reduce((s, k) => s + k.progress, 0) / krs.length);

const krProgressFromTasks = (tasks: KRTask[]) => {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter(t => t.done).length;
    return Math.round((done / tasks.length) * 100);
};

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
    useEffect(() => {
        logSystemEvent({ type: 'module', action: 'OPEN_GOAL_TRACKER', module: 'goal_tracker' });
    }, []);

    const [goals, setGoals] = useState<Goal[]>([]);
    const [filter, setFilter] = useState<Category | 'all'>('all');
    const [showForm, setShowForm] = useState(false);
    const [loadedOnce, setLoadedOnce] = useState(false);
    const saveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
    const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
    const [openMenuGoalId, setOpenMenuGoalId] = useState<string | null>(null);

    // form state
    const [formTitle, setFormTitle] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formCat, setFormCat] = useState<Category>('work');
    const [formDeadline, setFormDeadline] = useState('');
    const [formKRs, setFormKRs] = useState<string[]>(['']);

    useEffect(() => {
        const load = async () => {
            try {
                const records = await fetchGoals();
                const hydrated: Goal[] = records.map((r) => ({
                    id: r.id,
                    title: r.title,
                    description: r.description,
                    category: r.category,
                    deadline: r.deadline,
                    keyResults: r.keyResults.length
                        ? (r.keyResults as any).map((k: any) => {
                            const tasks: KRTask[] = Array.isArray(k.tasks)
                                ? k.tasks.map((t: any) => ({
                                    id: String(t.id),
                                    title: String(t.title),
                                    done: Boolean(t.done),
                                    taskId: t.taskId ? String(t.taskId) : undefined,
                                }))
                                : [];
                            const normalizedTasks = tasks.length
                                ? tasks
                                : [makeDefaultTask(String(k.title ?? 'Key Result'), Number(k.progress ?? 0) >= 100)];
                            const computed = krProgressFromTasks(normalizedTasks);
                            return {
                                id: k.id,
                                title: k.title,
                                tasks: normalizedTasks,
                                progress: computed,
                            } satisfies KeyResult;
                        })
                        : [{ id: uid(), title: 'Complete the objective', tasks: [makeDefaultTask('Complete the objective', false)], progress: 0 }],
                    aiCoach: null,
                    loadingCoach: false,
                    expanded: false,
                    archived: Boolean(r.archived),
                }));
                setGoals(hydrated);
            } catch (err) {
                // Not authenticated or Firestore not available — fall back to in-memory goals
                console.warn('[GoalTracker] failed to load goals:', err);
            } finally {
                setLoadedOnce(true);
            }
        };
        load();
    }, []);

    useEffect(() => {
        return () => {
            Object.values(saveTimeoutsRef.current).forEach((t) => {
                if (t) clearTimeout(t);
            });
        };
    }, []);

    const addGoal = async () => {
        if (!formTitle.trim()) return;

        logSystemEvent({ type: 'api', action: 'GOAL_CREATED', module: 'goal_tracker' });

        const krs: KeyResult[] = formKRs
            .filter(k => k.trim())
            .map(k => {
                const title = k.trim();
                const tasks = [makeDefaultTask(title, false)];
                return { id: uid(), title, tasks, progress: krProgressFromTasks(tasks) };
            });
        const newGoal: Goal = {
            id: uid(), title: formTitle.trim(), description: formDesc.trim(),
            category: formCat, deadline: formDeadline,
            keyResults: krs.length ? krs : (() => {
                const title = 'Complete the objective';
                const tasks = [makeDefaultTask(title, false)];
                return [{ id: uid(), title, tasks, progress: krProgressFromTasks(tasks) }];
            })(),
            aiCoach: null, loadingCoach: false, expanded: true, archived: false,
        };
        setGoals(prev => [newGoal, ...prev]);
        setFormTitle(''); setFormDesc(''); setFormCat('work'); setFormDeadline(''); setFormKRs(['']); setShowForm(false);

        try {
            await createGoalRecord({
                id: newGoal.id,
                title: newGoal.title,
                description: newGoal.description,
                category: newGoal.category,
                deadline: newGoal.deadline,
                keyResults: newGoal.keyResults as any,
                archived: newGoal.archived,
            });
        } catch (err) {
            console.warn('[GoalTracker] failed to persist new goal:', err);
        }
    };

    const persistKeyResults = (goalId: string, nextKeyResults: KeyResult[]) => {
        const existing = saveTimeoutsRef.current[goalId];
        if (existing) clearTimeout(existing);
        saveTimeoutsRef.current[goalId] = setTimeout(() => {
            updateGoalRecord(goalId, { keyResults: nextKeyResults as any })
                .catch((err) => console.warn('[GoalTracker] failed to persist KR update:', err));
        }, 350);
    };

    const upsertTaskBoardTasks = (goalId: string) => {
        // Creates Task Board tasks for all KR tasks and links them by taskId.
        const existing = storage.getTasks();
        const existingById = new Map(existing.map(t => [t.id, t] as const));

        let nextKeyResults: KeyResult[] | null = null;
        let updatedTasks = [...existing];

        setGoals(prev => prev.map(g => {
            if (g.id !== goalId) return g;

            const updatedKrs = g.keyResults.map(kr => {
                const updatedKrTasks = (kr.tasks ?? []).map((t) => {
                    if (t.taskId && existingById.has(t.taskId)) return t;

                    const taskId = t.taskId ?? uid();
                    if (!existingById.has(taskId)) {
                        const created = {
                            id: taskId,
                            title: t.title,
                            status: t.done ? 'done' : 'todo',
                            priority: 'medium',
                            order: Date.now(),
                        } as any;
                        updatedTasks.push(created);
                        existingById.set(taskId, created);
                    }
                    return { ...t, taskId };
                });

                return {
                    ...kr,
                    tasks: updatedKrTasks,
                    progress: krProgressFromTasks(updatedKrTasks),
                };
            });

            nextKeyResults = updatedKrs;
            return { ...g, keyResults: updatedKrs };
        }));

        try {
            storage.saveTasks(updatedTasks);
        } catch (err) {
            console.warn('[GoalTracker] failed to save Task Board tasks:', err);
        }

        if (nextKeyResults) persistKeyResults(goalId, nextKeyResults);
    };

    const addKrTask = (goalId: string, krId: string, title: string) => {
        const trimmed = title.trim();
        if (!trimmed) return;

        let nextKeyResults: KeyResult[] | null = null;

        setGoals(prev => prev.map(g => {
            if (g.id !== goalId) return g;
            const updated = g.keyResults.map(kr => {
                if (kr.id !== krId) return kr;
                const tasks = [...(kr.tasks ?? []), { id: uid(), title: trimmed, done: false }];
                return { ...kr, tasks, progress: krProgressFromTasks(tasks) };
            });
            nextKeyResults = updated;
            return { ...g, keyResults: updated };
        }));

        if (nextKeyResults) persistKeyResults(goalId, nextKeyResults);
    };

    const setDraft = (goalId: string, krId: string, value: string) => {
        const key = `${goalId}:${krId}`;
        setTaskDrafts(prev => ({ ...prev, [key]: value }));
    };

    const submitDraft = (goalId: string, krId: string) => {
        const key = `${goalId}:${krId}`;
        const value = (taskDrafts[key] ?? '').trim();
        if (!value) return;
        addKrTask(goalId, krId, value);
        setTaskDrafts(prev => ({ ...prev, [key]: '' }));
    };

    const toggleKrTask = (goalId: string, krId: string, taskId: string) => {
        let nextKeyResults: KeyResult[] | null = null;
        let linkedTaskUpdate: { taskId: string; done: boolean } | null = null;

        setGoals(prev => prev.map(g => {
            if (g.id !== goalId) return g;
            const updated = g.keyResults.map(kr => {
                if (kr.id !== krId) return kr;
                const tasks = (kr.tasks ?? []).map(t => {
                    if (t.id !== taskId) return t;
                    const done = !t.done;
                    if (t.taskId) linkedTaskUpdate = { taskId: t.taskId, done };
                    return { ...t, done };
                });
                return { ...kr, tasks, progress: krProgressFromTasks(tasks) };
            });
            nextKeyResults = updated;
            return { ...g, keyResults: updated };
        }));

        if (linkedTaskUpdate) {
            try {
                const tasks = storage.getTasks();
                const updated = tasks.map((t: any) =>
                    t.id === linkedTaskUpdate!.taskId
                        ? { ...t, status: linkedTaskUpdate!.done ? 'done' : 'todo' }
                        : t
                );
                storage.saveTasks(updated);
            } catch (err) {
                console.warn('[GoalTracker] failed to update Task Board task status:', err);
            }
        }

        if (nextKeyResults) persistKeyResults(goalId, nextKeyResults);
    };

    const deleteGoal = (id: string) => {
        setGoals(prev => prev.filter(g => g.id !== id));
        deleteGoalRecord(id).catch((err) => console.warn('[GoalTracker] failed to delete goal:', err));
    };

    const toggleExpand = (id: string) =>
        setGoals(prev => prev.map(g => g.id === id ? { ...g, expanded: !g.expanded } : g));

    const archiveGoal = (id: string) => {
        setGoals(prev => prev.map(g => g.id === id ? { ...g, archived: true, expanded: false } : g));
        updateGoalRecord(id, { archived: true }).catch((err) => console.warn('[GoalTracker] failed to archive goal:', err));
    };

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
                {loadedOnce && filtered.length === 0 && (
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
                                    <div className="flex items-center gap-2 shrink-0 relative">
                                        <button onClick={() => getAiCoach(goal)} disabled={goal.loadingCoach}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:scale-105 disabled:opacity-50"
                                            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.25)' }}>
                                            {goal.loadingCoach ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            AI Coach
                                        </button>
                                        <button
                                            onClick={() => setOpenMenuGoalId(v => (v === goal.id ? null : goal.id))}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                                            style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                                            Actions ▾
                                        </button>
                                        <AnimatePresence>
                                            {openMenuGoalId === goal.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    className="absolute right-0 top-10 w-44 rounded-xl border overflow-hidden z-50"
                                                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                                                    <button
                                                        onClick={() => {
                                                            toggleExpand(goal.id);
                                                            setOpenMenuGoalId(null);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                                                        style={{ color: 'var(--text)' }}>
                                                        {goal.expanded ? 'Collapse' : 'Expand'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (isComplete) archiveGoal(goal.id);
                                                            setOpenMenuGoalId(null);
                                                        }}
                                                        disabled={!isComplete}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
                                                        style={{ color: isComplete ? '#10b981' : 'var(--text-muted)' }}>
                                                        Archive
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            upsertTaskBoardTasks(goal.id);
                                                            setOpenMenuGoalId(null);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                                                        style={{ color: 'var(--text)' }}>
                                                        Create Task Board tasks
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            deleteGoal(goal.id);
                                                            setOpenMenuGoalId(null);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-500/10 transition-colors"
                                                        style={{ color: '#f87171' }}>
                                                        Delete
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
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
                                                        <div key={kr.id} className="space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm" style={{ color: 'var(--text)' }}>{kr.title}</span>
                                                                <span className="text-xs font-bold" style={{ color: kr.progress === 100 ? '#10b981' : meta.color }}>{kr.progress}%</span>
                                                            </div>

                                                            {/* Progress bar (computed) */}
                                                            <div className="h-2 rounded-full border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
                                                                <div className="h-full" style={{ width: `${kr.progress}%`, background: kr.progress === 100 ? '#10b981' : meta.color, transition: 'width 0.25s ease' }} />
                                                            </div>

                                                            {/* Tasks checklist */}
                                                            <div className="space-y-1.5">
                                                                {(kr.tasks ?? []).map((t) => (
                                                                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={t.done}
                                                                            onChange={() => toggleKrTask(goal.id, kr.id, t.id)}
                                                                            className="h-4 w-4"
                                                                        />
                                                                        <span style={{ color: 'var(--text)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.7 : 1 }}>
                                                                            {t.title}
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>

                                                            {/* Add task */}
                                                            <div className="flex gap-2">
                                                                <input
                                                                    value={taskDrafts[`${goal.id}:${kr.id}`] ?? ''}
                                                                    onChange={(e) => setDraft(goal.id, kr.id, e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') submitDraft(goal.id, kr.id);
                                                                    }}
                                                                    placeholder="Add a task…"
                                                                    className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                                                                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                                                                />
                                                                <button
                                                                    onClick={() => submitDraft(goal.id, kr.id)}
                                                                    className="px-3 py-2 rounded-lg text-sm font-semibold border transition-colors"
                                                                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                                                                    Add
                                                                </button>
                                                            </div>
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
