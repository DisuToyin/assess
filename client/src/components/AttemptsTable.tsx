import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { date, Empty, Score, Status } from "./ui";
import type { Attempt } from "../types";
export default function AttemptsTable({
  attempts,
  admin = false,
}: {
  attempts: Attempt[];
  admin?: boolean;
}) {
  if (!attempts.length)
    return (
      <Empty title="A clean slate">
        Completed assessments will appear here, ready to review.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{admin ? "Test & participant" : "Assessment"}</th>
            <th>Date taken</th>
            <th>Score</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Open attempt</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <td>
                <Link className="table-title" to={`/attempts/${a.id}`}>
                  {a.title}
                </Link>
                <small>
                  {admin ? a.user?.name : `Attempt ${a.number}`}{" "}
                  {admin && <span>· {a.user?.email}</span>}
                </small>
              </td>
              <td>{date(a.startedAt)}</td>
              <td>
                <Score score={a.grade?.score} total={a.grade?.total} />
              </td>
              <td>
                <Status
                  status={
                    a.status === "IN_PROGRESS"
                      ? a.status
                      : (a.grade?.status ?? "PENDING")
                  }
                  released={a.grade?.released}
                />
              </td>
              <td>
                <Link
                  className="table-action"
                  to={`/attempts/${a.id}`}
                  aria-label={`Open ${a.title}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
