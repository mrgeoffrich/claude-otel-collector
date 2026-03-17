import { execSync } from "child_process";
import { beforeAll, afterAll } from "vitest";
import prisma from "../lib/prisma";

beforeAll(async () => {
  // Push schema to test database
  execSync("npx prisma db push --skip-generate", {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || "file:./test.db",
    },
    cwd: process.cwd(),
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
