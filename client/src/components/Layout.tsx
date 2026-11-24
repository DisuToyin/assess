import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Files,
  Users,
  ClipboardCheck,
  History,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  PanelTop,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../auth";
import { message } from "../api";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        a<span>·</span>
      </span>
      assess<span className="brand-period">.</span>
    </span>
  );
}
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const admin = user?.role === "ADMIN";
  const links = admin
    ? [
        { to: "/", label: "Overview", icon: LayoutDashboard },
        { to: "/tests", label: "Tests", icon: Files },
        { to: "/submissions", label: "Submissions", icon: ClipboardCheck },
        { to: "/users", label: "People", icon: Users },
      ]
    : [
        { to: "/", label: "My workspace", icon: LayoutDashboard },
        { to: "/tests", label: "Available tests", icon: BookOpen },
        { to: "/history", label: "My history", icon: History },
      ];
  return (
    <div className={`app-shell ${admin ? "" : "taker-shell"}`}>
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-symbol">
            <PanelTop size={16} />
          </span>
          <div>
            Assessment workspace
            <small>{admin ? "Administrator" : "Personal workspace"}</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-label">A LITTLE FOCUS GOES A LONG WAY</span>
            <p>
              {admin
                ? "Make room for better learning."
                : "Your next chapter starts here."}
            </p>
            <span>
              One assessment at a time. <ArrowUpRight size={15} />
            </span>
          </div>
          <button
            className="profile"
            onClick={() => {
              void logout()
                .then(() => navigate("/login"))
                .catch((e) => setError(message(e)));
            }}
            title="Sign out"
          >
            <span className="avatar">
              {user?.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{user?.name}</strong>
              <small>{admin ? "Administrator" : "Test taker"}</small>
            </span>
            <LogOut size={17} />
          </button>
          {error && <p className="sidebar-error">{error}</p>}
        </div>
      </aside>
      {open && <div className="nav-overlay" onClick={() => setOpen(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{admin ? "Administration" : "Learning & growth"}</strong>
            </span>
          </div>
          <span className="topbar-date">
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="workspace-live">
            <i />
            All systems ready
          </span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Thoughtfully built for better assessments.</span>
          <span>
            Assess workspace <span>·</span> {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </div>
  );
}
