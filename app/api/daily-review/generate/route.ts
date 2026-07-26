import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateMorningReview,
  generateEveningReview,
  saveReview,
  hasReviewToday,
} from "@/lib/daily-review";

// POST /api/daily-review/generate — Generate a daily review
export async function POST(request: Request) {
  const body = await request.json();
  const { type, userId: cronUserId, cronSecret } = body;

  // Auth: either via session or via cron secret
  let userId: string;

  if (cronSecret === (process.env.CRON_SECRET || "internal-cron")) {
    // Called from cron script
    if (!cronUserId) {
      return Response.json({ error: "userId required for cron calls" }, { status: 400 });
    }
    userId = cronUserId;
  } else {
    // Called from UI (manual trigger)
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id!;
  }

  if (type !== "Morning" && type !== "Evening") {
    return Response.json(
      { error: "Invalid type. Must be 'Morning' or 'Evening'" },
      { status: 400 }
    );
  }

  // Check if review already exists for today
  const exists = await hasReviewToday(userId, type);
  if (exists) {
    return Response.json(
      { error: `${type} review already exists for today` },
      { status: 409 }
    );
  }

  // Generate review content
  const content =
    type === "Morning"
      ? await generateMorningReview(userId)
      : await generateEveningReview(userId);

  // Save to DB
  const review = await saveReview(userId, type, content);

  return Response.json(review, { status: 201 });
}
