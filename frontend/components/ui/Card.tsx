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
                    'glass-card p-6',
                    hoverEffect && 'hover:-translate-y-1',
                    className
                )}
                {...props}
            />
        );
    }
);

Card.displayName = 'Card';
