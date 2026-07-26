import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/daily-review/latest — Get latest review not yet shown in chat
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const review = await db.dailyReview.findFirst({
    where: {
      userId: session.user.id!,
      shownInChat: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!review) {
    return Response.json(null);
  }

  // Mark as shown
  await db.dailyReview.update({
    where: { id: review.id },
    data: { shownInChat: true },
  });

  return Response.json(review);
}
