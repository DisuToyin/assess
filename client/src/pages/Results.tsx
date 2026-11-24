import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  CheckCircle2,
  Clock3,
  FileCheck,
  LockKeyhole,
  Save,
  Send,
  ArrowRight,
} from "lucide-react";
import { api, json, message } from "../api";
import { Brand } from "../components/Layout";
import {
  BackLink,
  Badge,
  dateTime,
  ErrorBox,
  Field,
  Heading,
  Modal,
  Notice,
  Score,
  Status,
} from "../components/ui";
import type { Attempt, Question } from "../types";
function display(value: string | string[] | undefined, q: Question) {
  if (!value || (Array.isArray(value) && !value.length))
    return "No answer provided";
  const keys = Array.isArray(value) ? value : [value];
  return q.options.length
    ? keys.map((k) => q.options.find((o) => o.key === k)?.text ?? k).join(", ")
    : keys.join(", ");
}
export default function Results({
  attempt: a,
  onSaved,
  admin,
}: {
  attempt: Attempt;
  onSaved: () => void;
  admin: boolean;
}) {
  const [marks, setMarks] = useState<
    Record<string, { score: number | null; comment: string }>
  >(
    Object.fromEntries(
      a.questions.map((q) => {
        const answer = a.answers.find((v) => v.questionId === q.id);
        return [
          q.id!,
          { score: answer?.score ?? null, comment: answer?.comment ?? "" },
        ];
      }),
    ),
  );
  const [feedback, setFeedback] = useState(a.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirm, setConfirm] = useState(false);
  const released = a.grade?.released;
  const submitted = a.status === "SUBMITTED";
  const visible = admin || released;
  const total = a.questions.reduce((n, q) => n + q.points, 0);
  const score = Object.values(marks).reduce((n, m) => n + (m.score ?? 0), 0);
  const ungraded = Object.values(marks).filter((m) => m.score === null).length;
  const percentage =
    a.grade?.score !== undefined && a.grade.total
      ? (100 * a.grade.score) / a.grade.total
      : 0;
  const minutes = a.submittedAt
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(a.submittedAt) - Date.parse(a.startedAt)) / 60000,
        ),
      )
    : null;
  async function save(release: boolean) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(
        `/attempts/${a.id}/grade`,
        json("PUT", {
          answers: Object.entries(marks).map(([questionId, mark]) => ({
            questionId,
            ...mark,
          })),
          feedback,
          release,
        }),
      );
      setSuccess(
        release
          ? "Results released. The learner can now review their grade and feedback."
          : "Grading saved. Results are private until you release them.",
      );
      setConfirm(false);
      onSaved();
    } catch (e) {
      setError(message(e));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="results-page">
      <header className="results-header">
        <Link to="/">
          <Brand />
        </Link>
        <Link className="text-link" to={admin ? "/submissions" : "/history"}>
          {admin ? "All submissions" : "My history"}
          <ArrowRight size={16} />
        </Link>
      </header>
      <main className="results-content">
        <BackLink to={admin ? "/submissions" : "/history"}>
          {admin ? "Back to submissions" : "Back to your history"}
        </BackLink>
        <Heading
          eyebrow={
            admin
              ? "A LITTLE FEEDBACK MAKES A DIFFERENCE"
              : "ANOTHER STEP FORWARD"
          }
          title={a.title}
          description={
            admin
              ? `${a.user?.name} · ${a.user?.email} · Attempt ${a.number}`
              : `Attempt ${a.number} · ${dateTime(a.startedAt)}`
          }
          action={
            <Status
              status={
                a.status === "IN_PROGRESS"
                  ? a.status
                  : (a.grade?.status ?? "PENDING")
              }
              released={released}
            />
          }
        />
        <ErrorBox error={error} />
        {success && <Notice>{success}</Notice>}
        {!submitted && (
          <div className="warning-note">
            <Clock3 size={19} />
            This assessment is in progress. Grading becomes available after
            submission. Deadline: {dateTime(a.deadline)}.
          </div>
        )}
        {submitted && !visible ? (
          <section className="panel result-pending">
            <div className="pending-icon">
              <LockKeyhole size={29} />
            </div>
            <div className="eyebrow">YOUR WORK IS IN</div>
            <h2>Good work. Your results are on their way.</h2>
            <p>
              Your assessment was{" "}
              {a.expired
                ? "automatically submitted when time expired"
                : "submitted successfully"}
              . Your administrator will release your score and feedback after
              reviewing your answers.
            </p>
            <Badge tone="amber">Awaiting results</Badge>
          </section>
        ) : (
          <div className="result-stats">
            <div>
              <span className="result-stat-icon">
                <Award size={24} />
              </span>
              <span>{admin ? "Current score" : "Your score"}</span>
              <strong>
                <Score
                  score={admin ? score : a.grade?.score}
                  total={admin ? total : a.grade?.total}
                />
              </strong>
            </div>
            <div>
              <span className="result-stat-icon">
                <FileCheck size={24} />
              </span>
              <span>Percentage</span>
              <strong>
                {admin
                  ? (total ? (score / total) * 100 : 0).toFixed(1)
                  : percentage.toFixed(1)}
                <small>%</small>
              </strong>
            </div>
            <div>
              <span className="result-stat-icon">
                <Clock3 size={24} />
              </span>
              <span>Time spent</span>
              <strong>
                {minutes ?? "—"}
                <small> min</small>
              </strong>
            </div>
            <div>
              <span className="result-stat-icon">
                <CheckCircle2 size={24} />
              </span>
              <span>Outcome</span>
              <strong className="outcome">
                {a.passMark === null || a.passMark === undefined
                  ? "Completed"
                  : (admin
                        ? total
                          ? (score / total) * 100
                          : 0
                        : percentage) >= a.passMark
                    ? "Passed"
                    : "Not passed"}
              </strong>
              {a.passMark !== null && a.passMark !== undefined && (
                <small>Pass mark: {a.passMark}%</small>
              )}
            </div>
          </div>
        )}
        <div className="result-meta">
          <span>Started {dateTime(a.startedAt)}</span>
          <span>Submitted {dateTime(a.submittedAt)}</span>
          {a.expired && (
            <Badge tone="amber">Time expired · auto-submitted</Badge>
          )}
        </div>
        {visible && (
          <section className="panel padded">
            <div className="section-title">
              <span className="step-number">↗</span>
              <div>
                <h2>
                  {admin
                    ? "Overall feedback"
                    : "A note from your administrator"}
                </h2>
                <p>
                  {admin
                    ? "Give this learner something useful to take forward."
                    : "A little guidance for your next step."}
                </p>
              </div>
            </div>
            {admin && submitted ? (
              <textarea
                aria-label="Overall feedback"
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What went well? What could they explore next?"
              />
            ) : (
              <p className="feedback-text">
                {a.feedback || "No overall feedback added."}
              </p>
            )}
          </section>
        )}
        <div className="section-heading">
          <h2>{admin ? "Review & grade answers" : "Your answers"}</h2>
          <span className="muted">
            {a.questions.length} questions
            {admin && submitted ? ` · ${ungraded} awaiting marks` : ""}
          </span>
        </div>
        <div className="review-questions">
          {a.questions.map((q, index) => {
            const answer = a.answers.find((v) => v.questionId === q.id);
            return (
              <article className="panel padded review-question" key={q.id}>
                <div className="review-question-top">
                  <span>QUESTION {String(index + 1).padStart(2, "0")}</span>
                  <Badge>{q.points} points</Badge>
                </div>
                <h3>{q.prompt}</h3>
                <div className="answer-review">
                  <span className="field-label">
                    {admin ? "Submitted answer" : "Your answer"}
                  </span>
                  <p>{display(answer?.value, q)}</p>
                </div>
                {visible && (
                  <>
                    <div className="correct-answer">
                      <span className="field-label">
                        {q.type === "ESSAY"
                          ? "Grading guidance"
                          : q.correct?.length
                            ? "Correct / accepted answer"
                            : "Grading guidance"}
                      </span>
                      <p>
                        {q.correct?.length
                          ? display(q.correct, q)
                          : q.guidelines || "Manual review required."}
                      </p>
                      {!!q.correct?.length && q.guidelines && (
                        <small>{q.guidelines}</small>
                      )}
                    </div>
                    {admin && submitted ? (
                      <div className="grading-fields">
                        <Field label={`Score (out of ${q.points})`}>
                          <input
                            aria-label={`Score for question ${index + 1}`}
                            type="number"
                            step="0.5"
                            min={0}
                            max={q.points}
                            placeholder="Ungraded"
                            value={marks[q.id!]?.score ?? ""}
                            onChange={(e) =>
                              setMarks((previous) => ({
                                ...previous,
                                [q.id!]: {
                                  ...previous[q.id!],
                                  score:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Comment for this answer">
                          <textarea
                            rows={2}
                            value={marks[q.id!]?.comment ?? ""}
                            onChange={(e) =>
                              setMarks((previous) => ({
                                ...previous,
                                [q.id!]: {
                                  ...previous[q.id!],
                                  comment: e.target.value,
                                },
                              }))
                            }
                            placeholder="A helpful note…"
                          />
                        </Field>
                      </div>
                    ) : (
                      <div className="review-marks">
                        <strong>
                          {answer?.score ?? "—"} / {q.points} points
                        </strong>
                        {answer?.comment && <p>{answer.comment}</p>}
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
        {admin && submitted && (
          <div className="grading-toolbar">
            <div>
              <strong>
                {score} / {total} points
              </strong>
              <small>
                {ungraded
                  ? `${ungraded} answers still need marks`
                  : "All answers graded"}{" "}
                · {released ? "Currently released" : "Results are private"}
              </small>
            </div>
            <div className="row-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void save(false)}
              >
                <Save size={16} />
                {released ? "Save & withhold results" : "Save grading"}
              </button>
              <button
                className="button primary"
                disabled={busy || ungraded > 0}
                onClick={() => setConfirm(true)}
              >
                <Send size={16} />
                Release results
              </button>
            </div>
          </div>
        )}
      </main>
      {confirm && (
        <Modal
          title="Share their progress?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
          actions={
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Keep reviewing
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                {busy ? "Releasing…" : "Release results"}
              </button>
            </>
          }
        >
          <p>
            <strong>{a.user?.name}</strong> will be able to see their score,
            correct answers, and all your feedback.
          </p>
          <p>
            Final score:{" "}
            <strong>
              {score} / {total}
            </strong>
            .
          </p>
        </Modal>
      )}
    </div>
  );
}
