export const DASHBOARD_VIEW_STORAGE_KEY = 'fleet-dashboard-view';
export const DASHBOARD_VIEW_CHANGE_EVENT = 'fleet-dashboard-view-change';

export const DASHBOARD_VIEWS = [
  { id: 'general', label: 'Geral', shortLabel: 'Geral' },
  { id: 'finance', label: 'Financeiro', shortLabel: 'Financeiro' },
  { id: 'operational', label: 'Operacional', shortLabel: 'Operacional' },
  { id: 'hr', label: 'RH', shortLabel: 'RH' },
  { id: 'user', label: 'Geral do usuario', shortLabel: 'Usuario' }
];

export function perfilNumero(user) {
  const perfil = String(user?.perfil || '').toLowerCase();
  if (perfil === 'master') return 1;
  if (perfil === 'rh') return 2;
  if (perfil === 'tecnico') return 3;
  if (perfil === 'almoxarifado') return 4;
  return Number(user?.perfil) || 0;
}

export function dashboardViewsPermitidas(user) {
  const perfil = perfilNumero(user);

  if (perfil === 1 || perfil === 2) return DASHBOARD_VIEWS;
  if (perfil === 4) return DASHBOARD_VIEWS.filter(item => ['operational', 'user'].includes(item.id));
  return DASHBOARD_VIEWS.filter(item => item.id === 'user');
}

export function normalizarDashboardView(user, viewId) {
  const permitidas = dashboardViewsPermitidas(user);
  return permitidas.some(item => item.id === viewId) ? viewId : permitidas[0]?.id || 'user';
}

export function lerDashboardView(user) {
  return normalizarDashboardView(user, localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY));
}

export function salvarDashboardView(user, viewId) {
  const normalizada = normalizarDashboardView(user, viewId);
  localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, normalizada);
  window.dispatchEvent(new CustomEvent(DASHBOARD_VIEW_CHANGE_EVENT, { detail: normalizada }));
  return normalizada;
}

export function dashboardViewPorId(viewId) {
  return DASHBOARD_VIEWS.find(item => item.id === viewId) || DASHBOARD_VIEWS[0];
}
