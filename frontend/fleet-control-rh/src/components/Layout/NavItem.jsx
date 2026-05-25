import { NavLink } from 'react-router-dom';

export function NavItem({ to, icon, label }) {
  return (
    <NavLink to={to} end>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
