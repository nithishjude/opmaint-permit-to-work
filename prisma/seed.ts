import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, DEMO_USERS, seedDemoData } from "../src/server/demo-seed";

const prisma = new PrismaClient();

seedDemoData(prisma)
  .then((counts) => {
    console.log("Seeded:", counts);
    console.log(`\nDemo logins (password for all: ${DEMO_PASSWORD})`);
    for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(15)} ${u.email.padEnd(22)} ${u.name}`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
