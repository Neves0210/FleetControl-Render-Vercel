import {
  BarChart3,
  Fuel,
  Gauge,
  LayoutDashboard,
  LogOut,
  Route,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  Wrench
} from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { podeVerTela } from '../../utils/permissions';
import { NavItem } from './NavItem';

export function Layout({ children }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Truck size={22} />
          <span>FleetControlRH</span>
        </div>

        <nav className="sidebar-nav" aria-label="Navegacao principal">
          {podeVerTela('Dashboard.Visualizar') && <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />}
          {podeVerTela('Veiculos.Visualizar') && <NavItem to="/veiculos" icon={<Truck size={18} />} label="Veiculos" />}
          {podeVerTela('Motoristas.Visualizar') && <NavItem to="/motoristas" icon={<Users size={18} />} label="Motoristas" />}
          {podeVerTela('Abastecimentos.Visualizar') && <NavItem to="/abastecimentos" icon={<Fuel size={18} />} label="Abastecimentos" />}
          {podeVerTela('UsosVeiculos.Visualizar') && <NavItem to="/uso-veiculos" icon={<Route size={18} />} label="Uso de Veiculos" />}
          {podeVerTela('Manutencoes.Visualizar') && <NavItem to="/manutencoes" icon={<Wrench size={18} />} label="Manutencoes" />}
          {podeVerTela('Relatorios.Visualizar') && <NavItem to="/relatorios" icon={<BarChart3 size={18} />} label="Relatorios" />}
          {podeVerTela('Auditoria.Visualizar') && <NavItem to="/auditoria" icon={<ShieldCheck size={18} />} label="Auditoria" />}
          {podeVerTela('Usuarios.Visualizar') && <NavItem to="/usuarios" icon={<UserCog size={18} />} label="Usuarios" />}
        </nav>

        <div className="sidebar-status">
          <Gauge size={15} />
          <span>Industrial Cockpit</span>
        </div>

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
