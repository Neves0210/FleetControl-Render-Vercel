import { Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { temPermissao } from '../utils/permissions';

export function PermissionRoute({ permissao, children }) {
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" />;
  }

  if (!temPermissao(permissao)) {
    return (
      <Layout>
        <div className="alert alert-danger">Você não tem permissão para acessar esta tela.</div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
