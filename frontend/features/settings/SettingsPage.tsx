import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { motion } from 'framer-motion';
import {
    User,
    Settings,
    Bell,
    Shield,
    Cpu,
    Moon,
    Sun,
    Save,
    CheckCircle2,
    Loader2,
    LogOut,
    Plus,
    X,
    Users
} from 'lucide-react';
import { NeuralAvatar } from '../../components/ui/NeuralAvatar';

const SettingsPage: React.FC = () => {
    console.log("SettingsPage component mounting/rendering");
    const {
        theme, setTheme, aiModel, setAiModel, notificationsEnabled, setNotificationsEnabled,
        fetchSettings, saveSettings, isLoadingSettings, user,
        knownAccounts, removeKnownAccount, setTargetSwitchEmail, logout
    } = useStore();

    const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'ai' | 'notifications'>('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        console.log("SettingsPage useEffect triggered, calling fetchSettings");
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveSettings({
                theme,
                ai_model: aiModel,
                notifications: notificationsEnabled
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save", error);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'appearance', label: 'Appearance', icon: Moon },
        { id: 'ai', label: 'AI Configuration', icon: Cpu },
        { id: 'notifications', label: 'Notifications', icon: Bell },
    ];

    if (isLoadingSettings) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col pt-20 px-4 md:px-8 pb-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl w-full mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Settings</h1>
                        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Manage your NexusAI preferences and configurations.</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                        ) : saveSuccess ? (
                            <CheckCircle2 size={18} className="mr-2 text-emerald-400" />
                        ) : (
                            <Save size={18} className="mr-2" />
                        )}
                        {saveSuccess ? 'Saved' : 'Save Changes'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                    {/* Sidebar Tabs */}
                    <div className="col-span-1 space-y-2">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className="w-full flex items-center p-3 rounded-xl transition-all"
                                    style={{
                                        background: isActive ? 'var(--card-hover)' : 'transparent',
                                        border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                                        color: isActive ? 'var(--text)' : 'var(--text-muted)',
                                    }}
                                >
                                    <tab.icon size={18} className={`mr-3 ${isActive ? 'text-primary' : ''}`} />
                                    <span className="font-medium text-sm">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Settings Content area */}
                    <div className="col-span-1 md:col-span-3">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-2xl p-6 md:p-8 shadow-2xl"
                            style={{
                                backgroundColor: 'var(--surface)',
                                border: '1px solid var(--border)',
                            }}
                        >

                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <h2 className="text-xl font-semibold mb-4 border-b border-white/5 pb-4">Profile Information</h2>

                                    <div className="flex items-center space-x-6">
                                        <NeuralAvatar state="idle" size="lg" />
                                        <div>
                                            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors">
                                                Change Avatar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-400">Display Name</label>
                                            <input
                                                type="text"
                                                readOnly
                                                disabled
                                                defaultValue={user?.user_metadata?.full_name || 'Nexus User'}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-400">Email Address</label>
                                            <input
                                                type="email"
                                                readOnly
                                                disabled
                                                defaultValue={user?.email || 'user@nexusai.enterprise'}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-8 mt-8 border-t border-white/5">
                                        <h2 className="text-xl font-semibold mb-4">Switch Accounts</h2>
                                        <p className="text-sm text-gray-400 mb-6">Quickly switch between saved accounts on this device.</p>
                                        
                                        <div className="space-y-3">
                                            {knownAccounts.map((account: any) => (
                                                <div key={account.email} className="flex items-center justify-between p-4 bg-black/20 border border-white/10 rounded-xl hover:bg-white/5 transition-colors group">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                                            {account.photoURL ? (
                                                                <img src={account.photoURL} alt={account.displayName || ''} className="w-full h-full rounded-full object-cover" />
                                                            ) : (
                                                                <User size={20} className="text-primary" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-white flex items-center gap-2">
                                                                {account.displayName || 'Nexus User'}
                                                                {user?.email === account.email && (
                                                                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Active</span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-gray-400">{account.email}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {user?.email !== account.email && (
                                                            <button 
                                                                onClick={() => {
                                                                    setTargetSwitchEmail(account.email);
                                                                    logout();
                                                                }}
                                                                className="px-3 py-1.5 flex items-center text-sm bg-white/5 hover:bg-primary/20 text-gray-300 hover:text-primary rounded-lg transition-colors border border-white/5 hover:border-primary/30"
                                                            >
                                                                <LogOut size={14} className="mr-2" />
                                                                Switch
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => removeKnownAccount(account.email)}
                                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                            title="Remove account from device"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <button 
                                                onClick={() => logout()}
                                                className="w-full flex items-center justify-center p-4 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/40 transition-all gap-2"
                                            >
                                                <Plus size={18} />
                                                <span>Add another account</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* APPEARANCE TAB */}
                            {activeTab === 'appearance' && (
                                <div className="space-y-8">
                                    <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Appearance</h2>
                                    <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Choose how Nexus looks on your device. Changes apply instantly.</p>

                                    <div className="space-y-3">
                                        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>Theme</h3>
                                        <div className="grid grid-cols-2 gap-5">

                                            {/* ── DARK MODE CARD ── */}
                                            <button
                                                onClick={() => setTheme('dark')}
                                                className="relative group rounded-2xl overflow-hidden focus:outline-none"
                                                style={{
                                                    border: theme === 'dark' ? '2px solid #8b5cf6' : '2px solid var(--border)',
                                                    boxShadow: theme === 'dark' ? '0 0 0 4px rgba(139,92,246,0.18), 0 8px 32px rgba(0,0,0,0.45)' : 'none',
                                                    transition: 'all 0.25s ease',
                                                }}
                                            >
                                                {/* Selected badge */}
                                                {theme === 'dark' && (
                                                    <span className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                    </span>
                                                )}
                                                {/* Mini dark-UI preview */}
                                                <div className="flex h-28 bg-background rounded-t-2xl overflow-hidden">
                                                    {/* Sidebar strip */}
                                                    <div className="w-10 bg-[#111114] flex flex-col items-center pt-3 gap-2 border-r border-white/5">
                                                        <div className="w-5 h-5 rounded bg-primary/60" />
                                                        {[...Array(4)].map((_, i) => (
                                                            <div key={i} className="w-5 h-1.5 rounded-full bg-white/10" />
                                                        ))}
                                                    </div>
                                                    {/* Content */}
                                                    <div className="flex-1 p-3 space-y-2">
                                                        <div className="w-2/3 h-2 rounded-full bg-white/20" />
                                                        <div className="w-full h-10 rounded-xl bg-white/5 border border-white/8" />
                                                        <div className="flex gap-2">
                                                            <div className="flex-1 h-8 rounded-lg bg-white/5 border border-white/8" />
                                                            <div className="flex-1 h-8 rounded-lg bg-primary/20 border border-primary/30" />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Label */}
                                                <div className="bg-surface px-4 py-2.5 flex items-center gap-2 border-t border-white/5">
                                                    <Moon size={14} className="text-primary" />
                                                    <span className="text-sm font-semibold text-white">Dark Mode</span>
                                                </div>
                                            </button>

                                            {/* ── LIGHT MODE CARD ── */}
                                            <button
                                                onClick={() => setTheme('light')}
                                                className="relative group rounded-2xl overflow-hidden focus:outline-none"
                                                style={{
                                                    border: theme === 'light' ? '2px solid #8b5cf6' : '2px solid var(--border)',
                                                    boxShadow: theme === 'light' ? '0 0 0 4px rgba(139,92,246,0.18), 0 8px 32px rgba(0,0,0,0.2)' : 'none',
                                                    transition: 'all 0.25s ease',
                                                }}
                                            >
                                                {/* Selected badge */}
                                                {theme === 'light' && (
                                                    <span className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                    </span>
                                                )}
                                                {/* Mini light-UI preview */}
                                                <div className="flex h-28 bg-[#f4f5f7] rounded-t-2xl overflow-hidden">
                                                    {/* Sidebar strip */}
                                                    <div className="w-10 bg-white flex flex-col items-center pt-3 gap-2 border-r border-black/8">
                                                        <div className="w-5 h-5 rounded bg-primary/70" />
                                                        {[...Array(4)].map((_, i) => (
                                                            <div key={i} className="w-5 h-1.5 rounded-full bg-black/10" />
                                                        ))}
                                                    </div>
                                                    {/* Content */}
                                                    <div className="flex-1 p-3 space-y-2">
                                                        <div className="w-2/3 h-2 rounded-full bg-black/20" />
                                                        <div className="w-full h-10 rounded-xl bg-white border border-black/8 shadow-sm" />
                                                        <div className="flex gap-2">
                                                            <div className="flex-1 h-8 rounded-lg bg-white border border-black/8 shadow-sm" />
                                                            <div className="flex-1 h-8 rounded-lg bg-primary/15 border border-primary/25" />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Label */}
                                                <div className="bg-white px-4 py-2.5 flex items-center gap-2 border-t border-black/8">
                                                    <Sun size={14} className="text-amber-500" />
                                                    <span className="text-sm font-semibold text-gray-800">Light Mode</span>
                                                </div>
                                            </button>

                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI CONFIGURATION TAB */}
                            {activeTab === 'ai' && (
                                <div className="space-y-6">
                                    <h2 className="text-xl font-semibold mb-4 border-b border-white/5 pb-4">AI Configuration</h2>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium text-gray-400">Default Model</h3>
                                        <div className="space-y-3">
                                            {[
                                                { id: 'nexus-pro', name: 'Nexus Pro', desc: 'Most capable, best for complex tasks.' },
                                                { id: 'nexus-flash', name: 'Nexus Flash', desc: 'Fastest, best for high-frequency queries.' },
                                            ].map(model => (
                                                <div
                                                    key={model.id}
                                                    onClick={() => setAiModel(model.id)}
                                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start space-x-4 ${aiModel === model.id ? 'bg-primary/10 border-primary/50' : 'bg-black/20 border-white/10 hover:bg-white/5'
                                                        }`}
                                                >
                                                    <div className={`mt-1 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${aiModel === model.id ? 'border-primary' : 'border-gray-500'
                                                        }`}>
                                                        {aiModel === model.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-medium ${aiModel === model.id ? 'text-white' : 'text-gray-300'}`}>{model.name}</h4>
                                                        <p className="text-sm text-gray-400 mt-1">{model.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* NOTIFICATIONS TAB */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-6">
                                    <h2 className="text-xl font-semibold mb-4 border-b border-white/5 pb-4">Notifications</h2>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-black/20 border border-white/10 rounded-xl">
                                            <div>
                                                <h4 className="font-medium text-white">System Notifications</h4>
                                                <p className="text-sm text-gray-400 mt-1">Receive alerts for system updates and task completions.</p>
                                            </div>
                                            <button
                                                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-primary' : 'bg-gray-600'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
