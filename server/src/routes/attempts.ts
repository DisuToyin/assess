import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAdmin } from "../auth.js";
import { HttpError } from "../errors.js";
import { answerSchema, snapshotSchema } from "../validation.js";
import {
  attemptInclude,
  expireAttempts,
  finalize,
  ownedAttempt,
  summaryAttempt,
  viewAttempt,
  gradeStatus,
} from "../services/attempts.js";
export const attemptsRouter = Router();
attemptsRouter.get("/", async (req, res) => {
  await expireAttempts();
  const admin = req.user!.role === "ADMIN";
  const filter = z
    .object({ testId: z.string().optional(), userId: z.string().optional() })
    .parse(req.query);
  const rows = await db.testAttempt.findMany({
    where: { ...(admin ? filter : { userId: req.user!.id }) },
    include: attemptInclude,
    orderBy: { startedAt: "desc" },
  });
  res.json(rows.map((a) => summaryAttempt(a, admin)));
});
attemptsRouter.get("/:id", async (req, res) => {
  await expireAttempts();
  const admin = req.user!.role === "ADMIN";
  res.json(
    viewAttempt(
      await ownedAttempt(String(req.params.id), req.user!.id, admin),
      admin,
    ),
  );
});
attemptsRouter.put("/:id/answers", async (req, res) => {
  const input = z
    .object({ answers: z.array(answerSchema).max(200) })
    .parse(req.body);
  const id = String(req.params.id);
  // The deadline check and all writes share a transaction. A late request can never alter saved answers.
  const expired = await db.$transaction(
    async (tx) => {
      const attempt = await tx.testAttempt.findUnique({ where: { id } });
      if (!attempt || attempt.userId !== req.user!.id)
        throw new HttpError(404, "Attempt not found.");
      if (attempt.status !== "IN_PROGRESS")
        throw new HttpError(409, "This attempt is already submitted.");
      const now = new Date();
      if (now >= attempt.deadline) {
        await finalize(tx, id, true, now);
        return true;
      }
      const snapshot = snapshotSchema.parse(attempt.snapshot);
      for (const a of input.answers) {
        const q = snapshot.questions.find((q) => q.id === a.questionId);
        if (!q) throw new HttpError(400, "Unknown question.");
        if (q.type === "MULTI") {
          if (
            !Array.isArray(a.value) ||
            new Set(a.value).size !== a.value.length ||
            a.value.some((k) => !q.options.some((o) => o.key === k))
          )
            throw new HttpError(400, "Invalid selected answers.");
        } else {
          if (typeof a.value !== "string")
            throw new HttpError(400, "Expected a single answer.");
          if (
            ["MCQ", "TRUE_FALSE"].includes(q.type) &&
            a.value &&
            !q.options.some((o) => o.key === a.value)
          )
            throw new HttpError(400, "Unknown option.");
        }
        await tx.answer.upsert({
          where: {
            attemptId_questionId: { attemptId: id, questionId: a.questionId },
          },
          create: { attemptId: id, ...a },
          update: { value: a.value },
        });
      }
      return false;
    },
    { timeout: 20000 },
  );
  if (expired)
    throw new HttpError(
      409,
      "Time has expired. Your saved answers were automatically submitted.",
    );
  res.json({ savedAt: new Date().toISOString() });
});
attemptsRouter.post("/:id/submit", async (req, res) => {
  const id = String(req.params.id);
  const expired = await db.$transaction(
    async (tx) => {
      const a = await tx.testAttempt.findUnique({ where: { id } });
      if (!a || a.userId !== req.user!.id)
        throw new HttpError(404, "Attempt not found.");
      if (a.status !== "IN_PROGRESS") {
        if (a.expired) return true;
        return false; // An on-time retry is idempotent.
      }
      const now = new Date();
      const late = now >= a.deadline;
      await finalize(tx, id, late, now);
      return late;
    },
    { timeout: 20000 },
  );
  if (expired)
    throw new HttpError(
      409,
      "The deadline passed. Only previously saved answers were submitted automatically.",
    );
  res.json(viewAttempt(await ownedAttempt(id, req.user!.id, false), false));
});
attemptsRouter.put("/:id/grade", requireAdmin, async (req, res) => {
  const input = z
    .object({
      answers: z
        .array(
          z.object({
            questionId: z.string(),
            score: z.number().min(0).nullable(),
            comment: z.string().max(10000),
          }),
        )
        .max(200),
      feedback: z.string().max(20000),
      release: z.boolean(),
    })
    .parse(req.body);
  const id = String(req.params.id);
  await db.$transaction(async (tx) => {
    const a = await tx.testAttempt.findUnique({
      where: { id },
      include: attemptInclude,
    });
    if (!a || a.status !== "SUBMITTED")
      throw new HttpError(400, "Submit the attempt before grading.");
    const snapshot = snapshotSchema.parse(a.snapshot);
    if (
      input.answers.length !== snapshot.questions.length ||
      new Set(input.answers.map((v) => v.questionId)).size !==
        snapshot.questions.length
    )
      throw new HttpError(400, "Include one grade per question.");
    for (const answer of input.answers) {
      const q = snapshot.questions.find((q) => q.id === answer.questionId);
      if (!q || (answer.score !== null && answer.score > q.points))
        throw new HttpError(
          400,
          "A score exceeds the available points or refers to an unknown question.",
        );
      await tx.answer.update({
        where: {
          attemptId_questionId: {
            attemptId: id,
            questionId: answer.questionId,
          },
        },
        data: { score: answer.score, comment: answer.comment },
      });
    }
    const status = gradeStatus(input.answers.map((a) => a.score));
    if (input.release && status !== "GRADED")
      throw new HttpError(400, "Grade every answer before releasing results.");
    await tx.grade.update({
      where: { attemptId: id },
      data: {
        status,
        score: input.answers.reduce((n, a) => n + (a.score ?? 0), 0),
        released: input.release,
        releasedAt: input.release ? new Date() : null,
      },
    });
    await tx.feedback.upsert({
      where: { attemptId: id },
      create: { attemptId: id, text: input.feedback },
      update: { text: input.feedback },
    });
  });
  res.json(viewAttempt(await ownedAttempt(id, req.user!.id, true), true));
});
