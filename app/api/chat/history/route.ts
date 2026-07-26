import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/chat/history — Get conversation history
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;

  // Fetch the latest 50 messages
  const rawMessages = await db.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Reverse them so they are in chronological order for the UI
  const messages = rawMessages.reverse();

  return Response.json(messages);
}
