import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Veiculos } from '../pages/Veiculos';
import { Motoristas } from '../pages/Motoristas';
import { Abastecimentos } from '../pages/Abastecimentos';
import { Usuarios } from '../pages/Usuarios';
import { Relatorios } from '../pages/Relatorios';
import { Manutencoes } from '../pages/Manutencoes';
import { UsosVeiculos } from '../pages/UsosVeiculos';
import { PermissionRoute } from './PermissionRoute';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<PermissionRoute permissao="Dashboard.Visualizar"><Dashboard /></PermissionRoute>} />
        <Route path="/veiculos" element={<PermissionRoute permissao="Veiculos.Visualizar"><Veiculos /></PermissionRoute>} />
        <Route path="/motoristas" element={<PermissionRoute permissao="Motoristas.Visualizar"><Motoristas /></PermissionRoute>} />
        <Route path="/abastecimentos" element={<PermissionRoute permissao="Abastecimentos.Visualizar"><Abastecimentos /></PermissionRoute>} />
        <Route path="/uso-veiculos" element={<PermissionRoute permissao="UsosVeiculos.Visualizar"><UsosVeiculos /></PermissionRoute>} />
        <Route path="/manutencoes" element={<PermissionRoute permissao="Manutencoes.Visualizar"><Manutencoes /></PermissionRoute>} />
        <Route path="/usuarios" element={<PermissionRoute permissao="Usuarios.Visualizar"><Usuarios /></PermissionRoute>} />
        <Route path="/relatorios" element={<PermissionRoute permissao="Relatorios.Visualizar"><Relatorios /></PermissionRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
