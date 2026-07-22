"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FolderKanban, Trash2, Edit2, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { tasks: number };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingProject(null);
    setName("");
    setDescription("");
    setShowModal(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingProject) {
        // Update
        await fetch(`/api/projects/${editingProject.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: description || undefined }),
        });
      } else {
        // Create
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: description || undefined }),
        });
      }
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(projectId: string) {
    if (!confirm("Hapus project ini? Tasks yang terkait tidak akan terhapus.")) return;
    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-white/50 text-sm mt-1">
            {projects.length} project{projects.length !== 1 && "s"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          New Project
        </Button>
      </div>

      {/* Project List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-40 bg-surface-50 rounded-2xl border border-white/[0.06] animate-pulse"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <FolderKanban size={48} className="mx-auto text-white/15 mb-4" />
              <p className="text-white/40 mb-1">Belum ada project.</p>
              <p className="text-white/25 text-sm">Buat project pertama untuk mengorganisir tasks.</p>
              <Button variant="secondary" className="mt-4" onClick={openCreate}>
                <Plus size={14} />
                Buat Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => (
            <Card key={project.id} hover>
              <CardContent className="p-5">
                <div
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white truncate hover:text-brand-400 transition-colors">
                        {project.name}
                      </h3>
                    </Link>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => openEdit(project)}
                        className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-surface-100 transition-all cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-1.5 rounded-lg text-white/25 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-white/40 mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1.5 text-white/30">
                      <ListTodo size={14} />
                      <span className="text-xs">{project._count.tasks} tasks</span>
                    </div>
                    <Badge size="sm">
                      {format(new Date(project.createdAt), "dd MMM yyyy", { locale: idLocale })}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingProject ? "Edit Project" : "New Project"}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g. Odoo Migration"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Description"
            placeholder="Deskripsi project (opsional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} isLoading={saving} disabled={!name.trim()}>
              {editingProject ? "Save Changes" : "Create Project"}
            </Button>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
