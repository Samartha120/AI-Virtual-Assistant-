import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { cn } from '../ui/Button';

interface ChatMessageProps {
    role: 'user' | 'model';
    content: string;
    isStreaming?: boolean;
    notice?: string | null;
    provider?: string | null;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, isStreaming, notice }) => {
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
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
            )}>
                {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </div>

            {/* Content */}
            <div className={cn(
                "flex-1 space-y-2 overflow-hidden",
                isUser ? "text-right" : "text-left"
            )}>
                {!isUser && notice ? (
                    <div className="text-xs text-gray-400">
                        {notice}
                    </div>
                ) : null}
                <div className={cn(
                    "inline-block rounded-2xl px-5 py-3 text-sm leading-relaxed max-w-[85%]",
                    isUser
                        ? "bg-primary text-white"
                        : "glass border border-white/10 text-gray-100"
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
