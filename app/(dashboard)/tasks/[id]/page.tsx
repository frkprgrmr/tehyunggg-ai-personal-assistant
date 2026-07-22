"use client";

import { useState, useEffect, FormEvent, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskStatusBadge, TaskPriorityBadge, TaskCategoryBadge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Trash2, History, StickyNote, Plus, ExternalLink, Pencil, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface TaskLog {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedBy: string;
}

interface TaskNote {
  id: string;
  content: string;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  updatedAt: string;
  project: { id: string; name: string } | null;
  logs: TaskLog[];
}

interface Project {
  id: string;
  name: string;
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Notes state
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteUrl, setNoteUrl] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks/${id}`).then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch(`/api/tasks/${id}/notes`).then((r) => r.json()),
    ])
      .then(([taskData, projectsData, notesData]) => {
        setTask(taskData);
        setProjects(projectsData);
        setNotes(notesData);
        populateForm(taskData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  function populateForm(t: Task) {
    setTitle(t.title);
    setDescription(t.description || "");
    setProjectId(t.project?.id || "");
    setStatus(t.status);
    setPriority(t.priority);
    setCategory(t.category);
    setDueDate(t.dueDate ? format(new Date(t.dueDate), "yyyy-MM-dd'T'HH:mm") : "");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          projectId: projectId || null,
          status,
          priority,
          category,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });

      if (res.ok) {
        const updated = await fetch(`/api/tasks/${id}`).then((r) => r.json());
        setTask(updated);
        populateForm(updated);
        setEditing(false);
      }
    } catch (err) {
      console.error("Error saving:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Hapus task ini?")) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      router.push("/tasks");
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  // ─── Notes handlers ───────────────────────────────────
  function resetNoteForm() {
    setNoteContent("");
    setNoteUrl("");
    setEditingNoteId(null);
    setShowNoteForm(false);
  }

  function startEditNote(note: TaskNote) {
    setEditingNoteId(note.id);
    setNoteContent(note.content);
    setNoteUrl(note.url || "");
    setShowNoteForm(true);
  }

  async function handleSaveNote(e: FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setSavingNote(true);

    try {
      if (editingNoteId) {
        const res = await fetch(`/api/tasks/${id}/notes/${editingNoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: noteContent,
            url: noteUrl.trim() || null,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? updated : n)));
        }
      } else {
        const res = await fetch(`/api/tasks/${id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: noteContent,
            url: noteUrl.trim() || null,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setNotes((prev) => [created, ...prev]);
        }
      }
      resetNoteForm();
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("Hapus catatan ini?")) return;
    try {
      await fetch(`/api/tasks/${id}/notes/${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  }

  // ─── Render helpers ───────────────────────────────────
  function renderContentWithLinks(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 underline underline-offset-2 break-all transition-colors"
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-100 rounded-xl" />
        <div className="h-64 bg-surface-50 rounded-2xl border border-white/[0.06]" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-16">
        <p className="text-white/40">Task tidak ditemukan.</p>
        <Link href="/tasks">
          <Button variant="secondary" className="mt-4">
            Kembali
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/tasks"
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-surface-100 transition-all"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {editing ? "Edit Task" : task.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              <TaskCategoryBadge category={task.category} />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {!editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                <Trash2 size={14} />
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => {
              setEditing(false);
              populateForm(task);
            }}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Task Detail / Edit Form */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">
            {editing ? "Edit Details" : "Details"}
          </h2>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-5">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Project"
                  placeholder="No project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                />
                <Select
                  label="Status"
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
                  label="Priority"
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
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  options={[
                    { value: "Work", label: "Work" },
                    { value: "Personal", label: "Personal" },
                  ]}
                />
              </div>
              <Input
                label="Due Date"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="flex gap-3 pt-2">
                <Button type="submit" isLoading={saving}>
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {task.description && (
                <div>
                  <p className="text-xs text-white/40 mb-1">Description</p>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">Project</p>
                  <p className="text-sm text-white/80">{task.project?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Due Date</p>
                  <p className="text-sm text-white/80">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "dd MMMM yyyy, HH:mm", { locale: idLocale })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Created</p>
                  <p className="text-sm text-white/80">
                    {format(new Date(task.createdAt), "dd MMM yyyy", { locale: idLocale })}
                  </p>
                </div>
                {task.completedAt && (
                  <div>
                    <p className="text-xs text-white/40 mb-1">Completed</p>
                    <p className="text-sm text-success">
                      {format(new Date(task.completedAt), "dd MMM yyyy, HH:mm", {
                        locale: idLocale,
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote size={16} className="text-white/40" />
              <h2 className="text-base font-semibold text-white">Progress Notes</h2>
              <Badge>{notes.length}</Badge>
            </div>
            {!showNoteForm && (
              <button
                onClick={() => {
                  resetNoteForm();
                  setShowNoteForm(true);
                }}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Tambah Catatan
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Note Form */}
          {showNoteForm && (
            <form onSubmit={handleSaveNote} className="mb-5">
              <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-4 space-y-3">
                <Textarea
                  placeholder="Tulis progress atau catatan... (misal: sudah selesai bikin query stock report)"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="min-h-[80px]"
                />
                <Input
                  placeholder="URL dokumen (opsional) — misal: https://docs.google.com/..."
                  value={noteUrl}
                  onChange={(e) => setNoteUrl(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" isLoading={savingNote} disabled={!noteContent.trim()}>
                    {editingNoteId ? "Update" : "Simpan"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetNoteForm}>
                    <X size={14} />
                    Batal
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Notes List */}
          {notes.length === 0 && !showNoteForm ? (
            <div className="text-center py-8">
              <StickyNote size={32} className="mx-auto text-white/10 mb-3" />
              <p className="text-sm text-white/30 mb-1">Belum ada catatan progress.</p>
              <p className="text-xs text-white/20">Catat apa yang sudah kamu kerjakan untuk task ini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group relative rounded-xl border border-white/[0.04] bg-surface-100/50 p-4 transition-all hover:border-white/[0.08] hover:bg-surface-100"
                >
                  {/* Content */}
                  <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                    {renderContentWithLinks(note.content)}
                  </p>

                  {/* Attached URL */}
                  {note.url && (
                    <a
                      href={note.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-2 w-fit rounded-lg bg-brand-500/10 border border-brand-500/20 px-3 py-2 text-xs text-brand-400 hover:bg-brand-500/20 hover:text-brand-300 transition-all"
                    >
                      <ExternalLink size={12} />
                      <span className="truncate max-w-[300px]">{note.url}</span>
                    </a>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.04]">
                    <span className="text-xs text-white/25">
                      {formatDistanceToNow(new Date(note.createdAt), {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                      {note.updatedAt !== note.createdAt && " (diedit)"}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditNote(note)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-surface-200 transition-all cursor-pointer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History size={16} className="text-white/40" />
            <h2 className="text-base font-semibold text-white">Activity Log</h2>
            <Badge>{task.logs.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {task.logs.length === 0 ? (
            <p className="text-sm text-white/30 py-4 text-center">Belum ada aktivitas.</p>
          ) : (
            <div className="space-y-3">
              {task.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Clock size={14} className="text-white/25" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70">
                      <span className="font-medium text-white/90">{log.field}</span>
                      {log.field === "created" ? (
                        <> — task dibuat</>
                      ) : (
                        <>
                          {" "}diubah dari{" "}
                          <span className="text-white/40">{log.oldValue || "—"}</span>
                          {" "}ke{" "}
                          <span className="text-brand-400">{log.newValue || "—"}</span>
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/25">
                        {formatDistanceToNow(new Date(log.changedAt), {
                          addSuffix: true,
                          locale: idLocale,
                        })}
                      </span>
                      <Badge size="sm" variant={log.changedBy === "system" ? "brand" : "default"}>
                        {log.changedBy}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
