/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { Task } from '../../types';
import { generateTaskAnalysis } from '../../services/grokService';
import { saveAIInteraction } from '../../services/interactionService';
import {
  fetchTasks,
  createTask as createTaskDoc,
  updateTask as updateTaskDoc,
  deleteTask as deleteTaskDoc,
} from '../../services/firestoreService';
import { KanbanColumn } from '../../components/tasks/KanbanColumn';
import { TaskCard } from '../../components/tasks/TaskCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const defaultTasks: Task[] = [
  { id: '1', title: 'Review Q3 Financials', status: 'todo', priority: 'high', deadline: 'Today' },
  { id: '2', title: 'Update Client Proposal', status: 'in-progress', priority: 'medium' },
  { id: '3', title: 'Team Sync', status: 'done', priority: 'low' },
];

const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeInitialStatus = useRef<Task['status'] | null>(null);
  const [newTask, setNewTask] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await fetchTasks();
        if (loaded.length > 0) {
          setTasks(loaded);
          return;
        }

        // First-time user: seed with demo tasks (same UX as legacy localStorage)
        const seeded = await Promise.all(
          defaultTasks.map((t, idx) =>
            createTaskDoc({
              title: t.title,
              status: t.status,
              priority: t.priority,
              deadline: t.deadline,
              order: idx,
            })
          )
        );
        setTasks(seeded);
      } catch (err) {
        console.error('Failed to load tasks:', err);
        setTasks(defaultTasks);
      }
    };

    load();
  }, []);

  // Import decomposeTask at top (assume handled by logic below)

  useEffect(() => {
    const handleDecompose = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      const { taskId, taskTitle } = detail;

      // Optimistic UI or Loading state could vary, for now just loading
      // We might want a global loading indicator or toast.
      // Let's assume we just want to replace the big task with subtasks or append them.
      // Let's Append them to 'todo' for now to be safe.

      try {
        // Maybe show a transparent overlay or spinner?
        // Using simple alert logic or console for now, improving later.
        console.log("Decomposing:", taskTitle);

        // Dynamic import to avoid circular dep if needed, or just standard import
        const { decomposeTask } = await import('../../services/grokService');

        const subtasks = await decomposeTask(taskTitle);

        // Save interaction to Firestore
        await saveAIInteraction('Task AI: Decompose', taskTitle, JSON.stringify(subtasks));

        if (subtasks.length > 0) {
          // Replace the original task with newly created Firestore tasks
          await deleteTaskDoc(taskId).catch(() => undefined);

          const created = await Promise.all(
            subtasks.map((st) =>
              createTaskDoc({
                title: st.title,
                status: 'todo',
                priority: st.priority,
              })
            )
          );

          setTasks((prev) => {
            const filtered = prev.filter((t) => t.id !== taskId);
            return [...filtered, ...created];
          });
        }
      } catch (err) {
        console.error("Decomposition failed", err);
      }
    };

    window.addEventListener('task-decompose', handleDecompose);
    return () => window.removeEventListener('task-decompose', handleDecompose);
  }, []);

  const addTask = () => {
    if (!newTask.trim()) return;
    const create = async () => {
      try {
        const created = await createTaskDoc({
          title: newTask.trim(),
          status: 'todo',
          priority: 'medium',
        });
        setTasks((prev) => [...prev, created]);
        setNewTask('');
      } catch (err) {
        console.error('Failed to create task:', err);
        alert('Failed to save task. Please try again.');
      }
    };

    create();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    activeInitialStatus.current = (event.active.data.current as any)?.task?.status ?? null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.sortable?.index !== undefined;
    const isOverTask = over.data.current?.sortable?.index !== undefined;

    if (!isActiveTask) return;

    // Dropping over a column
    if (!isOverTask) {
      const activeTask = tasks.find(t => t.id === activeId);
      if (activeTask && activeTask.status !== overId) {
        const nextStatus = overId as Task['status'];
        setTasks(tasks.map(t =>
          t.id === activeId ? { ...t, status: nextStatus } : t
        ));
      }
      return;
    }

    // Dropping over another task
    const activeTask = tasks.find(t => t.id === activeId);
    const overTask = tasks.find(t => t.id === overId);

    if (activeTask && overTask && activeTask.status !== overTask.status) {
      setTasks(tasks.map(t =>
        t.id === activeId ? { ...t, status: overTask.status } : t
      ));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Persist status change once, on drop
    const activeTask = tasks.find((t) => t.id === String(active.id));
    const overId = String(over.id);
    const overTask = tasks.find((t) => t.id === overId);
    const targetStatus = overTask ? overTask.status : (overId as Task['status']);
    if (activeTask && targetStatus && activeInitialStatus.current && targetStatus !== activeInitialStatus.current) {
      updateTaskDoc(String(active.id), { status: targetStatus }).catch(() => undefined);
    }
    activeInitialStatus.current = null;

    const activeId = active.id;
    const overIdAny = over.id;

    if (activeId === overIdAny) return;

    const oldIndex = tasks.findIndex((t) => t.id === activeId);
    const newIndex = tasks.findIndex((t) => t.id === overIdAny);

    if (oldIndex !== -1 && newIndex !== -1) {
      const next = arrayMove(tasks, oldIndex, newIndex);
      setTasks(next);
      Promise.all(next.map((t, idx) => updateTaskDoc(t.id, { order: idx }))).catch(() => undefined);
    }
  };

  const optimizeWithAI = async () => {
    setAnalyzing(true);
    try {
      const taskStr = tasks.filter(t => t.status !== 'done').map(t => `${t.title} (${t.priority})`).join(', ');
      const response = await generateTaskAnalysis(taskStr);
      setAiAdvice(response);
      
      // Save interaction to Firestore
      await saveAIInteraction('Task AI: Optimize', taskStr, response);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surface/30 backdrop-blur-xl">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Project Board</h2>
          <p className="text-xs text-gray-500">Kanban View • Q3 Sprint</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={optimizeWithAI}
            isLoading={analyzing}
            leftIcon={<Sparkles className="w-3 h-3 text-primary" />}
          >
            AI Optimize
          </Button>
          <div className="flex gap-2">
            <Input
              placeholder="Add new task..."
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              className="w-64 h-8 text-xs"
            />
            <Button size="sm" onClick={addTask} className="h-8 w-8 p-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* AI Insight */}
      {aiAdvice && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 relative animate-in slide-in-from-top-2">
          <button onClick={() => setAiAdvice(null)} className="absolute top-2 right-2 text-gray-500 hover:text-white">&times;</button>
          <div className="flex gap-2 text-sm text-gray-200">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p>{aiAdvice}</p>
          </div>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-6">
            <KanbanColumn
              id="todo"
              title="To Do"
              count={tasks.filter(t => t.status === 'todo').length}
              tasks={tasks.filter(t => t.status === 'todo')}
            />
            <KanbanColumn
              id="in-progress"
              title="In Progress"
              count={tasks.filter(t => t.status === 'in-progress').length}
              tasks={tasks.filter(t => t.status === 'in-progress')}
            />
            <KanbanColumn
              id="done"
              title="Done"
              count={tasks.filter(t => t.status === 'done').length}
              tasks={tasks.filter(t => t.status === 'done')}
            />
          </div>

          <DragOverlay>
            {activeId ? (
              <TaskCard task={tasks.find(t => t.id === activeId)!} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default TaskBoard;
