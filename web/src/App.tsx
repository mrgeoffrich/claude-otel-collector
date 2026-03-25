import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { SessionsPage } from "./pages/sessions";
import { SessionDetailPage } from "./pages/session-detail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        {/* Top nav */}
        <nav className="sticky top-0 z-10 border-b border-border bg-card px-6 py-3 flex items-center gap-6">
          <h1 className="text-lg font-bold">Agent Collector</h1>
          <NavLink
            to="/sessions"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            Sessions
          </NavLink>
        </nav>

        {/* Main content */}
        <main className="mx-auto max-w-6xl px-6 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/sessions" replace />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
