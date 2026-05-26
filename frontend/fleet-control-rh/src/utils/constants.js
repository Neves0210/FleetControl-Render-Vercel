export const TODAS_PERMISSOES = [
  'Dashboard.Visualizar',
  'Veiculos.Visualizar',
  'Motoristas.Visualizar',
  'Abastecimentos.Visualizar',
  'Abastecimentos.Criar',
  'Abastecimentos.Editar',
  'UsosVeiculos.Visualizar',
  'UsosVeiculos.Criar',
  'UsosVeiculos.Finalizar',
  'Manutencoes.Visualizar',
  'Manutencoes.Gerenciar',
  'Relatorios.Visualizar',
  'Relatorios.Exportar',
  'Usuarios.Visualizar',
  'Usuarios.Gerenciar'
];

export function emptyAbastecimento() {
  return {
    veiculoId: '',
    motoristaId: '',
    dataAbastecimento: new Date().toISOString().slice(0, 16),
    kmAtual: '',
    litros: '',
    valorTotal: '',
    posto: '',
    observacao: ''
  };
}
