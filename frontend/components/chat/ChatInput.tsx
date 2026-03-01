import React, { useRef, useState } from 'react';
import { Send, Mic, Paperclip, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading?: boolean;
}

const CONTEXT_CHIPS = [
    { id: 'project-alpha', label: 'Project Alpha' },
    { id: 'q3-report', label: 'Q3 Financials' },
    { id: 'dev-docs', label: 'Dev Documentation' },
];

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
    const [input, setInput] = useState('');
    const [activeContexts, setActiveContexts] = useState<string[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (!input.trim() || isLoading) return;
        onSend(input);
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const toggleContext = (id: string) => {
        setActiveContexts(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    return (
        <div className="border-t border-white/10 bg-[#0f1115]/80 backdrop-blur-xl p-4 md:p-6 pb-8">
            <div className="mx-auto max-w-3xl space-y-4">
                {/* Context Chips */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {CONTEXT_CHIPS.map(chip => (
                        <button
                            key={chip.id}
                            onClick={() => toggleContext(chip.id)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${activeContexts.includes(chip.id)
                                    ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            {chip.label}
                            {activeContexts.includes(chip.id) && <X className="h-3 w-3" />}
                        </button>
                    ))}
                </div>

                {/* Input Area */}
                <div className="relative rounded-xl border border-white/10 bg-white/5 p-2 focus-within:ring-2 focus-within:ring-primary/50">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Nexus anything..."
                        rows={1}
                        className="w-full resize-none bg-transparent px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none max-h-[200px]"
                    />

                    <div className="flex items-center justify-between px-2 pb-1 pt-2">
                        <div className="flex gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400">
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400">
                                <Mic className="h-4 w-4" />
                            </Button>
                        </div>

                        <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="h-8 px-4"
                        >
                            Send <Send className="ml-2 h-3 w-3" />
                        </Button>
                    </div>
                </div>

                <div className="text-center text-xs text-gray-500">
                    NexusAI can make mistakes. Verify important information.
                </div>
            </div>
        </div>
    );
};
