import { create } from 'zustand';
import { AppView } from '../types';
import { api } from '../services/apiClient';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth as firebaseAuth } from '../lib/firebaseClient';

interface AppState {
    currentView: AppView;
    isSidebarOpen: boolean;
    theme: 'dark' | 'light';
    aiModel: string;
    notificationsEnabled: boolean;
    isAuthenticated: boolean;
    isVerified: boolean;
    user: any | null;
    isLoadingSettings: boolean;
    setCurrentView: (view: AppView) => void;
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
    login: (user: any, token: string) => void;
    logout: () => void;
    initAuthListener: () => () => void;
    setVerificationComplete: (verified: boolean) => void;
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
    isVerified: false,
    user: null,
    initAuthListener: () => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user: User | null) => {
            if (!user) {
                localStorage.removeItem('firebase-id-token');
                set({ isAuthenticated: false, isVerified: false, user: null });
                return;
            }

            try {
                const token = await user.getIdToken();
                localStorage.setItem('firebase-id-token', token);
            } catch {
                // Token refresh failures should not crash the UI
            }

            set({
                isAuthenticated: true,
                isVerified: user.emailVerified || Boolean(user.phoneNumber),
                user: {
                    id: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    phoneNumber: user.phoneNumber,
                },
            });
        });

        return unsubscribe;
    },
    setCurrentView: (view) => set({ currentView: view }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        document.documentElement.style.colorScheme = theme;
        localStorage.setItem('nexus-theme', theme);
    },
    login: (user, token) => {
        if (token) localStorage.setItem('firebase-id-token', token);
        // Apply persisted theme immediately so dashboard loads in the correct mode
        const savedTheme = (localStorage.getItem('nexus-theme') as 'dark' | 'light') || 'dark';
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(savedTheme);
        document.documentElement.style.colorScheme = savedTheme;
        set({ isAuthenticated: true, isVerified: Boolean(user?.emailVerified) || Boolean(user?.phoneNumber), user, theme: savedTheme });
    },
    setVerificationComplete: (verified) => set({ isVerified: verified }),
    logout: () => {
        localStorage.removeItem('firebase-id-token');
        signOut(firebaseAuth).catch(() => undefined);
        set({ isAuthenticated: false, isVerified: false, user: null });
    },
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

