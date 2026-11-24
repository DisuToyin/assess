import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  CloudCheck,
  AlertTriangle,
  Send,
  LogOut,
} from "lucide-react";
import { api, ApiError, json, message } from "../api";
import { Brand } from "../components/Layout";
import { ErrorBox, Modal } from "../components/ui";
import type { Attempt, Question } from "../types";
type Values = Record<string, string | string[]>;
export default function Exam({
  attempt: a,
  onSubmitted,
}: {
  attempt: Attempt;
  onSubmitted: () => void;
}) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Values>(
    Object.fromEntries(a.answers.map((v) => [v.questionId, v.value])),
  );
  const [saveState, setSaveState] = useState("All answers saved");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"submit" | "leave" | null>(null);
  const [busy, setBusy] = useState(false);
  const draft = useRef(values);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const activeSave = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const expired = useRef(false);
  const anchor = useRef({
    server: Date.parse(a.serverNow),
    local: performance.now(),
  });
  const getRemaining = useCallback(
    () =>
      Math.max(
        0,
        Date.parse(a.deadline) -
          anchor.current.server -
          (performance.now() - anchor.current.local),
      ),
    [a.deadline],
  );
  const [remaining, setRemaining] = useState(getRemaining);
  const save = useCallback(async () => {
    if (activeSave.current) return activeSave.current;
    if (savedRevision.current >= revision.current) return;
    const task = (async () => {
      while (savedRevision.current < revision.current) {
        const currentRevision = revision.current;
        const snapshot = { ...draft.current };
        if (mounted.current) setSaveState("Saving answers…");
        try {
          await api(
            `/attempts/${a.id}/answers`,
            json("PUT", {
              answers: Object.entries(snapshot).map(([questionId, value]) => ({
                questionId,
                value,
              })),
            }),
          );
          savedRevision.current = currentRevision;
          if (mounted.current) {
            setSaveState("All answers saved");
            setError("");
          }
        } catch (e) {
          if (mounted.current) {
            setSaveState("Answers not saved");
            setError(message(e));
            if (e instanceof ApiError && e.status === 409) onSubmitted();
          }
          throw e;
        }
      }
    })();
    activeSave.current = task;
    try {
      await task;
    } finally {
      activeSave.current = null;
    }
  }, [a.id, onSubmitted]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const left = getRemaining();
      setRemaining(left);
      if (left <= 0 && !expired.current) {
        expired.current = true;
        onSubmitted();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [getRemaining, onSubmitted]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void save().catch(() => undefined);
    }, 600);
    return () => clearTimeout(timer);
  }, [values, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (savedRevision.current < revision.current) e.preventDefault();
    };
    const flush = () => {
      if (document.visibilityState === "hidden")
        void save().catch(() => undefined);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [save]);
  function answer(value: string | string[]) {
    const id = a.questions[index].id!;
    draft.current = { ...draft.current, [id]: value };
    revision.current++;
    setValues(draft.current);
    setSaveState("Unsaved changes");
  }
  async function finish() {
    setBusy(true);
    setError("");
    try {
      await save();
      if (confirm === "leave") {
        navigate("/");
        return;
      }
      await api(`/attempts/${a.id}/submit`, json("POST", {}));
      onSubmitted();
    } catch (e) {
      setError(message(e));
      setConfirm(null);
      if (e instanceof ApiError && e.status === 409) onSubmitted();
    } finally {
      setBusy(false);
    }
  }
  const answered = (q: Question) => {
    const v = values[q.id!];
    return Array.isArray(v) ? v.length > 0 : !!v?.trim();
  };
  const count = a.questions.filter(answered).length;
  const q = a.questions[index];
  const seconds = Math.ceil(remaining / 1000);
  const timer = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <div className="exam-page">
      <header className="exam-header">
        <Brand />
        <div className="exam-title">
          <strong>{a.title}</strong>
          <span>Attempt {a.number}</span>
        </div>
        <div
          className={`exam-timer ${remaining < 300000 ? "urgent" : ""}`}
          role="timer"
          aria-label={`${Math.ceil(remaining / 60000)} minutes remaining`}
        >
          <Clock3 size={19} />
          <span>
            {timer}
            <small>TIME REMAINING</small>
          </span>
        </div>
      </header>
      <div className="exam-progress">
        <i style={{ width: `${(count / a.questions.length) * 100}%` }} />
      </div>
      <main className="exam-layout">
        <aside className="exam-navigation">
          <div className="eyebrow">YOUR PROGRESS</div>
          <h2>
            {count} <span>of {a.questions.length} answered</span>
          </h2>
          <div className="question-map">
            {a.questions.map((question, i) => (
              <button
                key={question.id}
                className={`${i === index ? "current" : ""} ${answered(question) ? "answered" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}${answered(question) ? ", answered" : ""}`}
                aria-current={i === index ? "step" : undefined}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="map-legend">
            <span>
              <i />
              Not answered
            </span>
            <span>
              <i className="done" />
              Answered
            </span>
          </div>
          <div className="exam-save">
            <CloudCheck size={18} />
            {saveState}
          </div>
          {error && (
            <button
              className="text-link"
              onClick={() => void save().catch(() => undefined)}
            >
              Retry saving
            </button>
          )}
          <p className="exam-note">
            Your answers save as you go. Your test will submit automatically
            when time runs out.
          </p>
          <button className="text-button" onClick={() => setConfirm("leave")}>
            <LogOut size={15} />
            Save & leave
          </button>
        </aside>
        <section className="exam-question">
          <ErrorBox error={error} />
          <div className="exam-question-meta">
            <span>
              QUESTION {String(index + 1).padStart(2, "0")} OF{" "}
              {String(a.questions.length).padStart(2, "0")}
            </span>
            <span>
              {q.points} point{q.points === 1 ? "" : "s"}
            </span>
          </div>
          <h1>{q.prompt}</h1>
          <p className="question-hint">
            {q.type === "MULTI"
              ? "Select all answers that apply."
              : q.type === "SHORT"
                ? "Write a short answer in the space below."
                : q.type === "ESSAY"
                  ? "Take a moment to organize your thoughts, then write your answer."
                  : "Choose the best answer."}
          </p>
          <AnswerInput
            question={q}
            value={values[q.id!] ?? (q.type === "MULTI" ? [] : "")}
            onChange={answer}
          />
          <div className="exam-question-footer">
            <button
              className="button secondary"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={16} />
              Previous
            </button>
            {index < a.questions.length - 1 ? (
              <button
                className="button primary"
                onClick={() => setIndex((i) => i + 1)}
              >
                Next question
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="button primary"
                onClick={() => setConfirm("submit")}
              >
                Review & submit
                <Send size={16} />
              </button>
            )}
          </div>
        </section>
      </main>
      <footer className="exam-footer">
        <span>A little focus goes a long way.</span>
        <button className="text-link" onClick={() => setConfirm("submit")}>
          Submit assessment
          <ArrowRight size={16} />
        </button>
      </footer>
      {confirm && (
        <Modal
          title={
            confirm === "leave" ? "Save your place?" : "Ready to hand it in?"
          }
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          actions={
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Keep working
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void finish()}
              >
                {busy
                  ? "Please wait…"
                  : confirm === "leave"
                    ? "Save & leave"
                    : "Submit assessment"}
                <Check size={17} />
              </button>
            </>
          }
        >
          <p>
            {confirm === "leave"
              ? "Your answers will be saved, and you can return from your dashboard. The timer will continue while you are away."
              : `You’ve answered ${count} of ${a.questions.length} questions. Once submitted, you won’t be able to change your answers.`}
          </p>
          {count < a.questions.length && confirm === "submit" && (
            <div className="warning-note">
              <AlertTriangle size={18} />
              {a.questions.length - count} question
              {a.questions.length - count === 1 ? " is" : "s are"} unanswered.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function AnswerInput({
  question: q,
  value,
  onChange,
}: {
  question: Question;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  if (q.type === "SHORT" || q.type === "ESSAY")
    return (
      <textarea
        className="exam-written"
        aria-label="Your answer"
        rows={q.type === "ESSAY" ? 12 : 4}
        maxLength={30000}
        placeholder="Your answer goes here…"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <div className="exam-options">
      {q.options.map((o) => {
        const selected = Array.isArray(value)
          ? value.includes(o.key)
          : value === o.key;
        return (
          <label
            className={`exam-option ${selected ? "selected" : ""}`}
            key={o.key}
          >
            <input
              type={q.type === "MULTI" ? "checkbox" : "radio"}
              name={q.id}
              checked={selected}
              onChange={() => {
                if (q.type === "MULTI") {
                  const previous = Array.isArray(value) ? value : [];
                  onChange(
                    selected
                      ? previous.filter((k) => k !== o.key)
                      : [...previous, o.key],
                  );
                } else onChange(o.key);
              }}
            />
            <span className="option-key">
              {o.key === "TRUE" ? "T" : o.key === "FALSE" ? "F" : o.key}
            </span>
            <span>{o.text}</span>
            {selected && <Check size={19} />}
          </label>
        );
      })}
    </div>
  );
}
