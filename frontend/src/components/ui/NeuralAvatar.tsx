import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from './Button';

type AvatarState = 'idle' | 'thinking' | 'talking';

interface NeuralAvatarProps {
    state?: AvatarState;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export const NeuralAvatar: React.FC<NeuralAvatarProps> = ({
    state = 'idle',
    size = 'md',
    className
}) => {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24'
    };

    const layers = [
        { delay: 0, duration: 3, scale: [1, 1.2, 1] },
        { delay: 0.5, duration: 4, scale: [1.1, 1.3, 1.1] },
        { delay: 1, duration: 5, scale: [0.9, 1.1, 0.9] },
    ];

    return (
        <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
            {/* Core */}
            <motion.div
                className="absolute w-[40%] h-[40%] bg-white rounded-full z-10 box-shadow-glow"
                animate={{
                    scale: state === 'thinking' ? [1, 0.8, 1.2, 0.9, 1] : [1, 1.05, 1],
                    opacity: state === 'talking' ? [1, 0.7, 1] : 1,
                }}
                transition={{
                    duration: state === 'thinking' ? 0.5 : 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />

            {/* Orbitals/Glows */}
            {layers.map((layer, i) => (
                <motion.div
                    key={i}
                    className={cn(
                        "absolute inset-0 rounded-full border border-primary/30",
                        state === 'thinking' && "border-blue-500/50",
                        state === 'talking' && "border-emerald-500/50",
                    )}
                    style={{
                        background: state === 'idle'
                            ? 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)'
                            : 'transparent'
                    }}
                    animate={{
                        rotate: state === 'thinking' ? 360 : 0,
                        scale: state === 'thinking' ? [1, 1.5, 0.5, 1] : layer.scale,
                    }}
                    transition={{
                        rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                        scale: { duration: state === 'thinking' ? 2 : layer.duration, repeat: Infinity, ease: "easeInOut", delay: layer.delay }
                    }}
                />
            ))}

            {/* Particles (Only when thinking/talking) */}
            {(state === 'thinking' || state === 'talking') && (
                <>
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={`p-${i}`}
                            className="absolute w-1 h-1 bg-white rounded-full"
                            animate={{
                                x: [0, (i % 2 === 0 ? 1 : -1) * 20, 0],
                                y: [0, (i % 2 === 0 ? -1 : 1) * 20, 0],
                                opacity: [0, 1, 0]
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.2
                            }}
                        />
                    ))}
                </>
            )}
        </div>
    );
};
