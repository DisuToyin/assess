import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Users,
  Files,
  ClipboardCheck,
  Clock3,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Heading, Loading, useLoad } from "../components/ui";
import AttemptsTable from "../components/AttemptsTable";
import type { Dashboard as DashboardData, Test, Attempt } from "../types";
import { TestCard } from "./Tests";
export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? <AdminDashboard /> : <TakerDashboard />;
}
function AdminDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } =
    useLoad<DashboardData>("/admin/dashboard");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} retry={reload} />;
  const stats = [
    {
      label: "Registered users",
      value: data.users,
      icon: Users,
      note: "Your learning community",
      color: "green",
    },
    {
      label: "Tests created",
      value: data.tests,
      icon: Files,
      note: "Ideas turned into assessments",
      color: "blue",
    },
    {
      label: "Total attempts",
      value: data.attempts,
      icon: ClipboardCheck,
      note: "Every attempt is a step forward",
      color: "violet",
    },
    {
      label: "Need grading",
      value: data.pending,
      icon: Clock3,
      note: "A little feedback goes a long way",
      color: "orange",
    },
  ];
  return (
    <>
      <Heading
        eyebrow="YOUR WORKSPACE, AT A GLANCE"
        title={`Good to see you, ${user?.name.split(" ")[0]}.`}
        description="Here’s what’s happening across your assessments."
        action={
          <Link className="button primary" to="/tests/new">
            <Plus size={17} />
            Create a test
          </Link>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="banner-tag">
            <Sparkles size={14} /> BUILT FOR BETTER LEARNING
          </span>
          <h2>
            Small assessments.
            <br />
            Big possibilities.
          </h2>
          <p>
            Give knowledge a place to grow. Your next great test starts here.
          </p>
          <Link to="/tests/new">
            Create your next assessment <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-card art-card-back" />
          <div className="art-card">
            <div className="art-check">✓</div>
            <span />
            <span />
            <span />
            <div className="art-progress">
              <i />
            </div>
          </div>
          <span className="art-star">✳</span>
        </div>
      </section>
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, note, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <div className={`stat-icon ${color}`}>
                <Icon size={19} />
              </div>
            </div>
            <strong>{value.toLocaleString()}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent submissions</h2>
            <p>The latest work from your learners.</p>
          </div>
          <Link className="text-link" to="/submissions">
            View all submissions <ArrowUpRight size={16} />
          </Link>
        </div>
        <AttemptsTable attempts={data.recent} admin />
      </section>
      <div className="quick-grid">
        <Link className="quick-card" to="/tests">
          <span className="quick-icon">
            <Files size={21} />
          </span>
          <div>
            <h3>Your test library</h3>
            <p>A home for every assessment you create.</p>
          </div>
          <ArrowUpRight size={20} />
        </Link>
        <Link className="quick-card" to="/users">
          <span className="quick-icon">
            <Users size={21} />
          </span>
          <div>
            <h3>Meet your learners</h3>
            <p>See the people behind the progress.</p>
          </div>
          <ArrowUpRight size={20} />
        </Link>
      </div>
    </>
  );
}
function TakerDashboard() {
  const { user } = useAuth();
  const tests = useLoad<Test[]>("/tests");
  const attempts = useLoad<Attempt[]>("/attempts");
  if (tests.loading || attempts.loading) return <Loading />;
  if (tests.error || attempts.error)
    return (
      <ErrorBox
        error={tests.error || attempts.error}
        retry={() => {
          tests.reload();
          attempts.reload();
        }}
      />
    );
  const all = attempts.data ?? [];
  const progress = all.filter((a) => a.status === "IN_PROGRESS");
  const released = all.filter((a) => a.grade?.released);
  const completed = all.filter((a) => a.status === "SUBMITTED");
  return (
    <>
      <Heading
        eyebrow="MAKE YOUR NEXT STEP COUNT"
        title={`Welcome back, ${user?.name.split(" ")[0]}.`}
        description="A focused space for your learning journey."
      />
      <div className="taker-welcome">
        <BookOpen size={32} />
        <div>
          <h2>A little focus. A lot of possibility.</h2>
          <p>
            Find an assessment, take your time to prepare, and show what you
            know.
          </p>
        </div>
      </div>
      <div className="stats-grid three">
        <div className="stat-card">
          <span>Completed assessments</span>
          <strong>{completed.length}</strong>
          <small>Building knowledge, one test at a time</small>
        </div>
        <div className="stat-card">
          <span>Currently in progress</span>
          <strong>{progress.length}</strong>
          <small>Pick up right where you left off</small>
        </div>
        <div className="stat-card">
          <span>Results available</span>
          <strong>{released.length}</strong>
          <small>Your feedback is ready to explore</small>
        </div>
      </div>
      {progress.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Keep the momentum</h2>
              <p>Your timer continues while you’re away.</p>
            </div>
          </div>
          <div className="resume-list">
            {progress.map((a) => (
              <div key={a.id}>
                <div>
                  <h3>{a.title}</h3>
                  <p>Deadline: {new Date(a.deadline).toLocaleString()}</p>
                </div>
                <Link className="button primary" to={`/attempts/${a.id}`}>
                  Continue test <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
      <section>
        <div className="section-heading">
          <h2>Available assessments</h2>
          <Link className="text-link" to="/tests">
            Explore all <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="tests-grid">
          {(tests.data ?? []).slice(0, 3).map((t) => (
            <TestCard test={t} key={t.id} />
          ))}
        </div>
        {!tests.data?.length && (
          <div className="panel">
            <Empty title="Something good is on its way">
              When an assessment is published, you’ll find it here.
            </Empty>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Your recent activity</h2>
            <p>Every step of your assessment journey.</p>
          </div>
          <Link className="text-link" to="/history">
            Full history <ArrowUpRight size={16} />
          </Link>
        </div>
        <AttemptsTable attempts={all.slice(0, 5)} />
      </section>
    </>
  );
}
