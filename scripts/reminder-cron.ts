import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function processReminders() {
  console.log(`[ReminderCron] Running at ${new Date().toISOString()}`);

  try {
    const dueReminders = await db.reminder.findMany({
      where: {
        status: "Pending",
        remindAt: { lte: new Date() },
      },
    });

    if (dueReminders.length === 0) {
      console.log("[ReminderCron] No pending due reminders.");
      return;
    }

    console.log(`[ReminderCron] Found ${dueReminders.length} due reminders. Updating status...`);

    const result = await db.reminder.updateMany({
      where: {
        id: { in: dueReminders.map((r) => r.id) },
      },
      data: { status: "Sent" },
    });

    console.log(`[ReminderCron] Updated ${result.count} reminders to 'Sent'.`);
  } catch (error) {
    console.error("[ReminderCron] Error processing reminders:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the script directly
processReminders()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
