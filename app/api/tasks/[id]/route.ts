import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { TaskStatus, TaskPriority, TaskCategory } from "@prisma/client";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/tasks/[id]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      logs: {
        orderBy: { changedAt: "desc" },
      },
    },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return Response.json(task);
}

// PATCH /api/tasks/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Get current task to compare changes
  const currentTask = await db.task.findUnique({ where: { id } });
  if (!currentTask) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const updates = parsed.data;
  const logEntries: {
    taskId: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: string;
  }[] = [];

  // Track changes for audit log
  const fieldsToTrack = ["title", "description", "projectId", "status", "priority", "category", "dueDate"] as const;

  for (const field of fieldsToTrack) {
    if (updates[field] !== undefined) {
      const oldVal = currentTask[field];
      const newVal = updates[field];

      // Only log if actually changed
      const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? "");
      const newStr = String(newVal ?? "");

      if (oldStr !== newStr) {
        logEntries.push({
          taskId: id,
          field,
          oldValue: oldStr || null,
          newValue: newStr || null,
          changedBy: "user",
        });
      }
    }
  }

  // Handle completedAt based on status changes
  const dataToUpdate: Record<string, unknown> = { ...updates };

  if (updates.dueDate !== undefined) {
    dataToUpdate.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
  }

  if (updates.status === "Done" && currentTask.status !== "Done") {
    dataToUpdate.completedAt = new Date();
  } else if (updates.status && updates.status !== "Done" && currentTask.status === "Done") {
    dataToUpdate.completedAt = null;
  }

  const task = await db.task.update({
    where: { id },
    data: dataToUpdate,
    include: {
      project: { select: { id: true, name: true } },
      logs: { orderBy: { changedAt: "desc" } },
    },
  });

  // Create audit logs
  if (logEntries.length > 0) {
    await db.taskLog.createMany({ data: logEntries });
  }

  return Response.json(task);
}

// DELETE /api/tasks/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.task.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }
}
