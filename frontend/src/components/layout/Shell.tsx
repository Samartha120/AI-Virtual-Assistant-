import * as React from 'react';
import Sidebar from './Sidebar';
import { CommandPalette } from '../shared/CommandPalette';
import { useStore } from '../../store/useStore';

interface ShellProps {
    children: React.ReactNode;
}

const Shell: React.FC<ShellProps> = ({ children }) => {
    const { currentView, setCurrentView } = useStore();

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-white selection:bg-primary/30">
            <Sidebar activeView={currentView} onViewChange={setCurrentView} />
            <main className="flex-1 relative overflow-hidden flex flex-col">
                {/* Background Gradients/Effects */}
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
                </div>

                {/* Content — each feature controls its own scroll & padding */}
                <div className="flex-1 overflow-hidden relative z-10">
                    {children}
                </div>
            </main>
            <CommandPalette />
        </div>
    );
};

export default Shell;
