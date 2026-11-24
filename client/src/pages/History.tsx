import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Search, ClipboardCheck } from "lucide-react";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Heading, Loading, useLoad } from "../components/ui";
import AttemptsTable from "../components/AttemptsTable";
import type { Attempt, Test } from "../types";
export default function History() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const query = admin ? `?${params.toString()}` : "";
  const { data, error, loading, reload } = useLoad<Attempt[]>(
    `/attempts${query}`,
  );
  const tests = useLoad<Test[]>("/tests");
  const attempts = (data ?? []).filter(
    (a) =>
      (a.title + " " + (a.user?.name ?? "") + " " + (a.user?.email ?? ""))
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "all" ||
        (status === "active"
          ? a.status === "IN_PROGRESS"
          : status === "released"
            ? a.grade?.released
            : a.status === "SUBMITTED" && !a.grade?.released)),
  );
  return (
    <>
      <Heading
        eyebrow={
          admin
            ? "BEHIND EVERY ANSWER, A LEARNER"
            : "YOUR JOURNEY, ALL IN ONE PLACE"
        }
        title={
          admin ? "Time for a little feedback." : "Look how far you’ve come."
        }
        description={
          admin
            ? "Review submissions, add feedback, and release results when you’re ready."
            : "Revisit your assessments, results, and feedback."
        }
      />
      <div className="toolbar wrap">
        <div className="search-input">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              admin ? "Search tests or learners…" : "Search your assessments…"
            }
            aria-label="Search attempts"
          />
        </div>
        {admin && (
          <select
            aria-label="Filter by test"
            value={params.get("testId") ?? ""}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("testId", e.target.value);
              else next.delete("testId");
              setParams(next);
            }}
          >
            <option value="">All assessments</option>
            {tests.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">In progress</option>
          <option value="pending">Awaiting release</option>
          <option value="released">Results released</option>
        </select>
        {params.get("userId") && (
          <button
            className="text-link"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("userId");
              setParams(next);
            }}
          >
            Clear learner filter
          </button>
        )}
      </div>
      <ErrorBox error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <section className="panel">
          {attempts.length ? (
            <AttemptsTable attempts={attempts} admin={admin} />
          ) : (
            <Empty
              icon={<ClipboardCheck size={26} />}
              title="No submissions here yet."
            >
              {search || status !== "all"
                ? "Try adjusting your search or filters."
                : admin
                  ? "As learners complete assessments, their work will arrive here."
                  : "Your attempts will appear here as soon as you begin an assessment."}
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
