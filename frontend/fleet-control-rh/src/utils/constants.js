export const TODAS_PERMISSOES = [
  'Dashboard.Visualizar',
  'Veiculos.Visualizar',
  'Motoristas.Visualizar',
  'Abastecimentos.Visualizar',
  'Abastecimentos.Criar',
  'Abastecimentos.Editar',
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
