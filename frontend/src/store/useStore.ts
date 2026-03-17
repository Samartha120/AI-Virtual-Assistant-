import { create } from 'zustand';
import { AppView } from '../types';
import { api } from '../services/apiClient';

interface AppState {
    currentView: AppView;
    isSidebarOpen: boolean;
    theme: 'dark' | 'light';
    aiModel: string;
    notificationsEnabled: boolean;
    isLoadingSettings: boolean;
    setCurrentView: (view: AppView) => void;
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
    setAiModel: (model: string) => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    fetchSettings: () => Promise<void>;
    saveSettings: (settings: any) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    currentView: AppView.DASHBOARD,
    isSidebarOpen: true,
    theme: 'dark',
    aiModel: 'grok-2-latest',
    notificationsEnabled: true,
    isLoadingSettings: false,
    setCurrentView: (view) => set({ currentView: view }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setTheme: (theme) => set({ theme }),
    setAiModel: (aiModel) => set({ aiModel }),
    setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),

    fetchSettings: async () => {
        try {
            set({ isLoadingSettings: true });
            const response = await api.get<any>('/api/settings');
            if (response && response.data) {
                const s = response.data;
                set({
                    theme: s.theme || 'dark',
                    aiModel: s.ai_model || 'grok-2-latest',
                    notificationsEnabled: s.notifications ?? true
                });
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            set({ isLoadingSettings: false });
        }
    },

    saveSettings: async (newSettings: any) => {
        try {
            const currentSettings = {
                theme: get().theme,
                ai_model: get().aiModel,
                notifications: get().notificationsEnabled,
                ...newSettings
            };
            await api.put<any>('/api/settings', currentSettings);
            // Updating local state automatically handled by setting state passed to function, or explicit updates if needed
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    }
}));

