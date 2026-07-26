import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

// GET /api/meetings — List all meetings
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await db.meeting.findMany({
    orderBy: { meetingDate: "desc" },
    select: {
      id: true,
      title: true,
      meetingDate: true,
      participants: true,
      summary: true,
      createdAt: true,
      _count: { select: { notes: true } },
    },
  });

  return Response.json(meetings);
}

// POST /api/meetings — Create a new meeting
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, transcript, meetingDate, participants } = body;

  if (!title || !meetingDate) {
    return Response.json(
      { error: "title and meetingDate are required" },
      { status: 400 }
    );
  }

  const meeting = await db.meeting.create({
    data: {
      title,
      transcript: transcript || "",
      meetingDate: new Date(meetingDate),
      participants: Array.isArray(participants) ? participants : [],
    },
  });

  return Response.json(meeting, { status: 201 });
}
