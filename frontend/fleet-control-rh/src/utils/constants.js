import { dataHoraInputBrasil } from './dataBrasil';

export const TODAS_PERMISSOES = [
  'Dashboard.Visualizar',
  'Dashboard.Personalizar',
  'Veiculos.Visualizar',
  'Motoristas.Visualizar',
  'Abastecimentos.Visualizar',
  'Abastecimentos.Criar',
  'Abastecimentos.Editar',
  'Abastecimentos.Liberar',
  'UsosVeiculos.Visualizar',
  'UsosVeiculos.Criar',
  'UsosVeiculos.Editar',
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
    dataAbastecimento: dataHoraInputBrasil(),
    kmAtual: '',
    litros: '',
    valorTotal: '',
    posto: '',
    observacao: ''
  };
}
