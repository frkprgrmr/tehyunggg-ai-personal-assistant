import { PrismaClient } from "@prisma/client";

// We can't use @/lib path aliases in standalone scripts, so inline the essentials
const db = new PrismaClient();

async function main() {
  const now = new Date();
  // Convert to WIB (UTC+7)
  const wibHour = (now.getUTCHours() + 7) % 24;
  const wibMinute = now.getUTCMinutes();

  console.log(`[DailyReviewCron] Running at ${now.toISOString()} (WIB: ${wibHour}:${String(wibMinute).padStart(2, "0")})`);

  // Morning: 07:30 - 08:30 window
  // Evening: 17:00 - 17:30 window
  let reviewType: "Morning" | "Evening" | null = null;

  if (wibHour === 8 && wibMinute < 30) {
    reviewType = "Morning";
  } else if (wibHour === 7 && wibMinute >= 30) {
    reviewType = "Morning";
  } else if (wibHour === 17 && wibMinute < 30) {
    reviewType = "Evening";
  }

  // Also support --force-morning or --force-evening flags for manual testing
  const args = process.argv.slice(2);
  if (args.includes("--force-morning")) {
    reviewType = "Morning";
    console.log("[DailyReviewCron] Force generating Morning review");
  } else if (args.includes("--force-evening")) {
    reviewType = "Evening";
    console.log("[DailyReviewCron] Force generating Evening review");
  }

  if (!reviewType) {
    console.log("[DailyReviewCron] Not in review window. Skipping.");
    return;
  }

  // Get the single user (single-user app)
  const user = await db.user.findFirst();
  if (!user) {
    console.log("[DailyReviewCron] No user found. Skipping.");
    return;
  }

  // Check if review already exists for today
  const wibDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const todayStart = new Date(wibDate);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(wibDate);
  todayEnd.setHours(23, 59, 59, 999);
  const utcStart = new Date(todayStart.getTime() - 7 * 60 * 60 * 1000);
  const utcEnd = new Date(todayEnd.getTime() - 7 * 60 * 60 * 1000);

  const existing = await db.dailyReview.findFirst({
    where: {
      userId: user.id,
      type: reviewType,
      createdAt: { gte: utcStart, lte: utcEnd },
    },
  });

  if (existing) {
    console.log(`[DailyReviewCron] ${reviewType} review already exists for today. Skipping.`);
    return;
  }

  console.log(`[DailyReviewCron] Generating ${reviewType} review...`);

  // Call the generate API endpoint
  // Since this is a standalone script, we call the Next.js API via HTTP
  const apiUrl = process.env.AUTH_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${apiUrl}/api/daily-review/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: reviewType,
        userId: user.id,
        cronSecret: process.env.CRON_SECRET || "internal-cron",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[DailyReviewCron] ${reviewType} review generated successfully:`, data.id);
    } else {
      const err = await res.text();
      console.error(`[DailyReviewCron] Failed to generate review:`, err);
    }
  } catch (error) {
    console.error("[DailyReviewCron] Error calling generate API:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
