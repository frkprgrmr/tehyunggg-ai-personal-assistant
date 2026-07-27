import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { GoogleGenAI } from "@google/genai";
import {
  startOfDay,
  endOfDay,
} from "date-fns";

// ─── Database Setup ─────────────────────────────────────
const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ─── AI Setup ───────────────────────────────────────────
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// ─── Types ──────────────────────────────────────────────
interface DailyReviewContent {
  type: "Morning" | "Evening";
  date: string;
  tasks: { id: string; taskNumber: number; title: string; status: string; priority: string; dueDate: string | null; projectName: string | null }[];
  completedTasks: { id: string; taskNumber: number; title: string; completedAt: string | null; projectName: string | null }[];
  overdueTasks: { id: string; taskNumber: number; title: string; dueDate: string | null; priority: string; projectName: string | null }[];
  pendingTasks: { id: string; taskNumber: number; title: string; dueDate: string | null; priority: string; projectName: string | null }[];
  reminders: { id: string; title: string; message: string; remindAt: string }[];
  summary: string;
}

// ─── Helper: Get WIB "today" boundaries in UTC ─────────
function getWIBDayBounds(date: Date = new Date()) {
  const wibDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const todayStart = startOfDay(wibDate);
  const todayEnd = endOfDay(wibDate);
  const utcStart = new Date(todayStart.getTime() - 7 * 60 * 60 * 1000);
  const utcEnd = new Date(todayEnd.getTime() - 7 * 60 * 60 * 1000);
  return { utcStart, utcEnd, wibDate: todayStart };
}

// ─── Generate Morning Review ────────────────────────────
async function generateMorningReview(userId: string): Promise<DailyReviewContent> {
  const { utcStart, utcEnd, wibDate } = getWIBDayBounds();

  const todayTasks = await db.task.findMany({
    where: { status: { notIn: ["Done", "Cancelled"] }, dueDate: { gte: utcStart, lte: utcEnd } },
    include: { project: { select: { name: true } } },
    orderBy: { priority: "desc" },
  });

  const overdueTasks = await db.task.findMany({
    where: { status: { notIn: ["Done", "Cancelled"] }, dueDate: { lt: utcStart, not: null } },
    include: { project: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });

  const inProgressTasks = await db.task.findMany({
    where: { status: "InProgress", dueDate: { not: { gte: utcStart, lte: utcEnd } } },
    include: { project: { select: { name: true } } },
    orderBy: { priority: "desc" },
  });

  const reminders = await db.reminder.findMany({
    where: { userId, status: "Pending", remindAt: { gte: utcStart, lte: utcEnd } },
    orderBy: { remindAt: "asc" },
  });

  const allTasks = [...todayTasks, ...inProgressTasks];
  const seen = new Set<string>();
  const uniqueTasks = allTasks.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });

  const content: DailyReviewContent = {
    type: "Morning",
    date: wibDate.toISOString(),
    tasks: uniqueTasks.map((t) => ({ id: t.id, taskNumber: t.taskNumber, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate?.toISOString() || null, projectName: t.project?.name || null })),
    completedTasks: [],
    overdueTasks: overdueTasks.map((t) => ({ id: t.id, taskNumber: t.taskNumber, title: t.title, dueDate: t.dueDate?.toISOString() || null, priority: t.priority, projectName: t.project?.name || null })),
    pendingTasks: [],
    reminders: reminders.map((r) => ({ id: r.id, title: r.title, message: r.message, remindAt: r.remindAt.toISOString() })),
    summary: "",
  };

  content.summary = await generateSummary(content);
  return content;
}

// ─── Generate Evening Review ────────────────────────────
async function generateEveningReview(userId: string): Promise<DailyReviewContent> {
  const { utcStart, utcEnd, wibDate } = getWIBDayBounds();

  const completedTasks = await db.task.findMany({
    where: { status: "Done", completedAt: { gte: utcStart, lte: utcEnd } },
    include: { project: { select: { name: true } } },
    orderBy: { completedAt: "desc" },
  });

  const pendingTasks = await db.task.findMany({
    where: { status: { notIn: ["Done", "Cancelled"] }, dueDate: { lte: utcEnd, not: null } },
    include: { project: { select: { name: true } } },
    orderBy: { priority: "desc" },
  });

  const reminders = await db.reminder.findMany({
    where: { userId, status: { not: "Dismissed" }, remindAt: { gte: utcStart, lte: utcEnd } },
    orderBy: { remindAt: "asc" },
  });

  const content: DailyReviewContent = {
    type: "Evening",
    date: wibDate.toISOString(),
    tasks: [],
    completedTasks: completedTasks.map((t) => ({ id: t.id, taskNumber: t.taskNumber, title: t.title, completedAt: t.completedAt?.toISOString() || null, projectName: t.project?.name || null })),
    overdueTasks: [],
    pendingTasks: pendingTasks.map((t) => ({ id: t.id, taskNumber: t.taskNumber, title: t.title, dueDate: t.dueDate?.toISOString() || null, priority: t.priority, projectName: t.project?.name || null })),
    reminders: reminders.map((r) => ({ id: r.id, title: r.title, message: r.message, remindAt: r.remindAt.toISOString() })),
    summary: "",
  };

  content.summary = await generateSummary(content);
  return content;
}

// ─── AI Summary Generator ───────────────────────────────
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
    const response = await genai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let text = "";
    try { text = response.text || ""; } catch { /* fallback */ }

    if (!text) {
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        text = parts.filter((p) => "text" in p && typeof p.text === "string").map((p) => (p as { text: string }).text).join("");
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
    if (content.overdueTasks.length > 0) parts.push(`Ada ${content.overdueTasks.length} task overdue yang perlu diperhatikan.`);
    if (content.reminders.length > 0) parts.push(`${content.reminders.length} reminder aktif hari ini.`);
    parts.push("Semangat! 💪");
    return parts.join(" ");
  } else {
    const parts = [];
    if (content.completedTasks.length > 0) parts.push(`Hari ini kamu menyelesaikan ${content.completedTasks.length} task. Nice! 🎉`);
    if (content.pendingTasks.length > 0) { parts.push(`Masih ada ${content.pendingTasks.length} task yang belum selesai.`); parts.push("Mau dipindahkan ke besok?"); }
    else parts.push("Semua task hari ini sudah beres! 🔥");
    return parts.join(" ");
  }
}

// ─── Main ───────────────────────────────────────────────
async function main() {
  const now = new Date();
  const wibHour = (now.getUTCHours() + 7) % 24;
  const wibMinute = now.getUTCMinutes();

  console.log(`[DailyReviewCron] Running at ${now.toISOString()} (WIB: ${wibHour}:${String(wibMinute).padStart(2, "0")})`);

  let reviewType: "Morning" | "Evening" | null = null;

  if (wibHour === 8 && wibMinute < 30) reviewType = "Morning";
  else if (wibHour === 7 && wibMinute >= 30) reviewType = "Morning";
  else if (wibHour === 17 && wibMinute < 30) reviewType = "Evening";

  const args = process.argv.slice(2);
  if (args.includes("--force-morning")) { reviewType = "Morning"; console.log("[DailyReviewCron] Force generating Morning review"); }
  else if (args.includes("--force-evening")) { reviewType = "Evening"; console.log("[DailyReviewCron] Force generating Evening review"); }

  if (!reviewType) { console.log("[DailyReviewCron] Not in review window. Skipping."); return; }

  const user = await db.user.findFirst();
  if (!user) { console.log("[DailyReviewCron] No user found. Skipping."); return; }

  // Check if review already exists for today
  const { utcStart, utcEnd } = getWIBDayBounds();
  const existing = await db.dailyReview.findFirst({
    where: { userId: user.id, type: reviewType, createdAt: { gte: utcStart, lte: utcEnd } },
  });

  if (existing) {
    console.log(`[DailyReviewCron] ${reviewType} review already exists for today. Skipping.`);
    return;
  }

  console.log(`[DailyReviewCron] Generating ${reviewType} review...`);

  try {
    const content = reviewType === "Morning"
      ? await generateMorningReview(user.id)
      : await generateEveningReview(user.id);

    const review = await db.dailyReview.create({
      data: {
        userId: user.id,
        type: reviewType,
        content: JSON.parse(JSON.stringify(content)) as Prisma.InputJsonValue,
      },
    });

    console.log(`[DailyReviewCron] ${reviewType} review generated successfully:`, review.id);
  } catch (error) {
    console.error("[DailyReviewCron] Error generating review:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => db.$disconnect());
