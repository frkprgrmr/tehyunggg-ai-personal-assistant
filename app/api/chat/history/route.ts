import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/chat/history — Get conversation history
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id!;

  const messages = await db.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return Response.json(messages);
}
