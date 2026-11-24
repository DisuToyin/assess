import { useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { ErrorBox, Loading, useLoad } from "../components/ui";
import type { Attempt } from "../types";
import Exam from "./Exam";
import Results from "./Results";
export default function AttemptPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad<Attempt>(`/attempts/${id}`);
  if (loading)
    return (
      <div className="standalone">
        <Loading />
      </div>
    );
  if (error || !data)
    return (
      <div className="standalone">
        <ErrorBox error={error} retry={reload} />
      </div>
    );
  return data.status === "IN_PROGRESS" && user?.role !== "ADMIN" ? (
    <Exam key={data.id} attempt={data} onSubmitted={reload} />
  ) : (
    <Results
      key={data.id}
      attempt={data}
      onSaved={reload}
      admin={user?.role === "ADMIN"}
    />
  );
}
