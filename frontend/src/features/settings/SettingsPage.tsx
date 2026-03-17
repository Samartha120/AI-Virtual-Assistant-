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
    Loader2
} from 'lucide-react';
import { NeuralAvatar } from '../../components/ui/NeuralAvatar';

const SettingsPage: React.FC = () => {
    console.log("SettingsPage component mounting/rendering");
    const {
        theme, setTheme, aiModel, setAiModel, notificationsEnabled, setNotificationsEnabled,
        fetchSettings, saveSettings, isLoadingSettings
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
                        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                        <p className="text-gray-400 mt-1">Manage your NexusAI preferences and configurations.</p>
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
                                    className={`w-full flex items-center p-3 rounded-xl transition-all ${isActive
                                        ? 'bg-white/10 text-white border border-white/10 shadow-lg'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        }`}
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
                            className="bg-surface/30 backdrop-blur-xl border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl"
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
                                                defaultValue="Nexus User"
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-400">Email Address</label>
                                            <input
                                                type="email"
                                                defaultValue="user@nexusai.enterprise"
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* APPEARANCE TAB */}
                            {activeTab === 'appearance' && (
                                <div className="space-y-6">
                                    <h2 className="text-xl font-semibold mb-4 border-b border-white/5 pb-4">Appearance</h2>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium text-gray-400">Theme Preference</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setTheme('dark')}
                                                className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-3 transition-all ${theme === 'dark' ? 'bg-primary/10 border-primary text-white' : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                                                    }`}
                                            >
                                                <Moon size={24} className={theme === 'dark' ? 'text-primary' : ''} />
                                                <span className="font-medium text-sm">Dark Mode</span>
                                            </button>
                                            <button
                                                onClick={() => setTheme('light')}
                                                className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-3 transition-all ${theme === 'light' ? 'bg-primary/10 border-primary text-white' : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                                                    }`}
                                            >
                                                <Sun size={24} className={theme === 'light' ? 'text-primary' : ''} />
                                                <span className="font-medium text-sm">Light Mode</span>
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
                                                { id: 'grok-2-latest', name: 'Grok 2 Latest', desc: 'Most capable model by xAI.' },
                                                { id: 'grok-beta', name: 'Grok Beta', desc: 'Fastest for general queries.' },
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
