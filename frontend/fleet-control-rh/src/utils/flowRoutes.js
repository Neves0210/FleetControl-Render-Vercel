export function rotaInicialPorUsuario(user = {}) {
  const perfil = String(user?.perfil || '').toLowerCase();
  const permissoes = user?.permissoes || [];

  if (perfil === '3' || perfil === 'tecnico') {
    if (permissoes.includes('UsosVeiculos.Visualizar')) return '/uso-veiculos';
    if (permissoes.includes('Abastecimentos.Visualizar')) return '/abastecimentos';
  }

  if (perfil === '4' || perfil === 'almoxarifado') {
    if (permissoes.includes('Manutencoes.Visualizar')) return '/manutencoes';
    if (permissoes.includes('Abastecimentos.Visualizar')) return '/abastecimentos';
  }

  if (permissoes.includes('Dashboard.Visualizar') || perfil === '1' || perfil === 'master') return '/';
  if (permissoes.includes('Abastecimentos.Visualizar')) return '/abastecimentos';
  if (permissoes.includes('UsosVeiculos.Visualizar')) return '/uso-veiculos';
  if (permissoes.includes('Manutencoes.Visualizar')) return '/manutencoes';

  return '/';
}
