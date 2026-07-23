import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createReminderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  remindAt: z.string().min(1, "Remind time is required"), // ISO 8601
  relatedTaskId: z.string().optional(),
});

// GET /api/reminders — List reminders
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const upcoming = searchParams.get("upcoming"); // "true" to get future pending only

  const where: Record<string, unknown> = {
    userId: session.user.id!,
  };

  if (status) {
    where.status = status;
  }

  if (upcoming === "true") {
    where.status = "Pending";
    where.remindAt = { gte: new Date() };
  }

  const reminders = await db.reminder.findMany({
    where,
    orderBy: { remindAt: "asc" },
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return Response.json(reminders);
}

// POST /api/reminders — Create reminder
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createReminderSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const reminder = await db.reminder.create({
    data: {
      userId: session.user.id!,
      title: parsed.data.title,
      message: parsed.data.message,
      remindAt: new Date(parsed.data.remindAt),
      relatedTaskId: parsed.data.relatedTaskId || null,
    },
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return Response.json(reminder, { status: 201 });
}
