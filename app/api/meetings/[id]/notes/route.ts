import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/meetings/:id/notes — List notes for a meeting
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const notes = await db.note.findMany({
    where: { meetingId: id },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(notes);
}

// POST /api/meetings/:id/notes — Add a note to a meeting
export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await request.json();

  if (!content || typeof content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const note = await db.note.create({
    data: {
      meetingId: id,
      content,
    },
  });

  return Response.json(note, { status: 201 });
}

// DELETE /api/meetings/:id/notes/:noteId — via separate route
