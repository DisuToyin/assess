import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  ClipboardPaste,
  Check,
  Save,
  Files,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api, json, message } from "../api";
import {
  BackLink,
  Badge,
  Empty,
  ErrorBox,
  Field,
  Heading,
  Loading,
  Modal,
  Notice,
} from "../components/ui";
import type { Question, QuestionType, Test } from "../types";
const typeNames: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  MULTI: "Multiple select",
  TRUE_FALSE: "True or false",
  SHORT: "Short answer",
  ESSAY: "Essay / long answer",
};
export const bulkExample = `QUESTION: What is the capital of Nigeria?
TYPE: MCQ
A. Lagos
B. Abuja
C. Kano
D. Kaduna
ANSWER: B
POINTS: 5

QUESTION: Nigeria gained independence in which year?
TYPE: SHORT
ANSWER: 1960
POINTS: 5

QUESTION: Explain the importance of database indexing.
TYPE: ESSAY
GUIDELINES: Discuss read performance and storage trade-offs.
POINTS: 10`;
const newQuestion = (): Question => ({
  prompt: "",
  type: "MCQ",
  points: 1,
  options: [
    { key: "A", text: "" },
    { key: "B", text: "" },
    { key: "C", text: "" },
    { key: "D", text: "" },
  ],
  correct: [],
  guidelines: "",
  caseSensitive: false,
});
type Draft = {
  title: string;
  description: string;
  duration: number;
  published: boolean;
  multipleAttempts: boolean;
  passMark: number | null;
  startsAt: string;
  endsAt: string;
  version?: number;
  questions: Question[];
};
const blank: Draft = {
  title: "",
  description: "",
  duration: 30,
  published: false,
  multipleAttempts: false,
  passMark: null,
  startsAt: "",
  endsAt: "",
  questions: [],
};
const localDate = (v: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(blank);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [bulk, setBulk] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!id) {
      setDraft(blank);
      setLoading(false);
      return;
    }
    let active = true;
    void api<Test>(`/tests/${id}`)
      .then((t) => {
        if (active)
          setDraft({
            ...t,
            startsAt: localDate(t.startsAt),
            endsAt: localDate(t.endsAt),
            questions: t.questions ?? [],
          });
      })
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(values: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...values }));
    setDirty(true);
    setNotice("");
  }
  function updateQuestion(index: number, q: Question) {
    update({
      questions: draft.questions.map((old, i) => (i === index ? q : old)),
    });
  }
  function move(index: number, offset: number) {
    const next = [...draft.questions];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    update({ questions: next });
    setExpanded(index + offset);
  }
  async function save() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const data = {
        ...draft,
        startsAt: draft.startsAt
          ? new Date(draft.startsAt).toISOString()
          : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      };
      const t = await api<Test>(
        id ? `/tests/${id}` : "/tests",
        json(id ? "PUT" : "POST", data),
      );
      setDraft({
        ...t,
        startsAt: localDate(t.startsAt),
        endsAt: localDate(t.endsAt),
        questions: t.questions ?? [],
      });
      setDirty(false);
      setNotice(
        t.published
          ? "Your assessment is published and ready."
          : "Draft saved. Keep shaping your assessment.",
      );
      if (!id) navigate(`/tests/${t.id}/edit`, { replace: true });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  return (
    <>
      <BackLink to="/tests">Assessment library</BackLink>
      <Heading
        eyebrow={id ? "MAKE IT YOUR OWN" : "FROM AN IDEA TO AN ASSESSMENT"}
        title={
          id ? "Refine your assessment." : "Create something worth learning."
        }
        description="Thoughtful questions make all the difference."
        action={
          <Badge tone={draft.published ? "green" : "neutral"}>
            {dirty
              ? "Unsaved changes"
              : draft.published
                ? "Published"
                : "Draft"}
          </Badge>
        }
      />
      <ErrorBox error={error} />
      {notice && <Notice>{notice}</Notice>}
      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel padded">
            <div className="section-title">
              <span className="step-number">01</span>
              <div>
                <h2>The essentials</h2>
                <p>Give your assessment a name and a little context.</p>
              </div>
            </div>
            <Field label="Test title">
              <input
                maxLength={200}
                placeholder="e.g. Introduction to product thinking"
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>
            <Field label="Description & instructions">
              <textarea
                rows={4}
                maxLength={20000}
                placeholder="What should learners know before they begin?"
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </Field>
          </section>
          <section className="panel padded">
            <div className="section-title">
              <span className="step-number">02</span>
              <div>
                <h2>Make room for questions</h2>
                <p>
                  Add one at a time, or paste a whole set. Save the assessment
                  to apply changes.
                </p>
              </div>
            </div>
            <div className="question-actions">
              <button
                className="button secondary"
                onClick={() => {
                  update({ questions: [...draft.questions, newQuestion()] });
                  setExpanded(draft.questions.length);
                }}
              >
                <Plus size={17} />
                Add a question
              </button>
              <button
                className="button secondary"
                onClick={() => setBulk(true)}
              >
                <ClipboardPaste size={17} />
                Paste questions
              </button>
            </div>
            {draft.questions.length === 0 ? (
              <Empty
                icon={<Files size={25} />}
                title="Every good assessment starts with a question."
              >
                Add your first question above. You can rearrange and refine it
                as you go.
              </Empty>
            ) : (
              <div className="question-editor-list">
                {draft.questions.map((q, index) => (
                  <article className="question-editor" key={index}>
                    <div className="question-editor-header">
                      <button
                        className="question-expand"
                        onClick={() =>
                          setExpanded(expanded === index ? null : index)
                        }
                      >
                        <span className="question-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <strong>{q.prompt || "Untitled question"}</strong>
                          <small>
                            {typeNames[q.type]} · {q.points} point
                            {q.points === 1 ? "" : "s"}
                          </small>
                        </span>
                        {expanded === index ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </button>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          disabled={index === 0}
                          aria-label="Move question up"
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={index === draft.questions.length - 1}
                          aria-label="Move question down"
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="icon-button danger-text"
                          aria-label="Delete question"
                          onClick={() => setRemove(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {expanded === index && (
                      <div className="question-editor-body">
                        <QuestionForm
                          question={q}
                          onChange={(q) => updateQuestion(index, q)}
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="editor-settings">
          <section className="panel padded">
            <div className="section-title">
              <span className="step-number">03</span>
              <div>
                <h2>A few final details</h2>
                <p>Set the pace and the parameters.</p>
              </div>
            </div>
            <Field label="Duration (minutes)">
              <input
                type="number"
                min={1}
                max={360}
                value={draft.duration}
                onChange={(e) => update({ duration: Number(e.target.value) })}
              />
            </Field>
            <Field
              label="Pass mark (%)"
              hint="Optional. Leave blank for no pass/fail outcome."
            >
              <input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 60"
                value={draft.passMark ?? ""}
                onChange={(e) =>
                  update({
                    passMark:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field
              label="Available from"
              hint="Optional. Times use your local timezone."
            >
              <input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => update({ startsAt: e.target.value })}
              />
            </Field>
            <Field label="Available until">
              <input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => update({ endsAt: e.target.value })}
              />
            </Field>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={draft.multipleAttempts}
                onChange={(e) => update({ multipleAttempts: e.target.checked })}
              />
              <span>
                Allow multiple attempts
                <small>Otherwise, each learner can take this test once.</small>
              </span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => update({ published: e.target.checked })}
              />
              <span>
                Publish assessment
                <small>Make this assessment visible to learners.</small>
              </span>
            </label>
            <div className="editor-total">
              <span>{draft.questions.length} questions</span>
              <strong>
                {draft.questions.reduce((n, q) => n + q.points, 0)} points
              </strong>
            </div>
            <button
              className="button primary full"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save size={17} />
              {busy
                ? "Saving…"
                : draft.published
                  ? "Save & publish"
                  : "Save draft"}
            </button>
            <p className="settings-note">
              Grades stay private until you choose to release them from a
              submission.
            </p>
          </section>
        </aside>
      </div>
      {bulk && (
        <BulkModal
          onClose={() => setBulk(false)}
          onAdd={(questions) => {
            update({ questions: [...draft.questions, ...questions] });
            setBulk(false);
            setExpanded(draft.questions.length);
          }}
        />
      )}
      {remove !== null && (
        <Modal
          title="Remove this question?"
          onClose={() => setRemove(null)}
          actions={
            <>
              <button
                className="button secondary"
                onClick={() => setRemove(null)}
              >
                Keep question
              </button>
              <button
                className="button danger"
                onClick={() => {
                  update({
                    questions: draft.questions.filter((_, i) => i !== remove),
                  });
                  setExpanded(null);
                  setRemove(null);
                }}
              >
                Remove question
              </button>
            </>
          }
        >
          <p>
            The question will be removed when you save the assessment. Existing
            attempts keep their original questions.
          </p>
        </Modal>
      )}
    </>
  );
}
function QuestionForm({
  question: q,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  const choice = ["MCQ", "MULTI", "TRUE_FALSE"].includes(q.type);
  function changeType(type: QuestionType) {
    onChange({
      ...q,
      type,
      correct: [],
      options:
        type === "TRUE_FALSE"
          ? [
              { key: "TRUE", text: "True" },
              { key: "FALSE", text: "False" },
            ]
          : ["MCQ", "MULTI"].includes(type)
            ? [
                { key: "A", text: "" },
                { key: "B", text: "" },
                { key: "C", text: "" },
                { key: "D", text: "" },
              ]
            : [],
    });
  }
  return (
    <>
      <div className="form-row">
        <Field label="Question type">
          <select
            value={q.type}
            onChange={(e) => changeType(e.target.value as QuestionType)}
          >
            {Object.entries(typeNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Points">
          <input
            type="number"
            min={0.5}
            max={1000}
            step={0.5}
            value={q.points}
            onChange={(e) => onChange({ ...q, points: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label="Question">
        <textarea
          rows={3}
          value={q.prompt}
          onChange={(e) => onChange({ ...q, prompt: e.target.value })}
          placeholder="What would you like to ask?"
        />
      </Field>
      {choice ? (
        <div className="options-editor">
          <div className="field-label">
            Answer options{" "}
            <small>
              Select the correct answer{q.type === "MULTI" ? "s" : ""}.
            </small>
          </div>
          {q.options.map((o, i) => (
            <div className="option-editor" key={o.key}>
              <input
                aria-label={`Mark ${o.key} correct`}
                type={q.type === "MULTI" ? "checkbox" : "radio"}
                checked={q.correct?.includes(o.key) ?? false}
                onChange={(e) =>
                  onChange({
                    ...q,
                    correct:
                      q.type === "MULTI"
                        ? e.target.checked
                          ? [...(q.correct ?? []), o.key]
                          : (q.correct ?? []).filter((k) => k !== o.key)
                        : [o.key],
                  })
                }
              />
              <span>{o.key}</span>
              <input
                aria-label={`Option ${o.key}`}
                value={o.text}
                disabled={q.type === "TRUE_FALSE"}
                onChange={(e) =>
                  onChange({
                    ...q,
                    options: q.options.map((old, j) =>
                      i === j ? { ...old, text: e.target.value } : old,
                    ),
                  })
                }
                placeholder={`Option ${o.key}`}
              />
              {q.type !== "TRUE_FALSE" && (
                <button
                  className="icon-button"
                  disabled={q.options.length <= 2}
                  aria-label={`Remove option ${o.key}`}
                  onClick={() =>
                    onChange({
                      ...q,
                      options: q.options.filter((_, j) => j !== i),
                      correct: q.correct?.filter((k) => k !== o.key),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {q.type !== "TRUE_FALSE" && q.options.length < 20 && (
            <button
              className="text-link"
              onClick={() => {
                const key = "ABCDEFGHIJKLMNOPQRST"
                  .split("")
                  .find((k) => !q.options.some((o) => o.key === k))!;
                onChange({ ...q, options: [...q.options, { key, text: "" }] });
              }}
            >
              <Plus size={15} />
              Add option
            </button>
          )}
        </div>
      ) : (
        <>
          {q.type === "SHORT" && (
            <>
              <Field
                label="Accepted answers"
                hint="Separate alternatives with |. Leave blank to require manual grading."
              >
                <input
                  value={q.correct?.join("|") ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      correct: e.target.value ? e.target.value.split("|") : [],
                    })
                  }
                  placeholder="e.g. 1960 | October 1960"
                />
              </Field>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={q.caseSensitive ?? false}
                  onChange={(e) =>
                    onChange({ ...q, caseSensitive: e.target.checked })
                  }
                />
                Case-sensitive matching
              </label>
            </>
          )}
          <Field
            label={
              q.type === "ESSAY"
                ? "Grading guidelines / expected answer"
                : "Grading guidelines"
            }
            hint="Only visible to administrators until results are released."
          >
            <textarea
              rows={3}
              value={q.guidelines ?? ""}
              onChange={(e) => onChange({ ...q, guidelines: e.target.value })}
            />
          </Field>
        </>
      )}
    </>
  );
}
function BulkModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (q: Question[]) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    questions: Question[];
    errors: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function preview() {
    setBusy(true);
    setError("");
    try {
      setResult(await api("/tests/bulk-preview", json("POST", { text })));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="A whole set, in one paste."
      onClose={onClose}
      actions={
        <>
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button secondary"
            disabled={busy || !text.trim()}
            onClick={() => void preview()}
          >
            {busy ? "Reading questions…" : "Preview questions"}
          </button>
          <button
            className="button primary"
            disabled={
              !result || result.errors.length > 0 || !result.questions.length
            }
            onClick={() => result && onAdd(result.questions)}
          >
            <Check size={16} />
            Add {result?.questions.length ?? 0} questions
          </button>
        </>
      }
    >
      <p>
        Use QUESTION, TYPE, ANSWER, and POINTS. Supported types: MCQ, MULTI, TF,
        SHORT, ESSAY. Separate multiple selections with commas and short-answer
        alternatives with |.
      </p>
      <button
        className="text-link"
        onClick={() => {
          setText(bulkExample);
          setResult(null);
        }}
      >
        Use an example
      </button>
      <textarea
        className="bulk-text"
        aria-label="Bulk question text"
        rows={13}
        value={text}
        placeholder={bulkExample}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
      />
      <ErrorBox error={error} />
      {result && (
        <div className="bulk-preview">
          {result.errors.length > 0 ? (
            <ErrorBox error={result.errors.join("\n")} />
          ) : (
            <Notice>
              {result.questions.length} questions ready to add. Review them
              below.
            </Notice>
          )}
          {result.questions.map((q, i) => (
            <div className="bulk-preview-item" key={i}>
              <strong>
                {i + 1}. {q.prompt}
              </strong>
              <span>
                {typeNames[q.type]} · {q.points} points
              </span>
              {q.options.map((o) => (
                <small key={o.key}>
                  {q.correct?.includes(o.key) ? "✓" : "○"} {o.key}. {o.text}
                </small>
              ))}
              {!!q.correct?.length && !q.options.length && (
                <small>Accepted: {q.correct.join(" | ")}</small>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
