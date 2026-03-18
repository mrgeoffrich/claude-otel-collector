import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { SessionsPage } from "./pages/sessions";
import { SessionDetailPage } from "./pages/session-detail";
import { DashboardPage } from "./pages/dashboard";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <nav className="w-56 border-r border-border bg-card p-4 flex flex-col gap-1">
          <h1 className="text-lg font-bold mb-4 px-4">OTEL Collector</h1>
          <NavItem to="/sessions">Sessions</NavItem>
          <NavItem to="/dashboard">Dashboard</NavItem>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/sessions" replace />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
