import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard for protected pages (PRD §9, §14 "SessionGuard").
 *
 * If there is no in-memory session, the user is redirected to `/login`,
 * preserving the route they tried to reach so we can send them back after
 * they authenticate.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
