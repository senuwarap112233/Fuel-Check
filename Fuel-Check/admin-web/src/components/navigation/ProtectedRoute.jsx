import { Navigate, useLocation } from 'react-router-dom';
import { getAdminSession } from '../../utils/session';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const session = getAdminSession();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
