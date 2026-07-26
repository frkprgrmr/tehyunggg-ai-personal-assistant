"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  CalendarDays,
  Users,
  Plus,
  FileText,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  participants: string[];
  summary: string | null;
  createdAt: string;
  _count: { notes: number };
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    meetingDate: new Date().toISOString().slice(0, 16),
    participants: "",
  });

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMeetings(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          meetingDate: new Date(form.meetingDate).toISOString(),
          participants: form.participants
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
        }),
      });

      if (res.ok) {
        const newMeeting = await res.json();
        // Redirect to detail page
        window.location.href = `/meetings/${newMeeting.id}`;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meetings</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Catat meeting, paste transkrip, dan ekstrak task secara otomatis
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} />
          New Meeting
        </Button>
      </div>

      {/* New Meeting Form */}
      {showForm && (
        <Card className="border-brand-500/20">
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white/70 block mb-1.5">
                  Judul Meeting *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="contoh: Sync Tim Warehouse, Meeting Migrasi Odoo"
                  required
                  className="w-full bg-surface-100 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white/70 block mb-1.5">
                  Tanggal & Waktu Meeting *
                </label>
                <input
                  type="datetime-local"
                  value={form.meetingDate}
                  onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                  required
                  className="w-full bg-surface-100 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white/70 block mb-1.5">
                  Peserta (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={form.participants}
                  onChange={(e) => setForm({ ...form, participants: e.target.value })}
                  placeholder="contoh: Jorge, Budi, Umam"
                  className="w-full bg-surface-100 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Buat & Tambah Transkrip
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowForm(false)}
                >
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Meeting List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-white/20" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/10 flex items-center justify-center mb-4">
            <CalendarDays size={28} className="text-brand-400/60" />
          </div>
          <h2 className="text-base font-semibold text-white/50 mb-1">Belum ada meeting</h2>
          <p className="text-sm text-white/30 max-w-xs">
            Klik "New Meeting" atau bilang ke AI seperti "Tadi ada meeting sama Jorge soal Odoo"
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
              <Card className="hover:border-brand-500/20 transition-colors cursor-pointer group">
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/15 transition-colors">
                    <CalendarDays size={18} className="text-brand-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-white truncate">{meeting.title}</h3>
                      {meeting.summary && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-success/80 bg-success/10 px-1.5 py-0.5 rounded-full">
                          <CheckCircle2 size={9} />
                          Analyzed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} />
                        {format(new Date(meeting.meetingDate), "d MMM yyyy, HH:mm", {
                          locale: idLocale,
                        })}
                      </span>
                      {meeting.participants.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {meeting.participants.slice(0, 3).join(", ")}
                          {meeting.participants.length > 3 && ` +${meeting.participants.length - 3}`}
                        </span>
                      )}
                      {meeting._count.notes > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText size={11} />
                          {meeting._count.notes} notes
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
