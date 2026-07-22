"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { TaskStatusBadge, TaskPriorityBadge, TaskCategoryBadge } from "@/components/ui/badge";
import { Plus, ListTodo, Calendar, Trash2 } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
}

interface Project {
  id: string;
  name: string;
}

export default function TaskListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());

  // Filters from URL params
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [priority, setPriority] = useState(searchParams.get("priority") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [projectId, setProjectId] = useState(searchParams.get("projectId") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "createdAt");
  const [order, setOrder] = useState(searchParams.get("order") || "desc");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (category) params.set("category", category);
    if (projectId) params.set("projectId", projectId);
    params.set("sort", sort);
    params.set("order", order);

    try {
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [status, priority, category, projectId, sort, order]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then(setProjects)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (category) params.set("category", category);
    if (projectId) params.set("projectId", projectId);
    if (sort !== "createdAt") params.set("sort", sort);
    if (order !== "desc") params.set("order", order);

    const qs = params.toString();
    router.replace(`/tasks${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [status, priority, category, projectId, sort, order, router]);

  async function handleDelete(taskId: string) {
    if (!confirm("Hapus task ini?")) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  async function handleQuickStatus(taskId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-white/50 text-sm mt-1">
            {tasks.length} task{tasks.length !== 1 && "s"}
          </p>
        </div>
        <Link href="/tasks/new">
          <Button>
            <Plus size={16} />
            New Task
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select
              placeholder="All Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "Todo", label: "Todo" },
                { value: "InProgress", label: "In Progress" },
                { value: "Done", label: "Done" },
                { value: "Cancelled", label: "Cancelled" },
              ]}
            />
            <Select
              placeholder="All Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: "Low", label: "Low" },
                { value: "Medium", label: "Medium" },
                { value: "High", label: "High" },
                { value: "Critical", label: "Critical" },
              ]}
            />
            <Select
              placeholder="All Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: "Work", label: "Work" },
                { value: "Personal", label: "Personal" },
              ]}
            />
            <Select
              placeholder="All Projects"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Select
              placeholder="Sort by"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              options={[
                { value: "createdAt", label: "Created" },
                { value: "dueDate", label: "Due Date" },
                { value: "priority", label: "Priority" },
                { value: "title", label: "Title" },
              ]}
            />
            <Select
              placeholder="Order"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              options={[
                { value: "desc", label: "Newest first" },
                { value: "asc", label: "Oldest first" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-50 rounded-2xl border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <ListTodo size={48} className="mx-auto text-white/15 mb-4" />
              <p className="text-white/40 mb-1">Tidak ada task ditemukan.</p>
              <p className="text-white/25 text-sm">Coba ubah filter atau buat task baru.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, index) => (
            <Card key={task.id} hover>
              <CardContent className="p-4">
                <div
                  className="flex items-center gap-4 animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* Selection checkbox (visual only, does not change status) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCheckedTasks((prev) => {
                        const next = new Set(prev);
                        if (next.has(task.id)) {
                          next.delete(task.id);
                        } else {
                          next.add(task.id);
                        }
                        return next;
                      });
                    }}
                    className={`flex-shrink-0 w-5 h-5 rounded-md border-2 transition-all cursor-pointer ${
                      checkedTasks.has(task.id)
                        ? "bg-brand-500/20 border-brand-400/50 text-brand-400"
                        : "border-white/20 hover:border-brand-400/50"
                    } flex items-center justify-center`}
                  >
                    {checkedTasks.has(task.id) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            task.status === "Done"
                              ? "text-white/40 line-through"
                              : "text-white"
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <TaskStatusBadge status={task.status} />
                          <TaskPriorityBadge priority={task.priority} />
                          <TaskCategoryBadge category={task.category} />
                          {task.project && (
                            <span className="text-xs text-white/30">
                              {task.project.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {task.dueDate && (
                          <div
                            className={`flex items-center gap-1 text-xs ${
                              isBefore(new Date(task.dueDate), startOfDay(new Date())) &&
                              task.status !== "Done"
                                ? "text-danger"
                                : "text-white/30"
                            }`}
                          >
                            <Calendar size={12} />
                            {format(new Date(task.dueDate), "dd MMM", { locale: idLocale })}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(task.id);
                    }}
                    className="flex-shrink-0 p-1.5 rounded-lg text-white/20 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
