import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Play, Pause, RotateCcw, Sparkles, Flame, Settings2, X } from 'lucide-react';
import { askNexus } from '../../services/grokService';

// ─────────────────────── constants ────────────────────────────────────────────
const DEFAULT_WORK = 25;
const DEFAULT_BREAK = 5;
const RADIUS = 88;
const CIRC = 2 * Math.PI * RADIUS;

// ─────────────────────── helpers ──────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

function playBeep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 520;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
    } catch { /* silent fail */ }
}

// ─────────────────────── component ────────────────────────────────────────────
const FocusTimer: React.FC = () => {
    const [mode, setMode] = useState<'work' | 'break'>('work');
    const [workMins, setWorkMins] = useState(DEFAULT_WORK);
    const [breakMins, setBreakMins] = useState(DEFAULT_BREAK);
    const [secondsLeft, setSecondsLeft] = useState(DEFAULT_WORK * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [taskLabel, setTaskLabel] = useState('');
    const [sessionCount, setSessionCount] = useState(0);
    const [streak, setStreak] = useState(1);
    const [aiTip, setAiTip] = useState<string | null>(null);
    const [loadingTip, setLoadingTip] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const totalSeconds = (mode === 'work' ? workMins : breakMins) * 60;
    const progress = (totalSeconds - secondsLeft) / totalSeconds;
    const dashOffset = CIRC * (1 - progress);
    const isWork = mode === 'work';

    // tick
    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setSecondsLeft(s => {
                    if (s <= 1) {
                        handleSessionEnd();
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isRunning, mode]);

    const handleSessionEnd = useCallback(() => {
        setIsRunning(false);
        playBeep();
        if (mode === 'work') {
            setSessionCount(c => c + 1);
            fetchAiTip();
            // switch to break after showing tip
            setTimeout(() => {
                setMode('break');
                setSecondsLeft(breakMins * 60);
            }, 500);
        } else {
            setMode('work');
            setSecondsLeft(workMins * 60);
        }
    }, [mode, workMins, breakMins, taskLabel]);

    const fetchAiTip = async () => {
        setLoadingTip(true);
        setAiTip(null);
        try {
            const label = taskLabel.trim() || 'a focus session';
            const tip = await askNexus(
                `You are a productivity coach. The user just completed a 25-minute Pomodoro session working on: "${label}". Give them ONE short (2–3 sentences max), practical and encouraging coaching tip to boost their performance in the next session. Be specific to their task. Do NOT use bullet points.`
            );
            setAiTip(tip);
        } catch {
            setAiTip('Great work completing that session! Take a short break and come back refreshed.');
        } finally {
            setLoadingTip(false);
        }
    };

    const reset = () => {
        setIsRunning(false);
        setSecondsLeft((mode === 'work' ? workMins : breakMins) * 60);
        setAiTip(null);
    };

    const applySettings = (w: number, b: number) => {
        setWorkMins(w);
        setBreakMins(b);
        setSecondsLeft(mode === 'work' ? w * 60 : b * 60);
        setIsRunning(false);
        setShowSettings(false);
    };

    const ringColor = isWork ? '#8b5cf6' : '#10b981';
    const ringBgColor = isWork ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)';

    return (
        <div className="h-full flex flex-col items-center justify-start pt-10 px-6 overflow-y-auto custom-scrollbar" style={{ color: 'var(--text)' }}>
            {/* Header */}
            <div className="w-full max-w-lg flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
                        <Timer size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Focus Timer</h1>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pomodoro · AI Coaching</p>
                    </div>
                </div>
                <button onClick={() => setShowSettings(v => !v)}
                    className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)', background: 'var(--card-bg)' }}>
                    {showSettings ? <X size={18} /> : <Settings2 size={18} />}
                </button>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="w-full max-w-lg rounded-2xl p-5 mb-6 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <SettingsPanel workMins={workMins} breakMins={breakMins} onApply={applySettings} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mode Toggle */}
            <div className="flex gap-1 p-1 rounded-xl mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {(['work', 'break'] as const).map(m => (
                    <button key={m} onClick={() => { setMode(m); setSecondsLeft((m === 'work' ? workMins : breakMins) * 60); setIsRunning(false); setAiTip(null); }}
                        className="px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                        style={{
                            background: mode === m ? (m === 'work' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)') : 'transparent',
                            color: mode === m ? (m === 'work' ? '#a78bfa' : '#34d399') : 'var(--text-muted)',
                        }}>
                        {m === 'work' ? '🎯 Focus' : '☕ Break'}
                    </button>
                ))}
            </div>

            {/* Ring */}
            <div className="relative mb-8" style={{ width: 220, height: 220 }}>
                <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="110" cy="110" r={RADIUS} fill="none" stroke={ringBgColor} strokeWidth="10" />
                    <circle cx="110" cy="110" r={RADIUS} fill="none" stroke={ringColor} strokeWidth="10"
                        strokeDasharray={CIRC} strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold font-mono tracking-tight" style={{ color: 'var(--text)' }}>
                        {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
                    </span>
                    <span className="mt-1 text-xs uppercase tracking-widest font-semibold" style={{ color: isWork ? '#a78bfa' : '#34d399' }}>
                        {isWork ? 'Focus' : 'Break'}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={reset} className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <RotateCcw size={16} />
                </button>
                <button onClick={() => setIsRunning(v => !v)}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
                    style={{ background: isWork ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)' : 'linear-gradient(135deg,#10b981,#059669)', boxShadow: `0 0 24px ${isWork ? 'rgba(139,92,246,0.4)' : 'rgba(16,185,129,0.4)'}` }}>
                    {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                </button>
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex flex-col items-center">
                        <Flame size={14} className="text-orange-400" />
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text)' }}>{sessionCount}</span>
                    </div>
                </div>
            </div>

            {/* Task Label */}
            <div className="w-full max-w-lg mb-6">
                <input
                    value={taskLabel}
                    onChange={e => setTaskLabel(e.target.value)}
                    placeholder="What are you working on? (e.g. 'Writing project proposal')"
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
            </div>

            {/* Stats Row */}
            <div className="flex gap-4 mb-6 w-full max-w-lg">
                {[
                    { label: 'Sessions Today', value: sessionCount, color: '#8b5cf6' },
                    { label: 'Streak', value: `${streak} day${streak !== 1 ? 's' : ''}`, color: '#f97316' },
                    { label: 'Focus Time', value: `${sessionCount * workMins} min`, color: '#10b981' },
                ].map(s => (
                    <div key={s.label} className="flex-1 rounded-xl p-3 text-center border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* AI Coaching Tip */}
            <AnimatePresence>
                {(loadingTip || aiTip) && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="w-full max-w-lg rounded-2xl p-5 border mb-6"
                        style={{ background: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.25)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={15} className="text-violet-400" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">AI Coach</span>
                        </div>
                        {loadingTip ? (
                            <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                <div className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
                                <span className="text-sm">Generating your coaching tip…</span>
                            </div>
                        ) : (
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{aiTip}</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─────────────────────── Settings sub-component ───────────────────────────────
const SettingsPanel: React.FC<{ workMins: number; breakMins: number; onApply: (w: number, b: number) => void }> = ({ workMins, breakMins, onApply }) => {
    const [w, setW] = useState(workMins);
    const [b, setB] = useState(breakMins);
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Timer Settings</h3>
            <div className="grid grid-cols-2 gap-4">
                {[{ label: 'Focus (min)', val: w, set: setW, min: 5, max: 90 }, { label: 'Break (min)', val: b, set: setB, min: 1, max: 30 }].map(f => (
                    <div key={f.label} className="space-y-1">
                        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                        <input type="number" value={f.val} min={f.min} max={f.max}
                            onChange={e => f.set(Math.max(f.min, Math.min(f.max, Number(e.target.value))))}
                            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                ))}
            </div>
            <button onClick={() => onApply(w, b)}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
                Apply Settings
            </button>
        </div>
    );
};

export default FocusTimer;
