import { toNumber } from './formatters';

function dataDiasAtras(value) {
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return null;
  return Math.floor((Date.now() - data.getTime()) / 86400000);
}

export function calcularAlertasOperacionais({ abastecimentos = [], usos = [], manutencoes = [], veiculos = [] }) {
  const alertas = [];

  manutencoes
    .filter(x => x.status === 'Vencida')
    .forEach(x => alertas.push({
      tipo: 'danger',
      titulo: 'Manutencao vencida',
      detalhe: `${x.veiculo || ''}${x.placa ? ` - ${x.placa}` : ''} | ${x.tipo || ''}`
    }));

  manutencoes
    .filter(x => x.status === 'PrÃ³xima' || x.status === 'Proxima')
    .forEach(x => alertas.push({
      tipo: 'warn',
      titulo: 'Manutencao proxima',
      detalhe: `${x.veiculo || ''}${x.placa ? ` - ${x.placa}` : ''} | ${x.tipo || ''}`
    }));

  usos
    .filter(x => x.status === 1 || x.status === 'EmUso')
    .forEach(x => alertas.push({
      tipo: 'warn',
      titulo: 'Veiculo em uso agora',
      detalhe: `${x.veiculo?.modelo || ''} - ${x.veiculo?.placa || ''} | ${x.motorista?.nome || ''}`
    }));

  const porVeiculo = new Map();
  abastecimentos.forEach(x => {
    const lista = porVeiculo.get(x.veiculoId) || [];
    lista.push(x);
    porVeiculo.set(x.veiculoId, lista);
  });

  porVeiculo.forEach(lista => {
    const ordenados = [...lista].sort((a, b) => new Date(b.dataAbastecimento) - new Date(a.dataAbastecimento));
    const ultimo = ordenados[0];
    const dias = dataDiasAtras(ultimo?.dataAbastecimento);

    if (dias !== null && dias >= 30) {
      alertas.push({
        tipo: 'info',
        titulo: 'Veiculo sem abastecimento recente',
        detalhe: `${ultimo.veiculo?.modelo || ''} - ${ultimo.veiculo?.placa || ''} | ${dias} dias`
      });
    }

    const valores = ordenados.map(x => toNumber(x.valorTotal)).filter(v => v > 0);
    const media = valores.reduce((s, v) => s + v, 0) / (valores.length || 1);
    if (ultimo && valores.length >= 3 && toNumber(ultimo.valorTotal) > media * 1.5) {
      alertas.push({
        tipo: 'warn',
        titulo: 'Abastecimento acima da media',
        detalhe: `${ultimo.veiculo?.placa || ''} | ultimo valor ${(toNumber(ultimo.valorTotal)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      });
    }
  });

  veiculos
    .filter(x => !porVeiculo.has(x.id))
    .forEach(x => alertas.push({
      tipo: 'info',
      titulo: 'Veiculo sem abastecimentos',
      detalhe: `${x.modelo || ''} - ${x.placa || ''}`
    }));

  return alertas.slice(0, 8);
}
