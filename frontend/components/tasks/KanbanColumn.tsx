import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '../../types';
import { TaskCard } from './TaskCard';
import { cn } from '../ui/Button';

interface KanbanColumnProps {
    id: string;
    title: string;
    tasks: Task[];
    count: number;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, tasks, count }) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="flex flex-col h-full min-w-[320px] max-w-[320px] rounded-2xl bg-white/5 border border-white/5">
            {/* Column Header */}
            <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-200">{title}</h3>
                    <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-white/10 text-[10px] font-medium text-gray-400">
                        {count}
                    </span>
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div ref={setNodeRef} className="flex flex-col gap-3 min-h-25">
                        {tasks.map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
};
