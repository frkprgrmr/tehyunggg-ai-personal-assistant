"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ListTodo,
  Loader2,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Reminder {
  id: string;
  title: string;
  message: string;
  remindAt: string;
  status: "Pending" | "Sent" | "Dismissed";
  createdAt: string;
  relatedTask: { id: string; title: string; status: string } | null;
}

type FilterStatus = "all" | "Pending" | "Sent" | "Dismissed";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  const fetchReminders = useCallback(async () => {
    try {
      const url =
        filter === "all" ? "/api/reminders" : `/api/reminders?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) setReminders(data);
    } catch (err) {
      console.error("Failed to fetch reminders:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchReminders();
  }, [fetchReminders]);

  async function handleDismiss(id: string) {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Dismissed" }),
      });
      fetchReminders();
    } catch (err) {
      console.error("Failed to dismiss reminder:", err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      fetchReminders();
    } catch (err) {
      console.error("Failed to delete reminder:", err);
    }
  }

  const filterButtons: { label: string; value: FilterStatus; icon: typeof Bell }[] = [
    { label: "Semua", value: "all", icon: Bell },
    { label: "Pending", value: "Pending", icon: Clock },
    { label: "Terkirim", value: "Sent", icon: CheckCircle2 },
    { label: "Dismissed", value: "Dismissed", icon: XCircle },
  ];

  const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
    Pending: { color: "text-warning", bgColor: "bg-warning/10", label: "Pending" },
    Sent: { color: "text-info", bgColor: "bg-info/10", label: "Terkirim" },
    Dismissed: { color: "text-white/40", bgColor: "bg-surface-200", label: "Dismissed" },
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-100 rounded-xl" />
        <div className="h-12 bg-surface-50 rounded-2xl border border-white/[0.06]" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-50 rounded-2xl border border-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reminders</h1>
        <p className="text-white/50 text-sm mt-1">
          Kelola semua pengingat kamu di sini 🔔
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filterButtons.map((btn) => {
          const Icon = btn.icon;
          const isActive = filter === btn.value;
          return (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-brand-600/20 text-brand-400 border border-brand-500/30"
                  : "bg-surface-50 text-white/50 border border-white/[0.06] hover:text-white hover:bg-surface-100"
              }`}
            >
              <Icon size={14} />
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Reminder List */}
      {reminders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Bell size={40} className="mx-auto text-white/20 mb-3" />
              <p className="text-white/40 text-sm">
                {filter === "all"
                  ? "Belum ada reminder. Buat lewat chat: \"Ingetin gue besok jam 9...\""
                  : `Tidak ada reminder dengan status ${filter}.`}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder, index) => {
            const config = statusConfig[reminder.status];
            const isDue = isPast(new Date(reminder.remindAt));
            const isActive = reminder.status === "Pending" || reminder.status === "Sent";

            return (
              <Card
                key={reminder.id}
                className={`transition-all ${
                  reminder.status === "Dismissed" ? "opacity-60" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div
                      className={`flex-shrink-0 p-2.5 rounded-xl ${config.bgColor} border border-white/[0.06]`}
                    >
                      {isDue && isActive ? (
                        <AlertTriangle size={18} className="text-warning animate-pulse" />
                      ) : (
                        <Bell size={18} className={config.color} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {reminder.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bgColor} ${config.color}`}
                        >
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mb-2">{reminder.message}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span
                          className={`flex items-center gap-1 ${
                            isDue && isActive ? "text-warning" : "text-white/40"
                          }`}
                        >
                          <Clock size={12} />
                          {format(new Date(reminder.remindAt), "dd MMM yyyy, HH:mm", {
                            locale: idLocale,
                          })}
                        </span>
                        {reminder.relatedTask && (
                          <span className="flex items-center gap-1 text-brand-400">
                            <ListTodo size={12} />
                            {reminder.relatedTask.title}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isActive && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDismiss(reminder.id)}
                        >
                          <CheckCircle2 size={14} />
                          Dismiss
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(reminder.id)}
                        className="p-2 rounded-lg text-white/30 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
                        title="Hapus reminder"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
