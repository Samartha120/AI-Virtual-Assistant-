'use client';

import { create } from 'zustand';
import { api } from '../services/apiClient';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth as firebaseAuth } from '../lib/firebaseClient';
import { logSystemEvent } from '../services/interactionService';

interface AppState {
    isSidebarOpen: boolean;
    theme: 'dark' | 'light';
    aiModel: string;
    notificationsEnabled: boolean;
    isAuthenticated: boolean;
    isVerified: boolean;
    isAuthLoading: boolean;
    user: any | null;
    isLoadingSettings: boolean;
    knownAccounts: any[];
    targetSwitchEmail: string | null;
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
    login: (user: any, token: string, isSignUp?: boolean) => void;
    logout: () => void;
    initAuthListener: () => () => void;
    setVerificationComplete: (verified: boolean) => void;
    setAiModel: (model: string) => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    fetchSettings: () => Promise<void>;
    saveSettings: (settings: any) => Promise<void>;
    addKnownAccount: (account: any) => void;
    removeKnownAccount: (email: string) => void;
    setTargetSwitchEmail: (email: string | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
    isSidebarOpen: true,
    theme: 'dark',
    aiModel: 'grok-2-latest',
    notificationsEnabled: true,
    isLoadingSettings: false,
    isAuthenticated: false,
    isVerified: false,
    isAuthLoading: true,
    user: null,
    knownAccounts: (() => {
        if (typeof window === 'undefined') return [];
        try {
            return JSON.parse(window.localStorage.getItem('nexus-known-accounts') || '[]');
        } catch {
            return [];
        }
    })(),
    targetSwitchEmail: null,
    initAuthListener: () => {
        if (!firebaseAuth) {
            // Frontend env is missing or Firebase failed to init.
            // Don't crash the whole UI; allow /login to render a setup hint.
            set({ isAuthenticated: false, isVerified: false, isAuthLoading: false, user: null });
            return () => undefined;
        }

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user: User | null) => {
            if (!user) {
                localStorage.removeItem('firebase-id-token');
                set({ isAuthenticated: false, isVerified: false, isAuthLoading: false, user: null });
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
                isAuthLoading: false,
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

        // Update known accounts
        if (user && user.email) {
            const currentAccounts = get().knownAccounts;
            const existingIndex = currentAccounts.findIndex(a => a.email === user.email);
            let newAccounts = [...currentAccounts];
            const accountData = {
                email: user.email,
                displayName: user.displayName || null,
                photoURL: user.photoURL || null
            };
            if (existingIndex >= 0) {
                newAccounts[existingIndex] = accountData;
            } else {
                newAccounts.push(accountData);
            }
            localStorage.setItem('nexus-known-accounts', JSON.stringify(newAccounts));
            set({ knownAccounts: newAccounts });
        }

        // Apply persisted theme immediately so dashboard loads in the correct mode
        const savedTheme = (localStorage.getItem('nexus-theme') as 'dark' | 'light') || 'dark';
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(savedTheme);
        document.documentElement.style.colorScheme = savedTheme;
        set({ isAuthenticated: true, isVerified: Boolean(user?.emailVerified) || Boolean(user?.phoneNumber), user, theme: savedTheme });
    },
    setVerificationComplete: (verified) => {
        set({ isVerified: verified });
    },
    logout: () => {
        // Fire-and-forget audit log
        logSystemEvent({ type: 'auth', action: 'USER_LOGOUT' });

        localStorage.removeItem('firebase-id-token');
        if (firebaseAuth) {
            signOut(firebaseAuth).catch(() => undefined);
        }
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
                    aiModel: s.ai_model || 'grok-2-latest',
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
    },
    addKnownAccount: (account) => {
        const currentAccounts = get().knownAccounts;
        if (!currentAccounts.find(a => a.email === account.email)) {
            const newAccounts = [...currentAccounts, account];
            localStorage.setItem('nexus-known-accounts', JSON.stringify(newAccounts));
            set({ knownAccounts: newAccounts });
        }
    },
    removeKnownAccount: (email) => {
        const newAccounts = get().knownAccounts.filter(a => a.email !== email);
        localStorage.setItem('nexus-known-accounts', JSON.stringify(newAccounts));
        set({ knownAccounts: newAccounts });
    },
    setTargetSwitchEmail: (email) => set({ targetSwitchEmail: email })
}));

