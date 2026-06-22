import {
  BarChart3,
  Fuel,
  LayoutDashboard,
  LogOut,
  Route,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  Wrench
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getUser, podeVerTela } from '../../utils/permissions';
import { dashboardViewsPermitidas, lerDashboardView, salvarDashboardView } from '../../utils/dashboardViews';
import { NavItem } from './NavItem';

export function Layout({ children }) {
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);
  const dashboardViews = useMemo(() => dashboardViewsPermitidas(user), [user]);
  const [dashboardView, setDashboardView] = useState(() => lerDashboardView(user));

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  function alterarDashboardView(value) {
    setDashboardView(salvarDashboardView(user, value));
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Truck size={22} />
          <span>FleetControlRH</span>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {podeVerTela('Dashboard.Visualizar') && <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />}
          {podeVerTela('Veiculos.Visualizar') && <NavItem to="/veiculos" icon={<Truck size={18} />} label="Veículos" />}
          {podeVerTela('Motoristas.Visualizar') && <NavItem to="/motoristas" icon={<Users size={18} />} label="Motoristas" />}
          {podeVerTela('Abastecimentos.Visualizar') && <NavItem to="/abastecimentos" icon={<Fuel size={18} />} label="Abastecimentos" />}
          {podeVerTela('UsosVeiculos.Visualizar') && <NavItem to="/uso-veiculos" icon={<Route size={18} />} label="Uso de Veículos" />}
          {podeVerTela('Manutencoes.Visualizar') && <NavItem to="/manutencoes" icon={<Wrench size={18} />} label="Manutenções" />}
          {podeVerTela('Relatorios.Visualizar') && <NavItem to="/relatorios" icon={<BarChart3 size={18} />} label="Relatórios" />}
          {podeVerTela('Auditoria.Visualizar') && <NavItem to="/auditoria" icon={<ShieldCheck size={18} />} label="Auditoria" />}
          {podeVerTela('Usuarios.Visualizar') && <NavItem to="/usuarios" icon={<UserCog size={18} />} label="Usuários" />}
        </nav>

        {podeVerTela('Dashboard.Visualizar') && (
          <label className="sidebar-dashboard-select">
            <span>Dashboard</span>
            <select value={dashboardView} onChange={e => alterarDashboardView(e.target.value)}>
              {dashboardViews.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        )}

        <button className="sidebar-logout" onClick={logout}>
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </aside>

      <section className="content">{children}</section>

      <ToastContainer position="top-right" autoClose={2500} />
    </div>
  );
}
