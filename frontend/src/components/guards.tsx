import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Spinner } from "./ui";
import type { ReactNode } from "react";

export function RequireParent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner label="Loading…" />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading…" />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <Navigate to="/students" replace />;
  return <>{children}</>;
}
