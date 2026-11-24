import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db.js";
import { requireAdmin } from "../auth.js";
import { HttpError } from "../errors.js";
import { testSchema, snapshotSchema } from "../validation.js";
import { parseBulk } from "../services/bulk.js";
import {
  expireAttempts,
  attemptInclude,
  viewAttempt,
} from "../services/attempts.js";
export const testsRouter = Router();
const include = {
  questions: {
    orderBy: { position: "asc" as const },
    include: { options: true },
  },
  _count: { select: { attempts: true } },
};
testsRouter.get("/", async (req, res) => {
  await expireAttempts();
  const admin = req.user!.role === "ADMIN";
  const tests = await db.test.findMany({
    where: admin ? { deleted: false } : { deleted: false, published: true },
    include: { _count: { select: { questions: true, attempts: true } } },
    orderBy: { createdAt: "desc" },
  });
  const attempts = admin
    ? []
    : await db.testAttempt.findMany({
        where: { userId: req.user!.id },
        select: { id: true, testId: true, status: true },
      });
  res.json(
    tests.map((t) => ({
      ...t,
      questionCount: t._count.questions,
      attemptCount: admin ? t._count.attempts : undefined,
      _count: undefined,
      myAttempts: attempts.filter((a) => a.testId === t.id),
    })),
  );
});
testsRouter.post("/bulk-preview", requireAdmin, async (req, res) => {
  const { text } = z.object({ text: z.string().max(500000) }).parse(req.body);
  res.json(parseBulk(text));
});
testsRouter.get("/:id", requireAdmin, async (req, res) => {
  const test = await db.test.findFirst({
    where: { id: String(req.params.id), deleted: false },
    include,
  });
  if (!test) throw new HttpError(404, "Test not found.");
  res.json(test);
});
function questionCreates(questions: z.infer<typeof testSchema>["questions"]) {
  return questions.map((q, position) => ({
    prompt: q.prompt,
    type: q.type,
    points: q.points,
    correct: q.correct,
    guidelines: q.guidelines,
    caseSensitive: q.caseSensitive,
    position,
    options: { create: q.options },
  }));
}
testsRouter.post("/", requireAdmin, async (req, res) => {
  const { questions, version: _version, ...data } = testSchema.parse(req.body);
  const test = await db.test.create({
    data: { ...data, questions: { create: questionCreates(questions) } },
    include,
  });
  res.status(201).json(test);
});
testsRouter.put("/:id", requireAdmin, async (req, res) => {
  const { questions, version, ...data } = testSchema.parse(req.body);
  if (!version) throw new HttpError(400, "Test version is required.");
  const id = String(req.params.id);
  const test = await db.$transaction(async (tx) => {
    const updated = await tx.test.updateMany({
      where: { id, version, deleted: false },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new HttpError(
        409,
        "This test changed or was deleted. Reload before editing.",
      );
    await tx.question.deleteMany({ where: { testId: id } });
    await tx.test.update({
      where: { id },
      data: { questions: { create: questionCreates(questions) } },
    });
    return tx.test.findUniqueOrThrow({ where: { id }, include });
  });
  res.json(test);
});
testsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const result = await db.test.updateMany({
    where: { id: String(req.params.id), deleted: false },
    data: { deleted: true, published: false, version: { increment: 1 } },
  });
  if (!result.count) throw new HttpError(404, "Test not found.");
  res.json({ ok: true });
});
testsRouter.post("/:id/start", async (req, res) => {
  await expireAttempts();
  const testId = String(req.params.id);
  const userId = req.user!.id;
  const attempt = await db.$transaction(async (tx) => {
    const active = await tx.testAttempt.findFirst({
      where: { testId, userId, status: "IN_PROGRESS" },
      include: attemptInclude,
    });
    if (active) return active;
    const test = await tx.test.findFirst({
      where: { id: testId, deleted: false, published: true },
      include,
    });
    if (!test) throw new HttpError(404, "This test is not available.");
    const now = new Date();
    if (test.startsAt && test.startsAt > now)
      throw new HttpError(403, "This test has not opened yet.");
    if (test.endsAt && test.endsAt <= now)
      throw new HttpError(403, "This test has closed.");
    const count = await tx.testAttempt.count({ where: { testId, userId } });
    if (count && !test.multipleAttempts)
      throw new HttpError(409, "Only one attempt is allowed for this test.");
    const snapshot = snapshotSchema.parse({
      ...test,
      questions: test.questions,
    });
    if (!snapshot.questions.length)
      throw new HttpError(400, "This test has no questions.");
    const deadline = new Date(
      Math.min(
        now.getTime() + test.duration * 60000,
        test.endsAt?.getTime() ?? Infinity,
      ),
    );
    return tx.testAttempt.create({
      data: {
        testId,
        userId,
        number: count + 1,
        snapshot: snapshot as Prisma.InputJsonValue,
        startedAt: now,
        deadline,
      },
      include: attemptInclude,
    });
  });
  res.status(201).json(viewAttempt(attempt, false));
});
