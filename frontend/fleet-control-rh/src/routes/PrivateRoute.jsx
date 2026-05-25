import { Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';

export function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? <Layout>{children}</Layout> : <Navigate to="/login" />;
}
