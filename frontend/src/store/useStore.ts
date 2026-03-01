import { create } from 'zustand';
import { AppView } from '../types';

interface AppState {
    currentView: AppView;
    isSidebarOpen: boolean;
    theme: 'dark' | 'light';
    setCurrentView: (view: AppView) => void;
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
}

export const useStore = create<AppState>((set) => ({
    currentView: AppView.DASHBOARD,
    isSidebarOpen: true,
    theme: 'dark',
    setCurrentView: (view) => set({ currentView: view }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setTheme: (theme) => set({ theme }),
}));
