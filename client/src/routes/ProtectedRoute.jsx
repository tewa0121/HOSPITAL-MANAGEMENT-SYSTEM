import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // a temporary password must be replaced before anything else opens
  if (user.must_change_password && location.pathname !== '/account') return <Navigate to="/account" replace />;
  return <Outlet />;
}