import { auth } from "@/lib/auth";
import { rescheduleTasksToTomorrow } from "@/lib/daily-review";

// POST /api/daily-review/reschedule — Reschedule pending tasks to tomorrow
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskIds } = await request.json();

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return Response.json(
      { error: "taskIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const results = await rescheduleTasksToTomorrow(taskIds);

  return Response.json({
    success: true,
    rescheduled: results.length,
    tasks: results.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate?.toISOString(),
    })),
  });
}
