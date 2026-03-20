import * as React from 'react';
import Sidebar from './Sidebar';
import { CommandPalette } from '../shared/CommandPalette';

interface ShellProps {
    children: React.ReactNode;
}

const Shell: React.FC<ShellProps> = ({ children }) => {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-text-primary selection:bg-primary/20">
            <Sidebar />
            <main className="flex-1 relative overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative">
                    <div className="relative z-10 max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </div>
            </main>
            <CommandPalette />
        </div>
    );
};

export default Shell;
