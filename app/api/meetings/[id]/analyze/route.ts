import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { analyzeMeeting } from "@/lib/meeting-analyzer";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/meetings/:id/analyze — Trigger AI analysis
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const meeting = await db.meeting.findUnique({ where: { id } });
  if (!meeting) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (!meeting.transcript || meeting.transcript.trim().length < 10) {
    return Response.json(
      { error: "Transcript is too short or empty. Please add the meeting transcript first." },
      { status: 400 }
    );
  }

  // Run AI analysis
  const result = await analyzeMeeting(
    meeting.title,
    meeting.transcript,
    meeting.participants
  );

  // Save summary back to the meeting
  await db.meeting.update({
    where: { id },
    data: { summary: result.summary },
  });

  return Response.json({
    summary: result.summary,
    taskCandidates: result.taskCandidates,
  });
}
