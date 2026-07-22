"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TaskStatusBadge, TaskPriorityBadge, TaskCategoryBadge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Calendar, FolderKanban } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  dueDate: string | null;
  createdAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  tasks: Task[];
  _count: { tasks: number };
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-100 rounded-xl" />
        <div className="h-64 bg-surface-50 rounded-2xl border border-white/[0.06]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <FolderKanban size={48} className="mx-auto text-white/15 mb-4" />
        <p className="text-white/40">Project tidak ditemukan.</p>
        <Link href="/projects">
          <Button variant="secondary" className="mt-4">
            Kembali
          </Button>
        </Link>
      </div>
    );
  }

  const activeTasks = project.tasks.filter(
    (t) => t.status !== "Done" && t.status !== "Cancelled"
  );
  const completedTasks = project.tasks.filter((t) => t.status === "Done");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-surface-100 transition-all"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            {project.description && (
              <p className="text-white/50 text-sm mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <Link href={`/tasks/new`}>
          <Button size="md">
            <Plus size={16} />
            Add Task
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{project._count.tasks}</p>
            <p className="text-xs text-white/40 mt-1">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-info">{activeTasks.length}</p>
            <p className="text-xs text-white/40 mt-1">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{completedTasks.length}</p>
            <p className="text-xs text-white/40 mt-1">Done</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Tasks */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">
            Active Tasks ({activeTasks.length})
          </h2>
        </CardHeader>
        <CardContent className="pt-0">
          {activeTasks.length === 0 ? (
            <p className="text-sm text-white/30 py-4 text-center">
              Semua task sudah selesai! 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-100 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <TaskStatusBadge status={task.status} />
                      <TaskPriorityBadge priority={task.priority} />
                      <TaskCategoryBadge category={task.category} />
                    </div>
                  </div>
                  {task.dueDate && (
                    <div
                      className={`flex items-center gap-1 text-xs ${
                        isBefore(new Date(task.dueDate), startOfDay(new Date()))
                          ? "text-danger"
                          : "text-white/30"
                      }`}
                    >
                      <Calendar size={12} />
                      {format(new Date(task.dueDate), "dd MMM", { locale: idLocale })}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-white/50">
              Completed ({completedTasks.length})
            </h2>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-100 transition-all"
                >
                  <p className="text-sm text-white/30 line-through truncate">{task.title}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
