import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Clock3,
  FileQuestion,
  ArrowRight,
  ArrowUpRight,
  Files,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../auth";
import { api, json, message } from "../api";
import {
  Badge,
  dateTime,
  Empty,
  ErrorBox,
  Heading,
  Loading,
  Modal,
  useLoad,
} from "../components/ui";
import type { Test, Attempt } from "../types";
export function TestCard({ test: t }: { test: Test }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = t.myAttempts.find((a) => a.status === "IN_PROGRESS");
  const completed = t.myAttempts.length > 0;
  const upcoming = !!t.startsAt && new Date(t.startsAt) > new Date();
  const closed = !!t.endsAt && new Date(t.endsAt) <= new Date();
  const blocked =
    !active && (upcoming || closed || (completed && !t.multipleAttempts));
  async function start() {
    setBusy(true);
    setError("");
    try {
      const a = await api<Attempt>(`/tests/${t.id}/start`, json("POST", {}));
      navigate(`/attempts/${a.id}`);
    } catch (e) {
      setError(message(e));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="test-card">
      <div className="test-card-top">
        <span className="test-icon">
          <Files size={23} />
        </span>
        <Badge
          tone={
            active
              ? "blue"
              : closed
                ? "neutral"
                : upcoming
                  ? "amber"
                  : completed
                    ? "green"
                    : "green"
          }
        >
          {active
            ? "In progress"
            : closed
              ? "Closed"
              : upcoming
                ? "Upcoming"
                : completed
                  ? "Attempted"
                  : "Available"}
        </Badge>
      </div>
      <h3>{t.title}</h3>
      <p className="test-description">
        {t.description || "A new opportunity to show what you know."}
      </p>
      <div className="test-meta">
        <span>
          <Clock3 size={15} />
          {t.duration} min
        </span>
        <span>
          <FileQuestion size={15} />
          {t.questionCount} questions
        </span>
      </div>
      {t.startsAt && (
        <small className="availability">Opens {dateTime(t.startsAt)}</small>
      )}
      {t.endsAt && (
        <small className="availability">Closes {dateTime(t.endsAt)}</small>
      )}
      <div className="test-card-footer">
        <span>{t.multipleAttempts ? "Multiple attempts" : "One attempt"}</span>
        {active ? (
          <Link className="text-link" to={`/attempts/${active.id}`}>
            Continue <ArrowRight size={16} />
          </Link>
        ) : (
          <button
            className="text-link"
            disabled={blocked || busy}
            onClick={() => setConfirm(true)}
          >
            {completed && !t.multipleAttempts ? (
              <>
                <CheckCircle2 size={15} />
                Completed
              </>
            ) : completed ? (
              "Take again"
            ) : (
              "Start test"
            )}
            {!blocked && <ArrowRight size={16} />}
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      {confirm && (
        <Modal
          title="Ready to begin?"
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
                Not yet
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void start()}
              >
                {busy ? "Starting…" : "Start assessment"}
                <ArrowRight size={16} />
              </button>
            </>
          }
        >
          <p>
            You’re about to start <strong>{t.title}</strong>.
          </p>
          <div className="start-summary">
            <span>
              <Clock3 size={18} />
              {t.duration} minutes
            </span>
            <span>
              <FileQuestion size={18} />
              {t.questionCount} questions
            </span>
          </div>
          <p>
            The timer begins immediately and continues if you leave or refresh.{" "}
            {t.endsAt && "The test will also end at its closing time."} Your
            saved answers will be submitted automatically when time expires.
          </p>
        </Modal>
      )}
    </article>
  );
}
export default function Tests() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const { data, error, loading, reload } = useLoad<Test[]>("/tests");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deleting, setDeleting] = useState<Test | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const tests = (data ?? []).filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" ||
        (status === "published" ? t.published : !t.published)),
  );
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/tests/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      reload();
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow={admin ? "YOUR ASSESSMENT LIBRARY" : "OPPORTUNITIES TO GROW"}
        title={admin ? "Good tests start here." : "Find your next assessment."}
        description={
          admin
            ? "Create, refine, and share assessments with your learners."
            : "Choose a test and show what you know."
        }
        action={
          admin && (
            <Link className="button primary" to="/tests/new">
              <Plus size={17} />
              Create a test
            </Link>
          )
        }
      />
      <div className="toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search tests"
            placeholder="Search assessments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {admin && (
          <select
            aria-label="Publication status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        )}
        <span className="results-count">
          {tests.length} assessment{tests.length === 1 ? "" : "s"}
        </span>
      </div>
      <ErrorBox error={error} retry={reload} />
      <ErrorBox error={actionError} />
      {loading ? (
        <Loading />
      ) : !tests.length ? (
        <div className="panel">
          <Empty
            icon={<Files size={26} />}
            title={
              search
                ? "No matching assessments"
                : admin
                  ? "Your library starts with one idea."
                  : "Your next assessment is on its way."
            }
          >
            {search
              ? "Try a different search."
              : admin
                ? "Create your first test and bring your questions to life."
                : "Published tests will appear here when they’re ready."}
          </Empty>
        </div>
      ) : admin ? (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Questions</th>
                <th>Duration</th>
                <th>Attempts</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="table-title" to={`/tests/${t.id}/edit`}>
                      {t.title}
                    </Link>
                    <small>
                      {t.description.slice(0, 80) || "No instructions yet"}
                    </small>
                  </td>
                  <td>{t.questionCount}</td>
                  <td>{t.duration} min</td>
                  <td>
                    <Link
                      className="text-link"
                      to={`/submissions?testId=${t.id}`}
                    >
                      {t.attemptCount}
                    </Link>
                  </td>
                  <td>
                    <Badge tone={t.published ? "green" : "neutral"}>
                      {t.published ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link
                        className="icon-button"
                        to={`/tests/${t.id}/edit`}
                        aria-label={`Edit ${t.title}`}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                      <button
                        className="icon-button danger-text"
                        aria-label={`Delete ${t.title}`}
                        onClick={() => {
                          setActionError("");
                          setDeleting(t);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tests-grid">
          {tests.map((t) => (
            <TestCard test={t} key={t.id} />
          ))}
        </div>
      )}
      {deleting && (
        <Modal
          title="Delete this assessment?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
          actions={
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Keep assessment
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "Deleting…" : "Delete assessment"}
              </button>
            </>
          }
        >
          <p>
            <strong>{deleting.title}</strong> will be removed from the library.
            Existing attempts and their results will remain available in
            history.
          </p>
          <ErrorBox error={actionError} />
        </Modal>
      )}
    </>
  );
}
