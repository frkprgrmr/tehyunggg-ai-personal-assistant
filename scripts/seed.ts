import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcryptjs from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_USER_EMAIL || "umam@tehyungggg.local";
  const password = process.env.SEED_USER_PASSWORD || "changeme123";
  const name = process.env.SEED_USER_NAME || "Khoerul Umam";

  const hashedPassword = await bcryptjs.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password: hashedPassword },
    create: {
      email,
      name,
      password: hashedPassword,
    },
  });

  console.log(`✅ User seeded: ${user.name} (${user.email})`);

  // Seed some sample projects
  const projectWork = await prisma.project.upsert({
    where: { id: "seed-project-work" },
    update: {},
    create: {
      id: "seed-project-work",
      name: "Odoo Migration",
      description: "Migrasi Odoo ke versi terbaru",
    },
  });

  const projectPersonal = await prisma.project.upsert({
    where: { id: "seed-project-personal" },
    update: {},
    create: {
      id: "seed-project-personal",
      name: "Tehyungggg Development",
      description: "Personal assistant AI project",
    },
  });

  console.log(`✅ Projects seeded: ${projectWork.name}, ${projectPersonal.name}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
