import { Navigate } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';

export default function PermissionRoute({ permission, children }) {
  const { can } = usePermission();
  return can(permission) ? children : <Navigate to="/unauthorized" replace />;
}