import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/meetings/:id — Get meeting detail with notes
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const meeting = await db.meeting.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!meeting) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  return Response.json(meeting);
}

// PATCH /api/meetings/:id — Update meeting (transcript, summary, etc.)
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowedFields = ["title", "transcript", "summary", "meetingDate", "participants"];
  const data: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      if (field === "meetingDate") {
        data[field] = new Date(body[field]);
      } else {
        data[field] = body[field];
      }
    }
  }

  const meeting = await db.meeting.update({
    where: { id },
    data,
  });

  return Response.json(meeting);
}

// DELETE /api/meetings/:id — Delete meeting
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db.meeting.delete({ where: { id } });

  return Response.json({ success: true });
}
