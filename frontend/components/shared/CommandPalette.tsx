import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search, Settings, User, FileText, Zap, MessageSquare, LayoutDashboard } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AppView } from '../../types';

export const CommandPalette = () => {
    const [open, setOpen] = useState(false);
    const { setCurrentView } = useStore();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-background/90 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
                <Command className="w-full bg-transparent text-white">
                    <div className="flex items-center border-b border-white/10 px-4" cmdk-input-wrapper="">
                        <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
                        <Command.Input
                            placeholder="Type a command or search..."
                            className="flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    <Command.List className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2">
                        <Command.Empty className="py-6 text-center text-sm text-gray-500">
                            No results found.
                        </Command.Empty>

                        <Command.Group heading="Navigation" className="text-gray-400 text-xs font-semibold px-2 py-1.5 uppercase tracking-wider">
                            <CommandItem
                                icon={<LayoutDashboard className="mr-2 h-4 w-4" />}
                                label="Dashboard"
                                onSelect={() => runCommand(() => setCurrentView(AppView.DASHBOARD))}
                            />
                            <CommandItem
                                icon={<MessageSquare className="mr-2 h-4 w-4" />}
                                label="Neural Chat"
                                onSelect={() => runCommand(() => setCurrentView(AppView.CHAT))}
                            />
                            <CommandItem
                                icon={<FileText className="mr-2 h-4 w-4" />}
                                label="Document Analyzer"
                                onSelect={() => runCommand(() => setCurrentView(AppView.DOC_ANALYZER))}
                            />
                            <CommandItem
                                icon={<Zap className="mr-2 h-4 w-4" />}
                                label="Brainstormer"
                                onSelect={() => runCommand(() => setCurrentView(AppView.BRAINSTORMER))}
                            />
                        </Command.Group>

                        <Command.Group heading="Actions" className="text-gray-400 text-xs font-semibold px-2 py-1.5 uppercase tracking-wider mt-2">
                            <CommandItem
                                icon={<Settings className="mr-2 h-4 w-4" />}
                                label="Settings"
                                onSelect={() => runCommand(() => setCurrentView(AppView.SETTINGS))}
                            />
                            <CommandItem
                                icon={<User className="mr-2 h-4 w-4" />}
                                label="Profile"
                                onSelect={() => runCommand(() => console.log('Profile'))}
                            />
                        </Command.Group>
                    </Command.List>

                    <div className="border-t border-white/10 px-4 py-2 text-xs text-gray-500 flex justify-between items-center">
                        <span>Pro Tip: Use <kbd className="font-sans bg-white/10 px-1 rounded">↑</kbd> <kbd className="font-sans bg-white/10 px-1 rounded">↓</kbd> to navigate</span>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1"><kbd className="font-sans bg-white/10 px-1 rounded">↵</kbd> to select</span>
                            <span className="flex items-center gap-1"><kbd className="font-sans bg-white/10 px-1 rounded">esc</kbd> to close</span>
                        </div>
                    </div>
                </Command>
            </div>
        </div>
    );
};

const CommandItem = ({ icon, label, onSelect }: { icon: React.ReactNode, label: string, onSelect: () => void }) => {
    return (
        <Command.Item
            onSelect={onSelect}
            className="flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm text-gray-300 outline-none hover:bg-white/10 hover:text-white aria-selected:bg-white/10 aria-selected:text-white transition-colors duration-150 group"
        >
            <div className="flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/5 group-hover:border-primary/50 group-hover:bg-primary/20 group-aria-selected:border-primary/50 group-aria-selected:bg-primary/20 mr-3 transition-colors">
                {icon}
            </div>
            <span>{label}</span>
        </Command.Item>
    );
};
