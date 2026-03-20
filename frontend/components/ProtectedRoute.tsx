/* eslint-disable react/no-unescaped-entities */

import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Guards all dashboard routes.
 * - Shows a spinner while Firebase auth is resolving.
 * - Redirects unauthenticated users to /login.
 * - Redirects authenticated-but-unverified users to /verify-email.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isVerified, isAuthLoading } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }
    if (!isVerified) {
      navigate('/verify-email', { replace: true, state: { from: location.pathname } });
    }
  }, [isAuthLoading, isAuthenticated, isVerified, navigate, location.pathname]);

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
            <span className="text-xl font-bold text-primary">N</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isVerified) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
            <span className="text-xl font-bold text-primary">N</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
