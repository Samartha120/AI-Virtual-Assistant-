import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, MoreVertical, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { Task } from '../../types';
import { Badge } from '../ui/Badge';
import { cn } from '../ui/Button';

interface TaskCardProps {
    task: Task;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, data: { task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const priorityColor = {
        low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="h-[120px] w-full rounded-xl border-2 border-primary/50 bg-[#0f1115]/50 opacity-40"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="group relative flex flex-col gap-3 rounded-xl border border-white/5 bg-surface/50 p-4 shadow-sm hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-grab active:cursor-grabbing"
        >
            <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-gray-200 line-clamp-2 leading-snug">{task.title}</h4>
                <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Decompose Action - Using class handling in parent would be better but keeping simple for now */}
                    <button
                        className="text-primary hover:text-primary-hover p-1"
                        title="AI Decompose"
                        onMouseDown={(e) => {
                            // Prevent drag start
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            // We need a way to bubble this event up.
                            // For now, let's just emit a custom event or dispatch if no prop.
                            // Ideally, TaskCard should take an onAction prop.
                            const event = new CustomEvent('task-decompose', { detail: { taskId: task.id, taskTitle: task.title } });
                            window.dispatchEvent(event);
                        }}
                    >
                        <Sparkles size={14} />
                    </button>
                    <button className="text-gray-500 hover:text-white p-1">
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto">
                <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider",
                    priorityColor[task.priority as keyof typeof priorityColor] || priorityColor.medium
                )}>
                    {task.priority}
                </span>

                {task.deadline && (
                    <div className="flex items-center text-[10px] text-gray-400 gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                        <Clock size={10} />
                        <span>{task.deadline}</span>
                    </div>
                )}
            </div>

            {/* Hover Effect Glow */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
    );
};
