import { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { snapshotSchema, type Snapshot } from "../validation.js";
import { HttpError } from "../errors.js";
type Tx = Prisma.TransactionClient;
export const attemptInclude = {
  answers: true,
  grade: true,
  feedback: true,
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TestAttemptInclude;
export type FullAttempt = Prisma.TestAttemptGetPayload<{
  include: typeof attemptInclude;
}>;
export function automaticScore(
  q: Snapshot["questions"][number],
  value: Prisma.JsonValue,
): number | null {
  if (q.type === "ESSAY" || (q.type === "SHORT" && !q.correct.length))
    return null;
  if (q.type === "SHORT") {
    const normalize = (s: string) => {
      const trimmed = s.trim().replace(/\s+/g, " ");
      return q.caseSensitive ? trimmed : trimmed.toLocaleLowerCase("en");
    };
    return typeof value === "string" &&
      q.correct.some((a) => normalize(a) === normalize(value))
      ? q.points
      : 0;
  }
  const selected = Array.isArray(value)
    ? value
    : typeof value === "string" && value
      ? [value]
      : [];
  return selected.length === q.correct.length &&
    q.correct.every((k) => selected.includes(k))
    ? q.points
    : 0;
}
export function gradeStatus(scores: (number | null)[]): string {
  if (scores.every((s) => s !== null)) return "GRADED";
  return scores.some((s) => s !== null) ? "PARTIALLY_GRADED" : "PENDING";
}
export async function finalize(
  tx: Tx,
  id: string,
  expired: boolean,
  now: Date,
): Promise<void> {
  const attempt = await tx.testAttempt.findUniqueOrThrow({
    where: { id },
    include: { answers: true },
  });
  if (attempt.status !== "IN_PROGRESS") return;
  const snapshot = snapshotSchema.parse(attempt.snapshot);
  const marks: (number | null)[] = [];
  for (const q of snapshot.questions) {
    const saved = attempt.answers.find((a) => a.questionId === q.id);
    const value = saved?.value ?? (q.type === "MULTI" ? [] : "");
    const score = automaticScore(q, value);
    marks.push(score);
    await tx.answer.upsert({
      where: { attemptId_questionId: { attemptId: id, questionId: q.id } },
      create: {
        attemptId: id,
        questionId: q.id,
        value: value as Prisma.InputJsonValue,
        score,
      },
      update: { score },
    });
  }
  await tx.testAttempt.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      expired,
      submittedAt: expired ? attempt.deadline : now,
    },
  });
  await tx.grade.create({
    data: {
      attemptId: id,
      total: snapshot.questions.reduce((n, q) => n + q.points, 0),
      score: marks.reduce<number>((n, s) => n + (s ?? 0), 0),
      status: gradeStatus(marks),
    },
  });
}
export async function expireAttempts(): Promise<void> {
  const due = await db.testAttempt.findMany({
    where: { status: "IN_PROGRESS", deadline: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of due)
    await db.$transaction((tx) => finalize(tx, id, true, new Date()), {
      timeout: 20000,
    });
}
export function viewAttempt(a: FullAttempt, admin: boolean) {
  const snapshot = snapshotSchema.parse(a.snapshot);
  const visible = admin || a.grade?.released === true;
  return {
    id: a.id,
    testId: a.testId,
    number: a.number,
    user: admin ? a.user : undefined,
    status: a.status,
    startedAt: a.startedAt,
    deadline: a.deadline,
    submittedAt: a.submittedAt,
    expired: a.expired,
    serverNow: new Date().toISOString(),
    title: snapshot.title,
    description: snapshot.description,
    duration: snapshot.duration,
    passMark: visible ? snapshot.passMark : undefined,
    questions: snapshot.questions.map((q) =>
      visible
        ? q
        : {
            id: q.id,
            prompt: q.prompt,
            type: q.type,
            points: q.points,
            options: q.options,
          },
    ),
    answers: a.answers.map((answer) => ({
      questionId: answer.questionId,
      value: answer.value,
      ...(visible ? { score: answer.score, comment: answer.comment } : {}),
    })),
    grade: a.grade
      ? {
          status: a.grade.status,
          released: a.grade.released,
          ...(visible
            ? {
                total: a.grade.total,
                score: a.grade.score,
                releasedAt: a.grade.releasedAt,
              }
            : {}),
        }
      : null,
    feedback: visible ? (a.feedback?.text ?? "") : undefined,
  };
}
export function summaryAttempt(a: FullAttempt, admin: boolean) {
  const full = viewAttempt(a, admin);
  const {
    questions: _questions,
    answers: _answers,
    description: _description,
    ...summary
  } = full;
  return summary;
}
export async function ownedAttempt(
  id: string,
  userId: string,
  admin: boolean,
): Promise<FullAttempt> {
  const a = await db.testAttempt.findUnique({
    where: { id },
    include: attemptInclude,
  });
  if (!a || (!admin && a.userId !== userId))
    throw new HttpError(404, "Attempt not found.");
  return a;
}
