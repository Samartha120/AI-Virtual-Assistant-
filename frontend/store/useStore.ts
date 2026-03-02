import { create } from 'zustand';
import { AppView } from '../types';
import { api } from '../services/apiClient';

interface AppState {
    currentView: AppView;
    isSidebarOpen: boolean;
    theme: 'dark' | 'light';
    aiModel: string;
    notificationsEnabled: boolean;
    isAuthenticated: boolean;
    user: any | null;
    isLoadingSettings: boolean;
    setCurrentView: (view: AppView) => void;
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
    login: (user: any) => void;
    logout: () => void;
    setAiModel: (model: string) => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    fetchSettings: () => Promise<void>;
    saveSettings: (settings: any) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    currentView: AppView.DASHBOARD,
    isSidebarOpen: true,
    theme: 'dark',
    aiModel: 'gemini-1.5-pro',
    notificationsEnabled: true,
    isLoadingSettings: false,
    isAuthenticated: false,
    user: null,
    setCurrentView: (view) => set({ currentView: view }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        // Ensure color scheme corresponds
        document.documentElement.style.colorScheme = theme;
    },
    login: (user) => set({ isAuthenticated: true, user }),
    logout: () => set({ isAuthenticated: false, user: null }),
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
                    aiModel: s.ai_model || 'gemini-1.5-pro',
                    notificationsEnabled: s.notifications ?? true
                });
                // Apply theme immediately after fetching
                const fetchedTheme = s.theme || 'dark';
                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add(fetchedTheme);
                document.documentElement.style.colorScheme = fetchedTheme;
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

