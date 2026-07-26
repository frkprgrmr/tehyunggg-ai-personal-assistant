import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getGenAI, MODEL } from "@/lib/ai";
import {
  startOfDay,
  endOfDay,
  addDays,
} from "date-fns";

// ─── Types ─────────────────────────────────────────────

export interface DailyReviewContent {
  type: "Morning" | "Evening";
  date: string; // ISO date string (WIB date)
  tasks: {
    id: string;
    taskNumber: number;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectName: string | null;
  }[];
  completedTasks: {
    id: string;
    taskNumber: number;
    title: string;
    completedAt: string | null;
    projectName: string | null;
  }[];
  overdueTasks: {
    id: string;
    taskNumber: number;
    title: string;
    dueDate: string | null;
    priority: string;
    projectName: string | null;
  }[];
  pendingTasks: {
    id: string;
    taskNumber: number;
    title: string;
    dueDate: string | null;
    priority: string;
    projectName: string | null;
  }[];
  reminders: {
    id: string;
    title: string;
    message: string;
    remindAt: string;
  }[];
  summary: string; // AI-generated summary in casual Indonesian
}

// ─── Helper: Get WIB "today" boundaries in UTC ────────

function getWIBDayBounds(date: Date = new Date()) {
  // WIB is UTC+7. To get "today" in WIB:
  // 00:00 WIB = 17:00 UTC (previous day)
  // 23:59 WIB = 16:59 UTC (same day)
  const wibDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const todayStart = startOfDay(wibDate);
  const todayEnd = endOfDay(wibDate);

  // Convert back to UTC
  const utcStart = new Date(todayStart.getTime() - 7 * 60 * 60 * 1000);
  const utcEnd = new Date(todayEnd.getTime() - 7 * 60 * 60 * 1000);

  return { utcStart, utcEnd, wibDate: todayStart };
}

// ─── Generate Morning Review ───────────────────────────

export async function generateMorningReview(userId: string): Promise<DailyReviewContent> {
  const { utcStart, utcEnd, wibDate } = getWIBDayBounds();

  // Tasks due today (not done/cancelled)
  const todayTasks = await db.task.findMany({
    where: {
      status: { notIn: ["Done", "Cancelled"] },
      dueDate: { gte: utcStart, lte: utcEnd },
    },
    include: { project: { select: { name: true } } },
    orderBy: { priority: "desc" },
  });

  // Overdue tasks (dueDate before today, not done/cancelled)
  const overdueTasks = await db.task.findMany({
    where: {
      status: { notIn: ["Done", "Cancelled"] },
      dueDate: { lt: utcStart, not: null },
    },
    include: { project: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });

  // InProgress tasks (regardless of dueDate)
  const inProgressTasks = await db.task.findMany({
    where: {
      status: "InProgress",
      dueDate: { not: { gte: utcStart, lte: utcEnd } }, // exclude already listed
    },
    include: { project: { select: { name: true } } },
    orderBy: { priority: "desc" },
  });

  // Pending reminders for today
  const reminders = await db.reminder.findMany({
    where: {
      userId,
      status: "Pending",
      remindAt: { gte: utcStart, lte: utcEnd },
    },
    orderBy: { remindAt: "asc" },
  });

  // All active tasks for today (merge today + in progress, dedupe)
  const allTasks = [...todayTasks, ...inProgressTasks];
  const seen = new Set<string>();
  const uniqueTasks = allTasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  const content: DailyReviewContent = {
    type: "Morning",
    date: wibDate.toISOString(),
    tasks: uniqueTasks.map((t) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() || null,
      projectName: t.project?.name || null,
    })),
    completedTasks: [],
    overdueTasks: overdueTasks.map((t) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      title: t.title,
      dueDate: t.dueDate?.toISOString() || null,
      priority: t.priority,
      projectName: t.project?.name || null,
    })),
    pendingTasks: [],
    reminders: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      remindAt: r.remindAt.toISOString(),
    })),
    summary: "",
  };

  // Generate AI summary
  content.summary = await generateSummary(content);

  return content;
}

// ─── Generate Evening Review ───────────────────────────

export async function generateEveningReview(userId: string): Promise<DailyReviewContent> {
  const { utcStart, utcEnd, wibDate } = getWIBDayBounds();

  // Tasks completed today
  const completedTasks = await db.task.findMany({
    where: {
      status: "Done",
      completedAt: { gte: utcStart, lte: utcEnd },
    },
    include: { project: { select: { name: true } } },
    orderBy: { completedAt: "desc" },
  });

  // Tasks still pending (due today or overdue, not done)
  const pendingTasks = await db.task.findMany({
    where: {
      status: { notIn: ["Done", "Cancelled"] },
      dueDate: { lte: utcEnd, not: null },
    },
    include: { project: { select: { name: true } } },
    orderBy: { priority: "desc" },
  });

  // Active reminders that haven't been dismissed
  const reminders = await db.reminder.findMany({
    where: {
      userId,
      status: { not: "Dismissed" },
      remindAt: { gte: utcStart, lte: utcEnd },
    },
    orderBy: { remindAt: "asc" },
  });

  const content: DailyReviewContent = {
    type: "Evening",
    date: wibDate.toISOString(),
    tasks: [],
    completedTasks: completedTasks.map((t) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      title: t.title,
      completedAt: t.completedAt?.toISOString() || null,
      projectName: t.project?.name || null,
    })),
    overdueTasks: [],
    pendingTasks: pendingTasks.map((t) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      title: t.title,
      dueDate: t.dueDate?.toISOString() || null,
      priority: t.priority,
      projectName: t.project?.name || null,
    })),
    reminders: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      remindAt: r.remindAt.toISOString(),
    })),
    summary: "",
  };

  // Generate AI summary
  content.summary = await generateSummary(content);

  return content;
}

// ─── AI Summary Generator ──────────────────────────────

async function generateSummary(content: DailyReviewContent): Promise<string> {
  const isMorning = content.type === "Morning";

  const prompt = isMorning
    ? `Kamu adalah Tehyungggg, AI Personal Assistant. Buat ringkasan pagi yang singkat dan santai (bahasa Indonesia sehari-hari) untuk user.

Data hari ini:
- Task hari ini: ${content.tasks.length} task ${content.tasks.length > 0 ? `(${content.tasks.map((t) => `"${t.title}" [${t.priority}]`).join(", ")})` : "(tidak ada)"}
- Task overdue: ${content.overdueTasks.length} task ${content.overdueTasks.length > 0 ? `(${content.overdueTasks.map((t) => `"${t.title}"`).join(", ")})` : "(tidak ada)"}
- Reminder hari ini: ${content.reminders.length} reminder ${content.reminders.length > 0 ? `(${content.reminders.map((r) => `"${r.title}"`).join(", ")})` : "(tidak ada)"}

Buat ringkasan motivasi pagi yang:
1. Menyebutkan jumlah task dan highlight yang paling penting
2. Menyebutkan overdue task jika ada (dengan nada mengingatkan, bukan menuduh)
3. Menyebutkan reminder jika ada
4. Tutup dengan semangat atau motivasi singkat
5. Maksimal 3-4 kalimat saja, jangan terlalu panjang`
    : `Kamu adalah Tehyungggg, AI Personal Assistant. Buat ringkasan sore yang singkat dan santai (bahasa Indonesia sehari-hari) untuk user.

Data hari ini:
- Task selesai hari ini: ${content.completedTasks.length} task ${content.completedTasks.length > 0 ? `(${content.completedTasks.map((t) => `"${t.title}"`).join(", ")})` : "(tidak ada)"}
- Task masih pending/overdue: ${content.pendingTasks.length} task ${content.pendingTasks.length > 0 ? `(${content.pendingTasks.map((t) => `"${t.title}" [${t.priority}]`).join(", ")})` : "(tidak ada)"}
- Reminder belum selesai: ${content.reminders.length} reminder

Buat ringkasan sore yang:
1. Apresiasi task yang sudah selesai (kalau ada)
2. Sebutkan task yang masih pending
3. Jika ada task pending, tanyakan apakah mau dipindahkan ke besok
4. Maksimal 3-4 kalimat saja, jangan terlalu panjang`;

  try {
    const response = await getGenAI().models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let text = "";
    try {
      text = response.text || "";
    } catch {
      // Fallback
    }

    if (!text) {
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        text = parts
          .filter((p) => "text" in p && typeof p.text === "string")
          .map((p) => (p as { text: string }).text)
          .join("");
      }
    }

    return text || getDefaultSummary(content);
  } catch (error) {
    console.error("[DailyReview] Failed to generate AI summary:", error);
    return getDefaultSummary(content);
  }
}

function getDefaultSummary(content: DailyReviewContent): string {
  if (content.type === "Morning") {
    const parts = [`Pagi! Hari ini kamu punya ${content.tasks.length} task.`];
    if (content.overdueTasks.length > 0) {
      parts.push(`Ada ${content.overdueTasks.length} task overdue yang perlu diperhatikan.`);
    }
    if (content.reminders.length > 0) {
      parts.push(`${content.reminders.length} reminder aktif hari ini.`);
    }
    parts.push("Semangat! 💪");
    return parts.join(" ");
  } else {
    const parts = [];
    if (content.completedTasks.length > 0) {
      parts.push(`Hari ini kamu menyelesaikan ${content.completedTasks.length} task. Nice! 🎉`);
    }
    if (content.pendingTasks.length > 0) {
      parts.push(`Masih ada ${content.pendingTasks.length} task yang belum selesai.`);
      parts.push("Mau dipindahkan ke besok?");
    } else {
      parts.push("Semua task hari ini sudah beres! 🔥");
    }
    return parts.join(" ");
  }
}

// ─── Save Review to DB ─────────────────────────────────

export async function saveReview(
  userId: string,
  type: "Morning" | "Evening",
  content: DailyReviewContent
) {
  return db.dailyReview.create({
    data: {
      userId,
      type,
      content: JSON.parse(JSON.stringify(content)) as Prisma.InputJsonValue,
    },
  });
}

// ─── Check if review already exists for today ──────────

export async function hasReviewToday(
  userId: string,
  type: "Morning" | "Evening"
): Promise<boolean> {
  const { utcStart, utcEnd } = getWIBDayBounds();

  const existing = await db.dailyReview.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: utcStart, lte: utcEnd },
    },
  });

  return !!existing;
}

// ─── Reschedule tasks to tomorrow ──────────────────────

export async function rescheduleTasksToTomorrow(taskIds: string[]) {
  const tomorrow = addDays(new Date(), 1);
  const tomorrowStart = startOfDay(tomorrow);
  // Set to 09:00 WIB = 02:00 UTC
  const tomorrowMorning = new Date(tomorrowStart.getTime());
  tomorrowMorning.setUTCHours(2, 0, 0, 0);

  const results = [];

  for (const taskId of taskIds) {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) continue;

    const oldDueDate = task.dueDate?.toISOString() || null;

    const updated = await db.task.update({
      where: { id: taskId },
      data: { dueDate: tomorrowMorning },
      include: { project: { select: { name: true } } },
    });

    // Create TaskLog entry
    await db.taskLog.create({
      data: {
        taskId,
        field: "dueDate",
        oldValue: oldDueDate,
        newValue: tomorrowMorning.toISOString(),
        changedBy: "system",
      },
    });

    results.push(updated);
  }

  return results;
}
