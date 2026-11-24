import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
// Open SQLite first: this also handles Prisma 6's schema-engine failure on a missing database file.
const db = new PrismaClient();
try {
  await db.$queryRaw`SELECT 1`;
} finally {
  await db.$disconnect();
}
const require = createRequire(import.meta.url);
execFileSync(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
