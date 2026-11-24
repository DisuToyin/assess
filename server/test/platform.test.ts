import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import request from "supertest";
import { app } from "../src/app.js";
import { db } from "../src/db.js";
import { parseBulk } from "../src/services/bulk.js";
import { automaticScore, expireAttempts } from "../src/services/attempts.js";
import { snapshotSchema } from "../src/validation.js";
const origin = "http://localhost:5173";
const admin = request.agent(app);
const alice = request.agent(app);
const bob = request.agent(app);
let testId = "";
let attemptId = "";
let questionIds: string[] = [];
const questions = [
  {
    prompt: "Capital of Nigeria?",
    type: "MCQ",
    points: 5,
    options: [
      { key: "A", text: "Lagos" },
      { key: "B", text: "Abuja" },
    ],
    correct: ["B"],
    guidelines: "",
    caseSensitive: false,
  },
  {
    prompt: "Select even numbers",
    type: "MULTI",
    points: 5,
    options: [
      { key: "A", text: "2" },
      { key: "B", text: "4" },
      { key: "C", text: "3" },
    ],
    correct: ["A", "B"],
    guidelines: "",
    caseSensitive: false,
  },
  {
    prompt: "Nigeria independence year",
    type: "SHORT",
    points: 5,
    options: [],
    correct: ["1960"],
    guidelines: "",
    caseSensitive: false,
  },
  {
    prompt: "Explain indexing",
    type: "ESSAY",
    points: 10,
    options: [],
    correct: [],
    guidelines: "Cover read performance",
    caseSensitive: false,
  },
];
const testDraft = {
  title: "Foundations",
  description: "Answer carefully.",
  duration: 30,
  published: true,
  multipleAttempts: false,
  passMark: 60,
  startsAt: null,
  endsAt: null,
  questions,
};
before(async () => {
  // A dedicated, ignored SQLite database; never reset a configured development/production database.
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.DATABASE_URL, "file:./test.db");
  await db.$queryRaw`SELECT 1`;
  await db.$disconnect();
  execFileSync(
    process.execPath,
    ["../node_modules/prisma/build/index.js", "migrate", "deploy"],
    { cwd: process.cwd(), env: process.env, stdio: "pipe" },
  );
  await db.feedback.deleteMany();
  await db.grade.deleteMany();
  await db.answer.deleteMany();
  await db.testAttempt.deleteMany();
  await db.questionOption.deleteMany();
  await db.question.deleteMany();
  await db.test.deleteMany();
  await db.user.deleteMany();
});
after(async () => {
  await db.$disconnect();
});
test("registration never trusts roles, and reserves the admin email with a secret", async () => {
  await alice
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Alice Learner",
      email: "alice@example.com",
      password: "LearnerPass123!",
      role: "ADMIN",
    })
    .expect(201)
    .expect((r) => assert.equal(r.body.role, "TAKER"));
  await bob
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Bob Learner",
      email: "bob@example.com",
      password: "LearnerPass123!",
    })
    .expect(201);
  await request(app)
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Fake Admin",
      email: "disujt@gmail.com",
      password: "LearnerPass123!",
    })
    .expect(403);
  await admin
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Disu Admin",
      email: "DISUJT@gmail.com",
      password: "AdminPassword123!",
      adminSecret: process.env.ADMIN_REGISTRATION_SECRET,
    })
    .expect(201)
    .expect((r) => assert.equal(r.body.role, "ADMIN"));
  const user = await db.user.findUniqueOrThrow({
    where: { email: "alice@example.com" },
  });
  assert.notEqual(user.passwordHash, "LearnerPass123!");
  assert.match(user.passwordHash, /^\$2/);
});
test("authentication, origin validation, and admin authorization are enforced", async () => {
  await request(app).get("/api/tests").expect(401);
  await alice.get("/api/admin/dashboard").expect(403);
  await alice
    .post("/api/tests")
    .set("Origin", origin)
    .send(testDraft)
    .expect(403);
  await alice
    .post("/api/auth/logout")
    .set("Origin", "https://evil.example")
    .expect(403);
  await alice.post("/api/auth/logout").expect(403);
  await request(app)
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "alice@example.com", password: "invalidpassword" })
    .expect(401);
});
test("bulk parser validates every block and choice key before saving", () => {
  const valid = parseBulk(
    "QUESTION: Capital?\nTYPE: MCQ\nA. Lagos\nB. Abuja\nANSWER: B\nPOINTS: 5\n\nQUESTION: Year?\nTYPE: SHORT\nANSWER: 1960 | October 1960\nPOINTS: 5",
  );
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.questions.length, 2);
  assert.deepEqual(valid.questions[1]?.correct, ["1960", "October 1960"]);
  assert.ok(
    parseBulk("QUESTION: Bad\nTYPE: MCQ\nA. One\nB. Two\nANSWER: Z").errors
      .length,
  );
  assert.ok(
    parseBulk("QUESTION: Essay\nTYPE: ESSAY\nUnexpected content").errors.length,
  );
  assert.ok(parseBulk("").errors.length);
});
test("test creation validates publication and option correctness", async () => {
  await admin
    .post("/api/tests")
    .set("Origin", origin)
    .send({ ...testDraft, questions: [] })
    .expect(400);
  const created = await admin
    .post("/api/tests")
    .set("Origin", origin)
    .send(testDraft)
    .expect(201);
  testId = created.body.id;
  await alice.get(`/api/tests/${testId}`).expect(403);
  const list = await alice.get("/api/tests").expect(200);
  assert.equal(list.body[0].questions, undefined);
  assert.equal(list.body[0].questionCount, 4);
});
test("attempts resume with an identical server deadline and conceal answer keys", async () => {
  const started = await alice
    .post(`/api/tests/${testId}/start`)
    .set("Origin", origin)
    .send({ deadline: "2099-01-01", score: 100 })
    .expect(201);
  attemptId = started.body.id;
  questionIds = started.body.questions.map((q: { id: string }) => q.id);
  assert.equal(started.body.questions[0].correct, undefined);
  assert.equal(started.body.questions[3].guidelines, undefined);
  assert.ok(Date.parse(started.body.deadline) - Date.now() < 30 * 60000 + 1000);
  const resumed = await alice
    .post(`/api/tests/${testId}/start`)
    .set("Origin", origin)
    .send({})
    .expect(201);
  assert.equal(resumed.body.id, attemptId);
  assert.equal(resumed.body.deadline, started.body.deadline);
});
test("users cannot read or modify somebody else’s attempt", async () => {
  await bob.get(`/api/attempts/${attemptId}`).expect(404);
  await bob
    .put(`/api/attempts/${attemptId}/answers`)
    .set("Origin", origin)
    .send({ answers: [] })
    .expect(404);
  await bob
    .post(`/api/attempts/${attemptId}/submit`)
    .set("Origin", origin)
    .send({})
    .expect(404);
});
test("answer validation rejects unknown questions/options and saves valid answers", async () => {
  await alice
    .put(`/api/attempts/${attemptId}/answers`)
    .set("Origin", origin)
    .send({ answers: [{ questionId: "unknown", value: "x" }] })
    .expect(400);
  await alice
    .put(`/api/attempts/${attemptId}/answers`)
    .set("Origin", origin)
    .send({ answers: [{ questionId: questionIds[0], value: "Z" }] })
    .expect(400);
  await alice
    .put(`/api/attempts/${attemptId}/answers`)
    .set("Origin", origin)
    .send({
      answers: [
        { questionId: questionIds[0], value: "B" },
        { questionId: questionIds[1], value: ["B", "A"] },
        { questionId: questionIds[2], value: "  1960  " },
        {
          questionId: questionIds[3],
          value:
            "An index improves read performance, at the cost of writes and storage.",
        },
      ],
    })
    .expect(200);
  const loaded = await alice.get(`/api/attempts/${attemptId}`).expect(200);
  assert.equal(loaded.body.answers.length, 4);
});
test("editing a test cannot mutate an existing attempt snapshot; optimistic edits are checked", async () => {
  const current = await admin.get(`/api/tests/${testId}`).expect(200);
  await admin
    .put(`/api/tests/${testId}`)
    .set("Origin", origin)
    .send({
      ...testDraft,
      title: "Updated test",
      version: current.body.version,
      questions: [
        {
          ...questions[0],
          prompt: "Completely different question",
          correct: ["A"],
        },
      ],
    })
    .expect(200);
  await admin
    .put(`/api/tests/${testId}`)
    .set("Origin", origin)
    .send({ ...testDraft, version: current.body.version })
    .expect(409);
  const attempt = await alice.get(`/api/attempts/${attemptId}`).expect(200);
  assert.equal(attempt.body.title, "Foundations");
  assert.equal(attempt.body.questions.length, 4);
  assert.equal(attempt.body.questions[0].prompt, "Capital of Nigeria?");
});
test("submission auto-grades on the server and hides scores until explicit release", async () => {
  const submitted = await alice
    .post(`/api/attempts/${attemptId}/submit`)
    .set("Origin", origin)
    .send({ score: 25 })
    .expect(200);
  assert.equal(submitted.body.grade.status, "PARTIALLY_GRADED");
  assert.equal(submitted.body.grade.score, undefined);
  assert.equal(submitted.body.answers[0].score, undefined);
  assert.equal(submitted.body.feedback, undefined);
  const row = await db.grade.findUniqueOrThrow({ where: { attemptId } });
  assert.equal(row.score, 15);
  const list = await alice.get("/api/attempts").expect(200);
  assert.equal(list.body[0].grade.score, undefined);
  await alice
    .post(`/api/tests/${testId}/start`)
    .set("Origin", origin)
    .send({})
    .expect(409);
  await alice
    .put(`/api/attempts/${attemptId}/grade`)
    .set("Origin", origin)
    .send({})
    .expect(403);
});
test("manual grading validates limits, requires completion, and publishes feedback", async () => {
  const answers = questionIds.map((questionId, i) => ({
    questionId,
    score: i === 3 ? null : 5,
    comment: "Well done.",
  }));
  await admin
    .put(`/api/attempts/${attemptId}/grade`)
    .set("Origin", origin)
    .send({ answers, feedback: "Good work", release: true })
    .expect(400);
  answers[3]!.score = 99;
  await admin
    .put(`/api/attempts/${attemptId}/grade`)
    .set("Origin", origin)
    .send({ answers, feedback: "Good work", release: false })
    .expect(400);
  answers[3]!.score = 7.5;
  await admin
    .put(`/api/attempts/${attemptId}/grade`)
    .set("Origin", origin)
    .send({ answers, feedback: "Good work", release: false })
    .expect(200);
  let own = await alice.get(`/api/attempts/${attemptId}`);
  assert.equal(own.body.grade.score, undefined);
  await admin
    .put(`/api/attempts/${attemptId}/grade`)
    .set("Origin", origin)
    .send({ answers, feedback: "Good work", release: true })
    .expect(200);
  own = await alice.get(`/api/attempts/${attemptId}`).expect(200);
  assert.equal(own.body.grade.score, 22.5);
  assert.equal(own.body.grade.total, 25);
  assert.deepEqual(own.body.questions[0].correct, ["B"]);
  assert.equal(own.body.feedback, "Good work");
  assert.equal(own.body.answers[3].comment, "Well done.");
});
test("late saves and manual submissions are rejected; saved answers alone are auto-submitted", async () => {
  const created = await admin
    .post("/api/tests")
    .set("Origin", origin)
    .send({
      ...testDraft,
      title: "Expiry test",
      multipleAttempts: true,
      questions: [questions[0]],
    })
    .expect(201);
  const start = await bob
    .post(`/api/tests/${created.body.id}/start`)
    .set("Origin", origin)
    .send({})
    .expect(201);
  const id = start.body.id;
  const qid = start.body.questions[0].id;
  await bob
    .put(`/api/attempts/${id}/answers`)
    .set("Origin", origin)
    .send({ answers: [{ questionId: qid, value: "B" }] })
    .expect(200);
  await db.testAttempt.update({
    where: { id },
    data: { deadline: new Date(Date.now() - 1000) },
  });
  await bob
    .put(`/api/attempts/${id}/answers`)
    .set("Origin", origin)
    .send({ answers: [{ questionId: qid, value: "A" }] })
    .expect(409);
  await bob
    .post(`/api/attempts/${id}/submit`)
    .set("Origin", origin)
    .send({})
    .expect(409);
  const expired = await db.testAttempt.findUniqueOrThrow({
    where: { id },
    include: { answers: true, grade: true },
  });
  assert.equal(expired.expired, true);
  assert.equal(expired.answers[0]?.value, "B");
  assert.equal(expired.grade?.score, 5);
  assert.equal(
    expired.submittedAt?.toISOString(),
    expired.deadline.toISOString(),
  );
  const next = await bob
    .post(`/api/tests/${created.body.id}/start`)
    .set("Origin", origin)
    .send({})
    .expect(201);
  assert.equal(next.body.number, 2);
  await db.testAttempt.update({
    where: { id: next.body.id },
    data: { deadline: new Date(Date.now() - 1000) },
  });
  await expireAttempts();
  assert.equal(
    (await db.testAttempt.findUniqueOrThrow({ where: { id: next.body.id } }))
      .status,
    "SUBMITTED",
  );
});
test("availability and end-of-window deadlines are enforced", async () => {
  const future = await admin
    .post("/api/tests")
    .set("Origin", origin)
    .send({
      ...testDraft,
      title: "Future",
      startsAt: new Date(Date.now() + 3600000).toISOString(),
    })
    .expect(201);
  await alice
    .post(`/api/tests/${future.body.id}/start`)
    .set("Origin", origin)
    .send({})
    .expect(403);
  const end = new Date(Date.now() + 60000).toISOString();
  const ending = await admin
    .post("/api/tests")
    .set("Origin", origin)
    .send({ ...testDraft, title: "Closing soon", endsAt: end })
    .expect(201);
  const started = await alice
    .post(`/api/tests/${ending.body.id}/start`)
    .set("Origin", origin)
    .send({})
    .expect(201);
  assert.equal(started.body.deadline, end);
});
test("account disabling invalidates existing sessions and reactivation restores access", async () => {
  const user = await db.user.findUniqueOrThrow({
    where: { email: "bob@example.com" },
  });
  await admin
    .patch(`/api/admin/users/${user.id}`)
    .set("Origin", origin)
    .send({ disabled: true })
    .expect(200);
  await bob.get("/api/tests").expect(401);
  await admin
    .patch(`/api/admin/users/${user.id}`)
    .set("Origin", origin)
    .send({ disabled: false })
    .expect(200);
  await bob.get("/api/tests").expect(200);
  const owner = await db.user.findUniqueOrThrow({
    where: { email: "disujt@gmail.com" },
  });
  await admin
    .patch(`/api/admin/users/${owner.id}`)
    .set("Origin", origin)
    .send({ disabled: true })
    .expect(400);
});
test("soft deletion preserves released assessment history", async () => {
  await admin.delete(`/api/tests/${testId}`).set("Origin", origin).expect(200);
  const loaded = await alice.get(`/api/attempts/${attemptId}`).expect(200);
  assert.equal(loaded.body.title, "Foundations");
  assert.equal(loaded.body.grade.score, 22.5);
  await bob
    .post(`/api/tests/${testId}/start`)
    .set("Origin", origin)
    .send({})
    .expect(404);
  const dashboard = await admin.get("/api/admin/dashboard").expect(200);
  assert.equal(dashboard.body.users, 3);
});
test("automatic grading handles true/false, exact multi-select, and manual short answers", () => {
  const question = snapshotSchema.shape.questions.element.parse({
    id: "q",
    prompt: "Choose",
    type: "TRUE_FALSE",
    points: 3,
    options: [
      { key: "TRUE", text: "True" },
      { key: "FALSE", text: "False" },
    ],
    correct: ["TRUE"],
  });
  assert.equal(automaticScore(question, "TRUE"), 3);
  assert.equal(automaticScore(question, "FALSE"), 0);
  assert.equal(
    automaticScore({ ...question, type: "MULTI", correct: ["A", "B"] }, ["A"]),
    0,
  );
  assert.equal(
    automaticScore({ ...question, type: "SHORT", correct: [] }, "anything"),
    null,
  );
  assert.equal(
    automaticScore(
      { ...question, type: "SHORT", correct: ["Abuja"], caseSensitive: false },
      "  abuja  ",
    ),
    3,
  );
  assert.equal(
    automaticScore(
      { ...question, type: "SHORT", correct: ["Abuja"], caseSensitive: true },
      "abuja",
    ),
    0,
  );
});

test("withholding a released grade removes scores and correct answers from every learner projection", async () => {
  const review = await admin.get(`/api/attempts/${attemptId}`).expect(200);
  const answers = review.body.answers.map(
    (a: { questionId: string; score: number; comment: string }) => ({
      questionId: a.questionId,
      score: a.score,
      comment: a.comment,
    }),
  );
  await admin
    .put(`/api/attempts/${attemptId}/grade`)
    .set("Origin", origin)
    .send({ answers, feedback: "Private feedback", release: false })
    .expect(200);
  const own = await alice.get(`/api/attempts/${attemptId}`).expect(200);
  assert.equal(own.body.grade.score, undefined);
  assert.equal(own.body.grade.total, undefined);
  assert.equal(own.body.feedback, undefined);
  assert.equal(own.body.questions[0].correct, undefined);
  assert.equal(own.body.answers[0].comment, undefined);
  const history = await alice.get("/api/attempts").expect(200);
  assert.equal(
    history.body.find((a: { id: string }) => a.id === attemptId).grade.score,
    undefined,
  );
});

test("concurrent starts resume one attempt rather than duplicating it", async () => {
  const created = await admin
    .post("/api/tests")
    .set("Origin", origin)
    .send({
      ...testDraft,
      title: "Concurrent starts",
      multipleAttempts: true,
      questions: [questions[0]],
    })
    .expect(201);
  const starts = await Promise.all([
    bob
      .post(`/api/tests/${created.body.id}/start`)
      .set("Origin", origin)
      .send({}),
    bob
      .post(`/api/tests/${created.body.id}/start`)
      .set("Origin", origin)
      .send({}),
  ]);
  assert.deepEqual(
    starts.map((s) => s.status),
    [201, 201],
  );
  assert.equal(starts[0]!.body.id, starts[1]!.body.id);
  assert.equal(
    await db.testAttempt.count({ where: { testId: created.body.id } }),
    1,
  );
});
