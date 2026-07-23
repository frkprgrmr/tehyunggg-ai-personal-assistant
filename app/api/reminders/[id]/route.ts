import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/reminders/[id] — Update reminder (dismiss, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await db.reminder.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Reminder not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.title) updates.title = body.title;
  if (body.message) updates.message = body.message;
  if (body.remindAt) updates.remindAt = new Date(body.remindAt);

  const reminder = await db.reminder.update({
    where: { id },
    data: updates,
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return Response.json(reminder);
}

// DELETE /api/reminders/[id] — Delete reminder
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.reminder.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Reminder not found" }, { status: 404 });
  }

  await db.reminder.delete({ where: { id } });
  return Response.json({ success: true });
}
