"use client";

import { useEffect, useState, useCallback } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface DueReminder {
  id: string;
  title: string;
  message: string;
  remindAt: string;
}

export default function GlobalReminderBanner() {
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);

  const fetchDue = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders/due");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDueReminders(data);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Poll for due reminders every 30 seconds
  useEffect(() => {
    fetchDue();
    const interval = setInterval(fetchDue, 30000);
    
    // Listen for cross-component dismiss events (e.g. from the bell)
    const handleDismissedEvent = () => fetchDue();
    window.addEventListener("reminder-dismissed", handleDismissedEvent);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("reminder-dismissed", handleDismissedEvent);
    };
  }, [fetchDue]);

  async function handleDismiss(id: string) {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Dismissed" }),
      });
      setDueReminders((prev) => prev.filter((r) => r.id !== id));
      
      // Dispatch custom event so the bell icon can update its count without reloading
      window.dispatchEvent(new Event("reminder-dismissed"));
    } catch {
      // Silently fail
    }
  }

  if (dueReminders.length === 0) return null;

  return (
    <div className="flex flex-col w-full z-50">
      {dueReminders.map((reminder) => (
        <div
          key={reminder.id}
          className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-4 shadow-md backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <BellRing size={16} className="text-amber-400 animate-bounce" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-50 truncate">
                {reminder.title}
              </p>
              <p className="text-xs text-amber-200/80 truncate">
                {reminder.message} • {formatDistanceToNow(new Date(reminder.remindAt), { addSuffix: true, locale: idLocale })}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDismiss(reminder.id)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <CheckCircle2 size={14} />
            <span className="hidden sm:inline">Mark as done</span>
          </button>
        </div>
      ))}
    </div>
  );
}
