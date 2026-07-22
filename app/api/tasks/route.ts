import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { TaskStatus, TaskPriority, TaskCategory, Prisma } from "@prisma/client";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  projectId: z.string().optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

// GET /api/tasks — List tasks with filters and sorting
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as TaskStatus | null;
  const priority = searchParams.get("priority") as TaskPriority | null;
  const category = searchParams.get("category") as TaskCategory | null;
  const projectId = searchParams.get("projectId");
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const where: Prisma.TaskWhereInput = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (projectId) where.projectId = projectId;

  // Map sort field to valid Prisma orderBy
  const validSortFields = ["dueDate", "priority", "createdAt", "updatedAt", "title"];
  const sortField = validSortFields.includes(sort) ? sort : "createdAt";
  const sortOrder = order === "asc" ? "asc" : "desc";

  const tasks = await db.task.findMany({
    where,
    orderBy: { [sortField]: sortOrder },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { logs: true } },
    },
  });

  return Response.json(tasks);
}

// POST /api/tasks — Create a task
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { dueDate, ...rest } = parsed.data;

  const task = await db.task.create({
    data: {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  // Log creation
  await db.taskLog.create({
    data: {
      taskId: task.id,
      field: "created",
      oldValue: null,
      newValue: task.title,
      changedBy: "user",
    },
  });

  return Response.json(task, { status: 201 });
}
