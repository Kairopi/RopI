import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWeek } from '@/hooks/useWeek';
import { Loader2 } from '@/components/icons';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { ownerId, setupDone, claim } = useWeek();

  // The stored week belongs to one account; a new account starts empty
  useEffect(() => {
    if (user && ownerId !== user.id) claim(user.id);
  }, [user, ownerId, claim]);

  if (loading || (user && ownerId !== user.id)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // First run: set up your week before anything else
  if (!setupDone && location.pathname !== '/setup') return <Navigate to="/setup" replace />;

  return <>{children}</>;
}
