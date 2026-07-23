import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/reminders/due — Get reminders that are due (for notification polling)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reminders = await db.reminder.findMany({
    where: {
      userId: session.user.id!,
      status: "Sent", // Already processed by cron, ready to show
      remindAt: { lte: new Date() },
    },
    orderBy: { remindAt: "desc" },
    take: 20,
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  // Also include Pending reminders that are past due (in case cron hasn't run)
  const pendingDue = await db.reminder.findMany({
    where: {
      userId: session.user.id!,
      status: "Pending",
      remindAt: { lte: new Date() },
    },
    orderBy: { remindAt: "desc" },
    take: 20,
    include: {
      relatedTask: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  // Auto-mark pending due reminders as Sent
  if (pendingDue.length > 0) {
    await db.reminder.updateMany({
      where: {
        id: { in: pendingDue.map((r) => r.id) },
      },
      data: { status: "Sent" },
    });
  }

  const all = [...pendingDue, ...reminders];
  // Deduplicate
  const seen = new Set<string>();
  const unique = all.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return Response.json(unique);
}
