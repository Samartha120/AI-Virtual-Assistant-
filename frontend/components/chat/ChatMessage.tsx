import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { cn } from '../ui/Button';

interface ChatMessageProps {
    role: 'user' | 'model';
    content: string;
    isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, isStreaming }) => {
    const isUser = role === 'user';

    return (
        <div className={cn(
            "flex w-full gap-4 p-6",
            isUser ? "flex-row-reverse" : "flex-row"
        )}>
            {/* Avatar */}
            <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                isUser
                    ? "bg-primary/5 border-primary/10 text-primary"
                    : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500"
            )}>
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            {/* Content */}
            <div className={cn(
                "flex-1 space-y-2 overflow-hidden",
                isUser ? "text-right" : "text-left"
            )}>
                <div className={cn(
                    "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%]",
                    isUser
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface border border-border text-text-primary"
                )}>
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{content}</p>
                    ) : (
                        <ReactMarkdown
                            children={content}
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                a: ({ node, ...props }) => <a className="text-primary hover:underline" {...props} />,
                                code: ({ node, inline, className, children, ...props }: any) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <pre className="bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        </pre>
                                    ) : (
                                        <code className="bg-gray-700 text-white px-1 py-0.5 rounded-sm" {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                        </ReactMarkdown>
                    )}
                    {isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary/50 animate-pulse" />
                    )}
                </div>
            </div>
        </div>
    );
};
