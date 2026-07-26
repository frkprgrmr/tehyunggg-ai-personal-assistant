import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

// GET /api/daily-review — List daily reviews
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type"); // "Morning" | "Evening"
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  const where: Record<string, unknown> = {
    userId: session.user.id!,
  };

  if (type === "Morning" || type === "Evening") {
    where.type = type;
  }

  const reviews = await db.dailyReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 50),
  });

  return Response.json(reviews);
}
