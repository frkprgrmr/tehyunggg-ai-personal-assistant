"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, Clock, CheckCircle2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface DueReminder {
  id: string;
  title: string;
  message: string;
  remindAt: string;
  relatedTask: { id: string; title: string; status: string } | null;
}

export default function NotificationBell() {
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
    return () => clearInterval(interval);
  }, [fetchDue]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleDismiss(id: string) {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Dismissed" }),
      });
      setDueReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Silently fail
    }
  }

  const count = dueReminders.length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-white/40 hover:text-white hover:bg-surface-100 transition-all cursor-pointer"
        title="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-[10px] font-bold text-white animate-pulse">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-full ml-2 bottom-0 w-80 bg-surface-50 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 z-50 animate-fade-in overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-surface-100 transition-all cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Panel Body */}
          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <div className="py-8 text-center">
                <Bell size={28} className="mx-auto text-white/15 mb-2" />
                <p className="text-xs text-white/30">Tidak ada notifikasi</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {dueReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="px-4 py-3 hover:bg-surface-100 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg bg-warning/10">
                        <Clock size={14} className="text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {reminder.title}
                        </p>
                        <p className="text-[11px] text-white/50 mt-0.5 line-clamp-2">
                          {reminder.message}
                        </p>
                        <p className="text-[10px] text-white/30 mt-1">
                          {formatDistanceToNow(new Date(reminder.remindAt), {
                            addSuffix: true,
                            locale: idLocale,
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(reminder.id);
                        }}
                        className="flex-shrink-0 p-1.5 rounded-lg text-white/30 hover:text-success hover:bg-success/10 transition-all cursor-pointer"
                        title="Dismiss"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
