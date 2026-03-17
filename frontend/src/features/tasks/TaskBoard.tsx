import React, { useState, useEffect } from 'react';
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
import { storage } from '../../services/storageService';
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
  const [newTask, setNewTask] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const loaded = storage.getTasks();
    if (loaded && loaded.length > 0) {
      // Migration check (old statuses) -> optional, but good for safety
      const migrated = loaded.map((t: any) => ({
        ...t,
        status: t.status === 'pending' ? 'todo' : t.status === 'completed' ? 'done' : t.status
      }));
      setTasks(migrated);
    } else {
      setTasks(defaultTasks);
    }
  }, []);


  const updateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    storage.saveTasks(newTasks);
  };

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

        if (subtasks.length > 0) {
          const newTasks = subtasks.map(st => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: st.title,
            status: 'todo' as const,
            priority: st.priority
          }));

          setTasks(prev => {
            const filtered = prev.filter(t => t.id !== taskId); // Remove original? Or Keep? Let's Remove original.
            const updated = [...filtered, ...newTasks];
            storage.saveTasks(updated);
            return updated;
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
    const task: Task = {
      id: Date.now().toString(),
      title: newTask,
      status: 'todo',
      priority: 'medium'
    };
    updateTasks([...tasks, task]);
    setNewTask('');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
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
        updateTasks(tasks.map(t =>
          t.id === activeId ? { ...t, status: overId as Task['status'] } : t
        ));
      }
      return;
    }

    // Dropping over another task
    const activeTask = tasks.find(t => t.id === activeId);
    const overTask = tasks.find(t => t.id === overId);

    if (activeTask && overTask && activeTask.status !== overTask.status) {
      updateTasks(tasks.map(t =>
        t.id === activeId ? { ...t, status: overTask.status } : t
      ));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const oldIndex = tasks.findIndex((t) => t.id === activeId);
    const newIndex = tasks.findIndex((t) => t.id === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      updateTasks(arrayMove(tasks, oldIndex, newIndex));
    }
  };

  const optimizeWithAI = async () => {
    setAnalyzing(true);
    try {
      const taskStr = tasks.filter(t => t.status !== 'done').map(t => `${t.title} (${t.priority})`).join(', ');
      const response = await generateTaskAnalysis(taskStr);
      setAiAdvice(response);
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
