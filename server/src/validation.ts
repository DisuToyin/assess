import { z } from "zod";
export const questionSchema = z
  .object({
    id: z.string().optional(),
    prompt: z.string().trim().min(1).max(10000),
    type: z.enum(["MCQ", "MULTI", "TRUE_FALSE", "SHORT", "ESSAY"]),
    points: z.number().min(0.5).max(1000),
    options: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(10),
          text: z.string().trim().min(1).max(2000),
        }),
      )
      .max(20)
      .default([]),
    correct: z.array(z.string().trim().min(1).max(2000)).max(30).default([]),
    guidelines: z.string().max(10000).default(""),
    caseSensitive: z.boolean().default(false),
  })
  .superRefine((q, ctx) => {
    const choice = ["MCQ", "MULTI", "TRUE_FALSE"].includes(q.type);
    if (choice) {
      if (q.options.length < 2)
        ctx.addIssue({
          code: "custom",
          message: "Choice questions need at least two options.",
        });
      if (new Set(q.options.map((o) => o.key)).size !== q.options.length)
        ctx.addIssue({
          code: "custom",
          message: "Option keys must be unique.",
        });
      if (
        !q.correct.length ||
        q.correct.some((k) => !q.options.some((o) => o.key === k))
      )
        ctx.addIssue({
          code: "custom",
          message: "Select valid correct options.",
        });
      if (q.type !== "MULTI" && q.correct.length !== 1)
        ctx.addIssue({
          code: "custom",
          message: "Select exactly one correct option.",
        });
      if (
        q.type === "TRUE_FALSE" &&
        (q.options.length !== 2 ||
          !q.options.some((o) => o.key === "TRUE") ||
          !q.options.some((o) => o.key === "FALSE"))
      )
        ctx.addIssue({
          code: "custom",
          message: "True/false options must use TRUE and FALSE keys.",
        });
    }
    if (new Set(q.correct).size !== q.correct.length)
      ctx.addIssue({
        code: "custom",
        message: "Correct answers must be unique.",
      });
    if (!choice && q.options.length)
      ctx.addIssue({
        code: "custom",
        message: "Written questions cannot have options.",
      });
  });
export const testSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(20000),
    duration: z.number().int().min(1).max(360),
    published: z.boolean(),
    multipleAttempts: z.boolean(),
    passMark: z.number().min(0).max(100).nullable(),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    version: z.number().int().positive().optional(),
    questions: z.array(questionSchema).max(200),
  })
  .superRefine((t, ctx) => {
    if (t.published && !t.questions.length)
      ctx.addIssue({
        code: "custom",
        message: "Add a question before publishing.",
      });
    if (t.startsAt && t.endsAt && new Date(t.endsAt) <= new Date(t.startsAt))
      ctx.addIssue({
        code: "custom",
        message: "End date must be after start date.",
      });
  });
export const snapshotSchema = z.object({
  title: z.string(),
  description: z.string(),
  duration: z.number(),
  passMark: z.number().nullable(),
  questions: z.array(questionSchema.safeExtend({ id: z.string() })),
});
export type QuestionInput = z.infer<typeof questionSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export const answerSchema = z.object({
  questionId: z.string(),
  value: z.union([
    z.string().max(30000),
    z.array(z.string().max(2000)).max(20),
  ]),
});
