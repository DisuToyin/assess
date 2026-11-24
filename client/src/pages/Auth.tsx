import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck, BookOpen } from "lucide-react";
import { useAuth } from "../auth";
import { api, json, message } from "../api";
import { Brand } from "../components/Layout";
import { ErrorBox, Field } from "../components/ui";
import type { User } from "../types";
export default function AuthPage({ register = false }: { register?: boolean }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  if (user) return <Navigate to="/" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      setUser(
        await api<User>(
          `/auth/${register ? "register" : "login"}`,
          json("POST", {
            name: f.get("name"),
            email: f.get("email"),
            password: f.get("password"),
            adminSecret: f.get("adminSecret") ?? undefined,
          }),
        ),
      );
      navigate("/");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <div className="auth-kicker">
            <span />A BETTER WAY TO ASSESS
          </div>
          <h1>
            Great learning.
            <br />
            Meaningful
            <br />
            <em>progress.</em>
          </h1>
          <p>
            A little clarity can take you a long way. Create, take, and review
            assessments in one thoughtful workspace.
          </p>
          <div className="auth-features">
            <span>
              <Check size={16} />
              Simple to create
            </span>
            <span>
              <Check size={16} />
              Focused to take
            </span>
            <span>
              <Check size={16} />
              Easy to review
            </span>
          </div>
          <div className="auth-illustration" aria-hidden="true">
            <div className="illustration-top">
              <BookOpen size={22} />
              <span>Room to grow</span>
              <span className="illustration-dots">•••</span>
            </div>
            <div className="illustration-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="illustration-bottom">
              <span>Every step counts.</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
        <p className="auth-copyright">Designed for the work of learning.</p>
      </section>
      <section className="auth-form-area">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <div className="eyebrow">YOUR ASSESSMENT WORKSPACE</div>
          <h2>{register ? "A fresh start." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create an account and take your next step."
              : "Sign in to pick up where you left off."}
          </p>
          <ErrorBox error={error} />
          <form onSubmit={submit}>
            {register && (
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="Your full name"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field
              label="Password"
              hint={register ? "Use at least 10 characters." : ""}
            >
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={10}
                required
                placeholder="Enter your password"
              />
            </Field>
            {register && email.trim().toLowerCase() === "disujt@gmail.com" && (
              <Field
                label="Administrator registration key"
                hint="Use the key configured by your server administrator."
              >
                <input
                  name="adminSecret"
                  type="password"
                  autoComplete="off"
                  required
                />
              </Field>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Sign in to your workspace"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to Assess?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="auth-security">
            <ShieldCheck size={16} />
            Your work, securely in one place.
          </div>
        </div>
      </section>
    </div>
  );
}
