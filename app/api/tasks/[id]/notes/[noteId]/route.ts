import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateNoteSchema = z.object({
  content: z.string().min(1).optional(),
  url: z.string().url().optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string; noteId: string }> };

// PATCH /api/tasks/[id]/notes/[noteId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await params;
  const body = await request.json();
  const parsed = updateNoteSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const note = await db.taskNote.update({
      where: { id: noteId },
      data: parsed.data,
    });

    return Response.json(note);
  } catch {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }
}

// DELETE /api/tasks/[id]/notes/[noteId]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await params;

  try {
    await db.taskNote.delete({ where: { id: noteId } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }
}
