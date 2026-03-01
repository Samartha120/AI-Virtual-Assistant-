import * as React from 'react';
import { cn } from './Button';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'error';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: 'bg-primary/10 text-primary border-primary/20',
            outline: 'border border-white/20 text-gray-400',
            success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            error: 'bg-red-500/10 text-red-400 border-red-500/20',
        };

        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    variants[variant],
                    className
                )}
                {...props}
            />
        );
    }
);

Badge.displayName = 'Badge';
