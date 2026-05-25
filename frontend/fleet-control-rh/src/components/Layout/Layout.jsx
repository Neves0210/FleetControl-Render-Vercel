import { BarChart3, Car, Fuel, LayoutDashboard, LogOut, Users, UserCog } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getUser, podeVerTela } from '../../utils/permissions';
import { NavItem } from './NavItem';

export function Layout({ children }) {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">FleetControlRH</div>

        {podeVerTela('Dashboard.Visualizar') && <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />}
        {podeVerTela('Veiculos.Visualizar') && <NavItem to="/veiculos" icon={<Car size={18} />} label="Veículos" />}
        {podeVerTela('Motoristas.Visualizar') && <NavItem to="/motoristas" icon={<Users size={18} />} label="Motoristas" />}
        {podeVerTela('Abastecimentos.Visualizar') && <NavItem to="/abastecimentos" icon={<Fuel size={18} />} label="Abastecimentos" />}
        {podeVerTela('Relatorios.Visualizar') && <NavItem to="/relatorios" icon={<BarChart3 size={18} />} label="Relatórios" />}
        {podeVerTela('Usuarios.Visualizar') && <NavItem to="/usuarios" icon={<UserCog size={18} />} label="Usuários" />}
      </aside>

      <section className="content">
        <div className="topbar">
          <div>
            <strong>{user?.nome}</strong>
            <div className="text-muted small">{user?.email}</div>
          </div>

          <button className="btn btn-outline-danger btn-sm" onClick={logout}>
            <LogOut size={16} /> Sair
          </button>
        </div>

        {children}
      </section>

      <ToastContainer position="top-right" autoClose={2500} />
    </div>
  );
}
