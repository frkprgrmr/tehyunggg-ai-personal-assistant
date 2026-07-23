import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─── createTask ────────────────────────────────────────

export async function handleCreateTask(args: {
  title: string;
  description?: string;
  projectId?: string;
  dueDate?: string;
  priority?: string;
  category?: string;
}) {
  const task = await db.task.create({
    data: {
      title: args.title,
      description: args.description || null,
      projectId: args.projectId || null,
      dueDate: args.dueDate ? new Date(args.dueDate) : null,
      priority: (args.priority as "Low" | "Medium" | "High" | "Critical") || "Medium",
      category: (args.category as "Work" | "Personal") || "Work",
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  // Log creation with changedBy: 'system'
  await db.taskLog.create({
    data: {
      taskId: task.id,
      field: "created",
      oldValue: null,
      newValue: task.title,
      changedBy: "system",
    },
  });

  return task;
}

// ─── updateTask ────────────────────────────────────────

export async function handleUpdateTask(args: {
  taskId: string;
  fields: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    category?: string;
    dueDate?: string;
    projectId?: string;
  };
}) {
  const currentTask = await db.task.findUnique({ where: { id: args.taskId } });
  if (!currentTask) {
    return { error: `Task dengan ID ${args.taskId} tidak ditemukan.` };
  }

  const updates: Record<string, unknown> = {};
  const logEntries: {
    taskId: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: string;
  }[] = [];

  const fieldsToTrack = [
    "title",
    "description",
    "status",
    "priority",
    "category",
    "dueDate",
    "projectId",
  ] as const;

  for (const field of fieldsToTrack) {
    const newVal = args.fields[field];
    if (newVal !== undefined) {
      const oldVal = currentTask[field];
      const oldStr =
        oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? "");
      const newStr = String(newVal ?? "");

      if (field === "dueDate") {
        updates[field] = newVal ? new Date(newVal) : null;
      } else {
        updates[field] = newVal;
      }

      if (oldStr !== newStr) {
        logEntries.push({
          taskId: args.taskId,
          field,
          oldValue: oldStr || null,
          newValue: newStr || null,
          changedBy: "system",
        });
      }
    }
  }

  // Handle completedAt based on status changes
  if (args.fields.status === "Done" && currentTask.status !== "Done") {
    updates.completedAt = new Date();
  } else if (
    args.fields.status &&
    args.fields.status !== "Done" &&
    currentTask.status === "Done"
  ) {
    updates.completedAt = null;
  }

  const task = await db.task.update({
    where: { id: args.taskId },
    data: updates,
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  if (logEntries.length > 0) {
    await db.taskLog.createMany({ data: logEntries });
  }

  return task;
}

// ─── deleteTask ────────────────────────────────────────

export async function handleDeleteTask(args: { taskId: string }) {
  const task = await db.task.findUnique({ where: { id: args.taskId } });
  if (!task) {
    return { error: `Task dengan ID ${args.taskId} tidak ditemukan.`, success: false };
  }

  await db.task.delete({ where: { id: args.taskId } });
  return { success: true, deletedTitle: task.title };
}

// ─── searchTask ────────────────────────────────────────

export async function handleSearchTask(args: {
  query?: string;
  status?: string;
  priority?: string;
  category?: string;
  projectId?: string;
}) {
  const where: Prisma.TaskWhereInput = {};

  if (args.status) where.status = args.status as Prisma.EnumTaskStatusFilter;
  if (args.priority)
    where.priority = args.priority as Prisma.EnumTaskPriorityFilter;
  if (args.category)
    where.category = args.category as Prisma.EnumTaskCategoryFilter;
  if (args.projectId) where.projectId = args.projectId;

  if (args.query) {
    where.OR = [
      { title: { contains: args.query, mode: "insensitive" } },
      { description: { contains: args.query, mode: "insensitive" } },
    ];
  }

  const tasks = await db.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  return tasks;
}

// ─── searchProject ─────────────────────────────────────

export async function handleSearchProject(args: {
  query?: string;
}) {
  const where: Prisma.ProjectWhereInput = {};

  if (args.query) {
    where.OR = [
      { name: { contains: args.query, mode: "insensitive" } },
      { description: { contains: args.query, mode: "insensitive" } },
    ];
  }

  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      _count: { select: { tasks: true } },
    },
  });

  return projects;
}

// ─── createReminder ────────────────────────────────────

export async function handleCreateReminder(args: {
  title: string;
  message: string;
  remindAt: string;
  relatedTaskId?: string;
  userId: string;
}) {
  const reminder = await db.reminder.create({
    data: {
      userId: args.userId,
      title: args.title,
      message: args.message,
      remindAt: new Date(args.remindAt),
      relatedTaskId: args.relatedTaskId || null,
    },
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return reminder;
}

// ─── listReminders ─────────────────────────────────────

export async function handleListReminders(args: {
  status?: string;
  upcoming?: boolean;
  userId: string;
}) {
  const where: Prisma.ReminderWhereInput = {
    userId: args.userId,
  };

  if (args.status) {
    where.status = args.status as Prisma.EnumReminderStatusFilter;
  }

  if (args.upcoming) {
    where.status = "Pending";
    where.remindAt = { gte: new Date() };
  }

  const reminders = await db.reminder.findMany({
    where,
    orderBy: { remindAt: "asc" },
    take: 20,
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return reminders;
}

// ─── dismissReminder ───────────────────────────────────

export async function handleDismissReminder(args: {
  reminderId: string;
}) {
  const reminder = await db.reminder.findUnique({
    where: { id: args.reminderId },
  });

  if (!reminder) {
    return { error: `Reminder dengan ID ${args.reminderId} tidak ditemukan.` };
  }

  const updated = await db.reminder.update({
    where: { id: args.reminderId },
    data: { status: "Dismissed" },
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return updated;
}

// ─── Tool Router ───────────────────────────────────────

export async function executeToolCall(
  functionName: string,
  args: Record<string, unknown>,
  context?: { userId?: string }
): Promise<unknown> {
  switch (functionName) {
    case "createTask":
      return handleCreateTask(args as Parameters<typeof handleCreateTask>[0]);
    case "updateTask":
      return handleUpdateTask(args as Parameters<typeof handleUpdateTask>[0]);
    case "deleteTask":
      return handleDeleteTask(args as Parameters<typeof handleDeleteTask>[0]);
    case "searchTask":
      return handleSearchTask(args as Parameters<typeof handleSearchTask>[0]);
    case "searchProject":
      return handleSearchProject(args as Parameters<typeof handleSearchProject>[0]);
    case "createReminder":
      return handleCreateReminder({
        ...(args as Omit<Parameters<typeof handleCreateReminder>[0], "userId">),
        userId: context?.userId || "",
      });
    case "listReminders":
      return handleListReminders({
        ...(args as Omit<Parameters<typeof handleListReminders>[0], "userId">),
        userId: context?.userId || "",
      });
    case "dismissReminder":
      return handleDismissReminder(args as Parameters<typeof handleDismissReminder>[0]);
    default:
      return { error: `Unknown tool: ${functionName}` };
  }
}

