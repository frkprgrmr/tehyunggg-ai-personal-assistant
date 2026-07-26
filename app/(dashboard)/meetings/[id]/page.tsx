"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  CalendarDays,
  Users,
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  ChevronLeft,
  FileText,
  CheckCircle2,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface Meeting {
  id: string;
  title: string;
  transcript: string;
  summary: string | null;
  meetingDate: string;
  participants: string[];
  createdAt: string;
  notes: Note[];
}

interface TaskCandidate {
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  dueDate: string | null;
}

const priorityColors: Record<string, string> = {
  Critical: "text-danger bg-danger/10 border-danger/20",
  High: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Medium: "text-warning bg-warning/10 border-warning/20",
  Low: "text-white/40 bg-white/5 border-white/10",
};

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  // Transcript editing
  const [transcript, setTranscript] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);

  // AI Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [taskCandidates, setTaskCandidates] = useState<TaskCandidate[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<number>>(new Set());

  // Notes
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/meetings/${id}`)
      .then((r) => r.json())
      .then((data: Meeting) => {
        setMeeting(data);
        setTranscript(data.transcript || "");
        setSummary(data.summary || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSaveTranscript() {
    setSavingTranscript(true);
    try {
      await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      setTranscriptSaved(true);
      setTimeout(() => setTranscriptSaved(false), 2000);
    } finally {
      setSavingTranscript(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setTaskCandidates([]);
    setSelectedTasks(new Set());
    setCreatedTaskIds(new Set());
    try {
      // Save transcript first if changed
      if (transcript !== meeting?.transcript) {
        await handleSaveTranscript();
      }

      const res = await fetch(`/api/meetings/${id}/analyze`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTaskCandidates(data.taskCandidates || []);
        // Select all by default
        setSelectedTasks(new Set(data.taskCandidates.map((_: unknown, i: number) => i)));
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menganalisis meeting.");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleTask(index: number) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleCreateSelectedTasks() {
    const selected = taskCandidates.filter((_, i) => selectedTasks.has(i));
    if (selected.length === 0) return;

    setCreatingTasks(true);
    const newCreated = new Set<number>();

    for (let i = 0; i < taskCandidates.length; i++) {
      if (!selectedTasks.has(i)) continue;
      const candidate = taskCandidates[i];

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: candidate.title,
            description: candidate.description,
            priority: candidate.priority,
            dueDate: candidate.dueDate || undefined,
            category: "Work",
          }),
        });
        if (res.ok) newCreated.add(i);
      } catch {
        console.error(`Failed to create task: ${candidate.title}`);
      }
    }

    setCreatedTaskIds(newCreated);
    setCreatingTasks(false);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/meetings/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });
      if (res.ok) {
        const note = await res.json();
        setMeeting((prev) =>
          prev ? { ...prev, notes: [...prev.notes, note] } : prev
        );
        setNewNote("");
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Hapus meeting ini? Semua notes juga akan dihapus.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/meetings/${id}`, { method: "DELETE" });
      router.push("/meetings");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-white/20" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40">Meeting tidak ditemukan.</p>
        <Button variant="secondary" onClick={() => router.push("/meetings")} className="mt-4">
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Back Button + Header */}
      <div>
        <button
          onClick={() => router.push("/meetings")}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-4 cursor-pointer"
        >
          <ChevronLeft size={16} />
          Kembali ke Meetings
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{meeting.title}</h1>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-white/40">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={13} />
                {format(new Date(meeting.meetingDate), "EEEE, d MMMM yyyy • HH:mm", {
                  locale: idLocale,
                })}
              </span>
              {meeting.participants.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users size={13} />
                  {meeting.participants.join(", ")}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10 transition-colors text-sm cursor-pointer"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Hapus
          </button>
        </div>
      </div>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText size={15} className="text-white/50" />
            Transkrip Meeting
          </h2>
          <p className="text-xs text-white/30 mt-0.5">
            Paste transkrip atau catatan rapat di sini, lalu klik Analyze
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste transkrip meeting di sini..."
            rows={12}
            className="w-full bg-surface-100 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-brand-500/40 resize-y"
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !transcript.trim()}
            >
              {analyzing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {analyzing ? "Menganalisis..." : "Analyze dengan AI"}
            </Button>
            <button
              onClick={handleSaveTranscript}
              disabled={savingTranscript}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/50 hover:text-white/80 transition-colors cursor-pointer"
            >
              {transcriptSaved ? (
                <>
                  <CheckCircle2 size={13} className="text-success" />
                  <span className="text-success">Tersimpan</span>
                </>
              ) : savingTranscript ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <Save size={13} />
                  Simpan Transkrip
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      {summary && (
        <Card className="border-brand-500/15">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-400 via-purple-400 to-pink-400 rounded-t-2xl" />
          <CardHeader>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles size={15} className="text-brand-400" />
              Ringkasan AI
            </h2>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Task Candidates */}
      {taskCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckSquare size={15} className="text-success/70" />
                Task Kandidat ({taskCandidates.length} ditemukan)
              </h2>
              <span className="text-xs text-white/30">
                {selectedTasks.size} dipilih
              </span>
            </div>
            <p className="text-xs text-white/30 mt-0.5">
              Pilih task yang ingin dibuat, lalu klik "Buat Task"
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {taskCandidates.map((candidate, i) => {
              const isSelected = selectedTasks.has(i);
              const isCreated = createdTaskIds.has(i);
              return (
                <div
                  key={i}
                  onClick={() => !isCreated && toggleTask(i)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    isCreated
                      ? "bg-success/5 border-success/15 opacity-60 cursor-default"
                      : isSelected
                      ? "bg-brand-500/5 border-brand-500/20 cursor-pointer"
                      : "bg-surface-100/50 border-white/[0.05] cursor-pointer hover:bg-surface-100"
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isCreated ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : isSelected ? (
                      <CheckSquare size={16} className="text-brand-400" />
                    ) : (
                      <Square size={16} className="text-white/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isCreated ? "line-through text-white/40" : "text-white/80"}`}>
                        {candidate.title}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                          priorityColors[candidate.priority]
                        }`}
                      >
                        {candidate.priority}
                      </span>
                      {isCreated && (
                        <span className="text-[10px] text-success/80">✓ Dibuat</span>
                      )}
                    </div>
                    {candidate.description && (
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        {candidate.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {createdTaskIds.size < taskCandidates.length && (
              <div className="pt-2">
                <Button
                  onClick={handleCreateSelectedTasks}
                  disabled={creatingTasks || selectedTasks.size === 0}
                >
                  {creatingTasks ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Buat {selectedTasks.size} Task yang Dipilih
                </Button>
              </div>
            )}

            {createdTaskIds.size > 0 && createdTaskIds.size === taskCandidates.length && (
              <div className="flex items-center gap-2 pt-2 text-sm text-success/80">
                <CheckCircle2 size={15} />
                Semua task berhasil dibuat!
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText size={15} className="text-white/50" />
            Notes ({meeting.notes.length})
          </h2>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {meeting.notes.length === 0 && (
            <p className="text-xs text-white/30 py-2">Belum ada note untuk meeting ini.</p>
          )}
          {meeting.notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-xl bg-surface-100/50 border border-white/[0.05]"
            >
              <p className="text-sm text-white/70 whitespace-pre-wrap">{note.content}</p>
              <p className="text-[10px] text-white/25 mt-1.5">
                {format(new Date(note.createdAt), "d MMM yyyy, HH:mm", { locale: idLocale })}
              </p>
            </div>
          ))}

          {/* Add Note Form */}
          <form onSubmit={handleAddNote} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Tambah note..."
              className="flex-1 bg-surface-100 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/40"
            />
            <Button type="submit" size="sm" disabled={savingNote || !newNote.trim()}>
              {savingNote ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
