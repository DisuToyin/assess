import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { publicUser, requireAdmin } from "../auth.js";
import { HttpError } from "../errors.js";
import {
  attemptInclude,
  expireAttempts,
  summaryAttempt,
} from "../services/attempts.js";
export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.get("/dashboard", async (_req, res) => {
  await expireAttempts();
  const [users, tests, attempts, pending, recent] = await Promise.all([
    db.user.count(),
    db.test.count({ where: { deleted: false } }),
    db.testAttempt.count(),
    db.grade.count({ where: { status: { not: "GRADED" } } }),
    db.testAttempt.findMany({
      where: { status: "SUBMITTED" },
      include: attemptInclude,
      orderBy: { submittedAt: "desc" },
      take: 6,
    }),
  ]);
  res.json({
    users,
    tests,
    attempts,
    pending,
    recent: recent.map((a) => summaryAttempt(a, true)),
  });
});
adminRouter.get("/users", async (req, res) => {
  const { search } = z
    .object({ search: z.string().max(200).default("") })
    .parse(req.query);
  const users = await db.user.findMany({
    where: {
      OR: [{ name: { contains: search } }, { email: { contains: search } }],
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { attempts: true } } },
  });
  res.json(
    users.map((u) => ({ ...publicUser(u), attemptCount: u._count.attempts })),
  );
});
adminRouter.patch("/users/:id", async (req, res) => {
  const { disabled } = z
    .object({ disabled: z.boolean() })
    .strict()
    .parse(req.body);
  const user = await db.user.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!user) throw new HttpError(404, "User not found.");
  if (user.role === "ADMIN")
    throw new HttpError(400, "Administrator accounts cannot be disabled here.");
  res.json(
    publicUser(
      await db.user.update({ where: { id: user.id }, data: { disabled } }),
    ),
  );
});
