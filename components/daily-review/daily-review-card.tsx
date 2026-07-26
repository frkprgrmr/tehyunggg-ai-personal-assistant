"use client";

import { useState } from "react";
import {
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Loader2,
  Bell,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ReviewTask {
  id: string;
  taskNumber: number;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  completedAt?: string | null;
  projectName?: string | null;
}

interface ReviewReminder {
  id: string;
  title: string;
  message: string;
  remindAt: string;
}

interface DailyReviewContent {
  type: "Morning" | "Evening";
  date: string;
  tasks: ReviewTask[];
  completedTasks: ReviewTask[];
  overdueTasks: ReviewTask[];
  pendingTasks: ReviewTask[];
  reminders: ReviewReminder[];
  summary: string;
}

interface DailyReviewCardProps {
  review: {
    id: string;
    type: "Morning" | "Evening";
    content: DailyReviewContent;
    createdAt: string;
  };
  onReschedule?: () => void;
}

const priorityColors: Record<string, string> = {
  Critical: "text-danger",
  High: "text-orange-400",
  Medium: "text-warning",
  Low: "text-white/40",
};

export default function DailyReviewCard({ review, onReschedule }: DailyReviewCardProps) {
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduledIds, setRescheduledIds] = useState<Set<string>>(new Set());
  const [rescheduleAllDone, setRescheduleAllDone] = useState(false);

  const { content } = review;
  const isMorning = review.type === "Morning";

  async function handleReschedule(taskIds: string[]) {
    setRescheduling(true);
    try {
      const res = await fetch("/api/daily-review/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });

      if (res.ok) {
        setRescheduledIds((prev) => {
          const next = new Set(prev);
          taskIds.forEach((id) => next.add(id));
          return next;
        });

        // Check if all pending tasks are now rescheduled
        if (taskIds.length === content.pendingTasks.length) {
          setRescheduleAllDone(true);
        }

        onReschedule?.();
      }
    } catch (error) {
      console.error("Failed to reschedule:", error);
    } finally {
      setRescheduling(false);
    }
  }

  async function handleRescheduleAll() {
    const ids = content.pendingTasks
      .filter((t) => !rescheduledIds.has(t.id))
      .map((t) => t.id);
    if (ids.length > 0) {
      await handleReschedule(ids);
      setRescheduleAllDone(true);
    }
  }

  return (
    <Card
      className={`relative overflow-hidden ${
        isMorning
          ? "border-amber-500/20"
          : "border-indigo-500/20"
      }`}
    >
      {/* Gradient accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isMorning
            ? "bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400"
            : "bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400"
        }`}
      />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isMorning
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : "bg-indigo-500/10 border border-indigo-500/20"
              }`}
            >
              {isMorning ? (
                <Sun size={20} className="text-amber-400" />
              ) : (
                <Moon size={20} className="text-indigo-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isMorning ? "Morning Review" : "Evening Review"}
              </h2>
              <p className="text-xs text-white/40">
                {format(new Date(review.createdAt), "EEEE, d MMMM yyyy • HH:mm", {
                  locale: idLocale,
                })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-5">
        {/* AI Summary */}
        <div
          className={`p-4 rounded-xl border ${
            isMorning
              ? "bg-amber-500/5 border-amber-500/10"
              : "bg-indigo-500/5 border-indigo-500/10"
          }`}
        >
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
            {content.summary}
          </p>
        </div>

        {/* Morning: Today's Tasks */}
        {isMorning && content.tasks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
              <Clock size={14} />
              Task Hari Ini ({content.tasks.length})
            </h3>
            <div className="space-y-1.5">
              {content.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-100/50 hover:bg-surface-100 transition-colors"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      task.status === "InProgress" ? "bg-blue-400" : "bg-white/30"
                    }`}
                  />
                  <span className="text-sm text-white/80 flex-1 truncate">
                    #{task.taskNumber} {task.title}
                  </span>
                  {task.priority && (
                    <span
                      className={`text-[10px] font-medium uppercase ${
                        priorityColors[task.priority] || "text-white/30"
                      }`}
                    >
                      {task.priority}
                    </span>
                  )}
                  {task.projectName && (
                    <span className="text-[10px] text-white/25 hidden sm:inline">
                      {task.projectName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Morning: Overdue Tasks */}
        {isMorning && content.overdueTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-danger/80 mb-2 flex items-center gap-2">
              <AlertTriangle size={14} />
              Overdue ({content.overdueTasks.length})
            </h3>
            <div className="space-y-1.5">
              {content.overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-danger/5 border border-danger/10 hover:bg-danger/10 transition-colors"
                >
                  <AlertTriangle size={12} className="text-danger/60 flex-shrink-0" />
                  <span className="text-sm text-white/80 flex-1 truncate">
                    #{task.taskNumber} {task.title}
                  </span>
                  {task.dueDate && (
                    <span className="text-[10px] text-danger/60">
                      {format(new Date(task.dueDate), "d MMM", { locale: idLocale })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evening: Completed Tasks */}
        {!isMorning && content.completedTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-success/80 mb-2 flex items-center gap-2">
              <CheckCircle2 size={14} />
              Selesai Hari Ini ({content.completedTasks.length})
            </h3>
            <div className="space-y-1.5">
              {content.completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-success/5 border border-success/10"
                >
                  <CheckCircle2 size={12} className="text-success/60 flex-shrink-0" />
                  <span className="text-sm text-white/60 flex-1 truncate line-through">
                    #{task.taskNumber} {task.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evening: Pending Tasks with Reschedule */}
        {!isMorning && content.pendingTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-warning/80 mb-2 flex items-center gap-2">
              <Clock size={14} />
              Masih Pending ({content.pendingTasks.length})
            </h3>
            <div className="space-y-1.5">
              {content.pendingTasks.map((task) => {
                const isRescheduled = rescheduledIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isRescheduled
                        ? "bg-success/5 border border-success/10"
                        : "bg-warning/5 border border-warning/10 hover:bg-warning/10"
                    }`}
                  >
                    {isRescheduled ? (
                      <CheckCircle2 size={12} className="text-success/60 flex-shrink-0" />
                    ) : (
                      <Clock size={12} className="text-warning/60 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm flex-1 truncate ${
                        isRescheduled ? "text-white/40 line-through" : "text-white/80"
                      }`}
                    >
                      #{task.taskNumber} {task.title}
                    </span>
                    {!isRescheduled && (
                      <button
                        onClick={() => handleReschedule([task.id])}
                        disabled={rescheduling}
                        className="flex items-center gap-1 text-[10px] font-medium text-brand-400 hover:text-brand-300 transition-colors cursor-pointer disabled:opacity-50"
                        title="Pindahkan ke besok"
                      >
                        <ArrowRight size={10} />
                        <span className="hidden sm:inline">Besok</span>
                      </button>
                    )}
                    {isRescheduled && (
                      <span className="text-[10px] text-success/60">→ Besok</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reschedule All button */}
            {!rescheduleAllDone && content.pendingTasks.some((t) => !rescheduledIds.has(t.id)) && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRescheduleAll}
                  disabled={rescheduling}
                >
                  {rescheduling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                  Pindahkan Semua ke Besok
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Reminders */}
        {content.reminders.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
              <Bell size={14} />
              Reminder ({content.reminders.length})
            </h3>
            <div className="space-y-1.5">
              {content.reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-100/50"
                >
                  <Bell size={12} className="text-warning/60 flex-shrink-0" />
                  <span className="text-sm text-white/70 flex-1 truncate">
                    {reminder.title}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {format(new Date(reminder.remindAt), "HH:mm", { locale: idLocale })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {isMorning &&
          content.tasks.length === 0 &&
          content.overdueTasks.length === 0 &&
          content.reminders.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-white/30">
                Tidak ada task atau reminder hari ini. Santai aja! 😎
              </p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
