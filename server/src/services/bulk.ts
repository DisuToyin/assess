import { questionSchema, type QuestionInput } from "../validation.js";
export function parseBulk(text: string): {
  questions: QuestionInput[];
  errors: string[];
} {
  const questions: QuestionInput[] = [];
  const errors: string[] = [];
  const chunks = text
    .replace(/\r/g, "")
    .split(/(?=^QUESTION\s*:)/im)
    .filter((s) => s.trim());
  for (const [index, chunk] of chunks.entries()) {
    const lines = chunk.trim().split("\n");
    const field = (name: string) =>
      lines
        .find((l) => new RegExp(`^${name}\\s*:`, "i").test(l))
        ?.replace(/^[^:]+:\s*/, "")
        .trim();
    const rawType = (field("TYPE") ?? "MCQ").toUpperCase();
    const aliases: Record<string, string> = {
      MCQ: "MCQ",
      MULTI: "MULTI",
      MULTIPLE_SELECT: "MULTI",
      TF: "TRUE_FALSE",
      TRUE_FALSE: "TRUE_FALSE",
      SHORT: "SHORT",
      ESSAY: "ESSAY",
    };
    const type = aliases[rawType] ?? rawType;
    const options =
      type === "TRUE_FALSE"
        ? [
            { key: "TRUE", text: "True" },
            { key: "FALSE", text: "False" },
          ]
        : lines.flatMap((l) => {
            const m = l.match(/^([A-T])[.)]\s+(.+)$/);
            return m ? [{ key: m[1]!, text: m[2]! }] : [];
          });
    const answer = field("ANSWER");
    const result = questionSchema.safeParse({
      prompt: field("QUESTION") ?? "",
      type,
      options,
      correct: answer
        ? type === "SHORT" || type === "ESSAY"
          ? answer.split("|").map((v) => v.trim())
          : answer.split(/[,\s]+/).map((v) => v.toUpperCase())
        : [],
      points: Number(field("POINTS") ?? 1),
      guidelines: field("GUIDELINES") ?? "",
      caseSensitive: false,
    });
    if (result.success) questions.push(result.data);
    else
      errors.push(
        `Question ${index + 1}: ${result.error.issues.map((i) => i.message).join(" ")}`,
      );
    const known =
      /^(QUESTION|TYPE|ANSWER|POINTS|GUIDELINES)\s*:|^[A-T][.)]\s+/i;
    const unknown = lines.filter((l) => l.trim() && !known.test(l));
    if (unknown.length)
      errors.push(
        `Question ${index + 1}: Unrecognized line(s): ${unknown.join(" / ")}`,
      );
  }
  if (!chunks.length) errors.push("Paste at least one QUESTION block.");
  return { questions, errors };
}
