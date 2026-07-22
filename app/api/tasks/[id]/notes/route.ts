import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createNoteSchema = z.object({
  content: z.string().min(1, "Catatan tidak boleh kosong"),
  url: z.string().url("URL tidak valid").optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/tasks/[id]/notes
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const notes = await db.taskNote.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(notes);
}

// POST /api/tasks/[id]/notes
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = createNoteSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify task exists
  const task = await db.task.findUnique({ where: { id } });
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const note = await db.taskNote.create({
    data: {
      taskId: id,
      content: parsed.data.content,
      url: parsed.data.url || null,
    },
  });

  return Response.json(note, { status: 201 });
}
