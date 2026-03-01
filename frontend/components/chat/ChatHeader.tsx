import * as React from 'react';
import { Brain, Sparkles, Zap, BarChart3, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { NeuralAvatar } from '../ui/NeuralAvatar';

interface ChatHeaderProps {
    modelName?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ modelName = 'Nexus-2.0-Flash' }) => {
    return (
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/10 bg-[#0f1115]/80 px-6 backdrop-blur-xl">
            <div className="flex items-center gap-3">
                <NeuralAvatar state="idle" size="sm" />
                <h2 className="text-lg font-semibold text-white">Neural Chat</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                    {modelName}
                </span>
            </div>

            <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="gap-2 text-xs h-8">
                    <Brain className="h-3 w-3 text-primary" />
                    <span>Thinking</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </div>
        </div>
    );
};
