import { Component, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import AuthPage from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Tests from "./pages/Tests";
import Editor from "./pages/Editor";
import History from "./pages/History";
import Users from "./pages/Users";
import AttemptPage from "./pages/Attempt";
function Protected({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <Outlet />;
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="standalone">
        <h1>This page needs a refresh.</h1>
        <p>Your saved work is safe. Reload to try again.</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <Boundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage register />} />
            <Route element={<Protected />}>
              <Route path="/attempts/:id" element={<AttemptPage />} />
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="tests" element={<Tests />} />
                <Route path="history" element={<History />} />
                <Route element={<Protected admin />}>
                  <Route path="tests/new" element={<Editor />} />
                  <Route path="tests/:id/edit" element={<Editor />} />
                  <Route path="submissions" element={<History />} />
                  <Route path="users" element={<Users />} />
                </Route>
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>Page not found</h1>
                      <p>This page may have moved.</p>
                      <a className="button primary" href="/">
                        Back to workspace
                      </a>
                    </div>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </Boundary>
  );
}
