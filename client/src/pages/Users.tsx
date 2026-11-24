import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpRight, UserRound, ShieldCheck } from "lucide-react";
import { api, json, message } from "../api";
import {
  Badge,
  date,
  Empty,
  ErrorBox,
  Heading,
  Loading,
  Modal,
  useLoad,
} from "../components/ui";
import type { User } from "../types";
export default function Users() {
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useLoad<User[]>("/admin/users");
  const [selected, setSelected] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const users = (data ?? []).filter((u) =>
    (u.name + " " + u.email).toLowerCase().includes(search.toLowerCase()),
  );
  async function toggle() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(
        `/admin/users/${selected.id}`,
        json("PATCH", { disabled: !selected.disabled }),
      );
      setSelected(null);
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
        eyebrow="THE PEOPLE BEHIND THE PROGRESS"
        title="Your learning community."
        description="Manage access and follow each learner’s assessment journey."
      />
      <div className="toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search users"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="results-count">{users.length} people</span>
      </div>
      <ErrorBox error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <section className="panel">
          {users.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Joined</th>
                    <th>Attempts</th>
                    <th>Account</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="person-cell">
                          <span className="avatar light">
                            {u.name
                              .split(" ")
                              .map((v) => v[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div>
                            <strong>
                              {u.name}{" "}
                              {u.role === "ADMIN" && <ShieldCheck size={14} />}
                            </strong>
                            <small>{u.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{date(u.createdAt)}</td>
                      <td>{u.attemptCount}</td>
                      <td>
                        <Badge tone={u.disabled ? "neutral" : "green"}>
                          {u.disabled ? "Disabled" : "Active"}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link
                            className="text-link"
                            to={`/submissions?userId=${u.id}`}
                          >
                            History <ArrowUpRight size={15} />
                          </Link>
                          {u.role !== "ADMIN" && (
                            <button
                              className="text-button"
                              onClick={() => {
                                setActionError("");
                                setSelected(u);
                              }}
                            >
                              {u.disabled ? "Reactivate" : "Disable"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={<UserRound />} title="No people found">
              Try another name or email.
            </Empty>
          )}
        </section>
      )}
      {selected && (
        <Modal
          title={
            selected.disabled ? "Welcome them back?" : "Disable this account?"
          }
          onClose={() => {
            if (!busy) setSelected(null);
          }}
          actions={
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <button
                className={`button ${selected.disabled ? "primary" : "danger"}`}
                disabled={busy}
                onClick={() => void toggle()}
              >
                {busy
                  ? "Saving…"
                  : selected.disabled
                    ? "Reactivate account"
                    : "Disable account"}
              </button>
            </>
          }
        >
          <p>
            {selected.disabled
              ? `${selected.name} will be able to sign in and take assessments again.`
              : `${selected.name} will lose access immediately. Their past assessments and results will be preserved.`}
          </p>
          <ErrorBox error={actionError} />
        </Modal>
      )}
    </>
  );
}
