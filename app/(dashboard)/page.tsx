"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListTodo,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow, isAfter, startOfDay, endOfDay, isBefore } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
}

interface Stats {
  total: number;
  dueToday: number;
  overdue: number;
  completed: number;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, dueToday: 0, overdue: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/tasks");
        const data: Task[] = await res.json();
        setTasks(data);

        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        setStats({
          total: data.filter((t) => t.status !== "Cancelled").length,
          dueToday: data.filter(
            (t) =>
              t.dueDate &&
              t.status !== "Done" &&
              t.status !== "Cancelled" &&
              isAfter(new Date(t.dueDate), todayStart) &&
              isBefore(new Date(t.dueDate), todayEnd)
          ).length,
          overdue: data.filter(
            (t) =>
              t.dueDate &&
              t.status !== "Done" &&
              t.status !== "Cancelled" &&
              isBefore(new Date(t.dueDate), todayStart)
          ).length,
          completed: data.filter((t) => t.status === "Done").length,
        });
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const recentTasks = tasks
    .filter((t) => t.status !== "Done" && t.status !== "Cancelled")
    .slice(0, 5);

  const statCards = [
    {
      label: "Total Tasks",
      value: stats.total,
      icon: ListTodo,
      color: "text-brand-400",
      bgColor: "bg-brand-500/10",
      borderColor: "border-brand-500/20",
    },
    {
      label: "Due Today",
      value: stats.dueToday,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/20",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
      color: "text-danger",
      bgColor: "bg-danger/10",
      borderColor: "border-danger/20",
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/20",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-100 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-surface-50 rounded-2xl border border-white/[0.06]" />
          ))}
        </div>
        <div className="h-64 bg-surface-50 rounded-2xl border border-white/[0.06]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">
            Selamat datang kembali 👋
          </p>
        </div>
        <Link href="/tasks/new">
          <Button size="md">
            <Plus size={16} />
            New Task
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/50">{stat.label}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl ${stat.bgColor} border ${stat.borderColor}`}
                  >
                    <Icon size={20} className={stat.color} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Active Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Active Tasks</h2>
            <Link
              href="/tasks"
              className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentTasks.length === 0 ? (
            <div className="text-center py-8">
              <ListTodo size={40} className="mx-auto text-white/20 mb-3" />
              <p className="text-white/40 text-sm">Belum ada task aktif.</p>
              <Link href="/tasks/new">
                <Button variant="secondary" size="sm" className="mt-3">
                  <Plus size={14} />
                  Buat Task Pertama
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task, index) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-100 transition-all group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.project && (
                        <span className="text-xs text-white/30">{task.project.name}</span>
                      )}
                      {task.dueDate && (
                        <span
                          className={`text-xs ${
                            isBefore(new Date(task.dueDate), new Date())
                              ? "text-danger"
                              : "text-white/30"
                          }`}
                        >
                          {formatDistanceToNow(new Date(task.dueDate), {
                            addSuffix: true,
                            locale: idLocale,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TaskPriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
