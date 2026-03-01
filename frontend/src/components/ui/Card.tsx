import * as React from 'react';
import { cn } from './Button';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, hoverEffect = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'glass rounded-xl border border-white/5 bg-surface/50 p-6',
                    hoverEffect && 'transition-all duration-300 hover:bg-white/5 hover:border-white/10 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1',
                    className
                )}
                {...props}
            />
        );
    }
);

Card.displayName = 'Card';
