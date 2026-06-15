import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Filter, RotateCcw, Download } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Select } from '../components/Forms/Select';
import { Input } from '../components/Forms/Input';
import { relatorioService } from '../services/relatorioService';
import { veiculoService } from '../services/veiculoService';
import { motoristaService } from '../services/motoristaService';
import { combustivel, dataHora, litros, money, number } from '../utils/formatters';
import { dataBrasil, dataInputBrasil } from '../utils/dataBrasil';

const hoje = dataInputBrasil();

function formatDate(value) {
  return dataHora(value);
}

function formatDateOnly(value) {
  return dataBrasil(value);
}

function formatTempo(minutos) {
  const total = Math.round(Number(minutos || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;

  if (horas <= 0) return `${mins} min`;

  return `${horas}h ${mins}min`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '""';

  return `"${String(value).replace(/"/g, '""')}"`;
}

function baixarArquivo(nome, conteudo) {
  const blob = new Blob([conteudo], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = nome;
  a.click();

  URL.revokeObjectURL(url);
}

function criarCsv(secao, cabecalho, linhas) {
  const csv = [
    [secao],
    cabecalho,
    ...linhas
  ]
    .map(row => row.map(csvEscape).join(';'))
    .join('\n');

  return csv;
}

export function Relatorios() {
  const [dados, setDados] = useState(null);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [filtro, setFiltro] = useState({
    dataInicio: '',
    dataFim: hoje,
    veiculoId: '',
    motoristaId: ''
  });

  async function carregarCombos() {
    const [veiculosRes, motoristasRes] = await Promise.all([
      veiculoService.listar(),
      motoristaService.listar()
    ]);

    setVeiculos(veiculosRes.data);
    setMotoristas(motoristasRes.data);
  }

  async function carregarRelatorio(filtros = filtro) {
    const params = {
      dataInicio: filtros.dataInicio || undefined,
      dataFim: filtros.dataFim || undefined,
      veiculoId: filtros.veiculoId || undefined,
      motoristaId: filtros.motoristaId || undefined
    };

    const r = await relatorioService.abastecimentos(params);
    setDados(r.data);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      carregarCombos(),
      relatorioService.abastecimentos({ dataFim: hoje })
    ])
      .then(([, relatorioRes]) => {
        if (!cancelled) setDados(relatorioRes.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar relatórios.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function filtrar(e) {
    e.preventDefault();

    try {
      await carregarRelatorio();
    } catch {
      toast.error('Erro ao filtrar relatório.');
    }
  }

  async function limparFiltros() {
    const novoFiltro = {
      dataInicio: '',
      dataFim: '',
      veiculoId: '',
      motoristaId: ''
    };

    setFiltro(novoFiltro);

    try {
      await carregarRelatorio(novoFiltro);
    } catch {
      toast.error('Erro ao carregar relatório completo.');
    }
  }

  function exportarCsv() {
    if (!dados) {
      toast.warning('Nenhum dado carregado para exportar.');
      return;
    }

    const partes = [];

    partes.push(criarCsv(
      'RESUMO GERAL',
      ['Indicador', 'Valor'],
      [
        ['Abastecimentos', resumo.quantidade],
        ['Litros totais', resumo.totalLitros],
        ['Gasto total', resumo.totalValor],
        ['Média por abastecimento', resumo.mediaValor],
        ['Quantidade de usos', resumo.quantidadeUsos],
        ['Tempo total de uso em minutos', resumo.tempoTotalUsoMinutos],
        ['KM total rodado', resumo.kmTotalRodado],
        ['Manutenções feitas', resumo.quantidadeManutencoes],
        ['Manutenções próximas', resumo.manutencoesProximas],
        ['Manutenções vencidas', resumo.manutencoesVencidas],
        ['Custo total manutenções', resumo.custoTotalManutencoes]
      ]
    ));

    partes.push(criarCsv(
      'ABASTECIMENTOS DETALHADOS',
      ['Data', 'Veículo', 'Motorista', 'Tipo de combustível', 'KM', 'Litros', 'Valor', 'Posto'],
      (dados.abastecimentos?.itens || []).map(x => [
        formatDate(x.dataAbastecimento),
        `${x.veiculo?.modelo || ''} ${x.veiculo?.placa || ''}`,
        x.motorista?.nome || '',
        combustivel(x.veiculo?.tipoCombustivel) || '',
        x.kmAtual,
        x.litros,
        x.valorTotal,
        x.posto || ''
      ])
    ));

    partes.push(criarCsv(
      'USO POR VEÍCULO',
      ['Veículo', 'Quantidade de usos', 'Tempo total', 'KM rodado'],
      (dados.usos?.porVeiculo || []).map(x => [
        x.veiculo,
        x.quantidadeUsos,
        formatTempo(x.tempoTotalMinutos),
        x.kmRodado
      ])
    ));

    partes.push(criarCsv(
      'USO POR MOTORISTA',
      ['Motorista', 'Quantidade de usos', 'Tempo total', 'KM rodado'],
      (dados.usos?.porMotorista || []).map(x => [
        x.motorista,
        x.quantidadeUsos,
        formatTempo(x.tempoTotalMinutos),
        x.kmRodado
      ])
    ));

    partes.push(criarCsv(
      'USOS DETALHADOS',
      ['Veículo', 'Motorista', 'Início', 'Fim', 'Tempo', 'KM inicial', 'KM final', 'KM rodado', 'Status'],
      (dados.usos?.itens || []).map(x => [
        `${x.veiculo?.modelo || ''} ${x.veiculo?.placa || ''}`,
        x.motorista?.nome || '',
        formatDate(x.dataInicio),
        formatDate(x.dataFim),
        formatTempo(x.tempoUsoMinutos),
        x.kmInicial,
        x.kmFinal || '',
        x.kmFinal ? x.kmFinal - x.kmInicial : '',
        x.status === 1 || x.status === 'EmUso' ? 'Em uso' : 'Finalizado'
      ])
    ));

    partes.push(criarCsv(
      'MANUTENÇÕES FEITAS',
      ['Veículo', 'Tipo', 'Data', 'KM', 'Custo', 'Próximo KM', 'Próxima data', 'Descrição'],
      (dados.manutencoes?.feitas || []).map(x => [
        `${x.veiculo?.modelo || ''} ${x.veiculo?.placa || ''}`,
        x.tipo,
        formatDateOnly(x.dataManutencao),
        x.kmManutencao,
        x.custo || '',
        x.proximaManutencaoKm || '',
        formatDateOnly(x.proximaManutencaoData),
        x.descricao || ''
      ])
    ));

    partes.push(criarCsv(
      'MANUTENÇÕES PRÓXIMAS',
      ['Veículo', 'Tipo', 'Próximo KM', 'KM restante', 'Próxima data', 'Dias restantes'],
      (dados.manutencoes?.proximas || []).map(x => [
        `${x.veiculo?.modelo || ''} ${x.veiculo?.placa || ''}`,
        x.tipo,
        x.proximaManutencaoKm || '',
        x.kmRestante ?? '',
        formatDateOnly(x.proximaManutencaoData),
        x.diasRestantes ?? ''
      ])
    ));

    partes.push(criarCsv(
      'MANUTENÇÕES VENCIDAS',
      ['Veículo', 'Tipo', 'Próximo KM', 'KM restante', 'Próxima data', 'Dias restantes'],
      (dados.manutencoes?.vencidas || []).map(x => [
        `${x.veiculo?.modelo || ''} ${x.veiculo?.placa || ''}`,
        x.tipo,
        x.proximaManutencaoKm || '',
        x.kmRestante ?? '',
        formatDateOnly(x.proximaManutencaoData),
        x.diasRestantes ?? ''
      ])
    ));

    baixarArquivo(`relatorio-fleetcontrol-${dataInputBrasil()}.csv`, partes.join('\n\n'));
  }

  const resumo = dados?.resumo || {
    quantidade: 0,
    totalLitros: 0,
    totalValor: 0,
    mediaLitros: 0,
    mediaValor: 0,
    quantidadeUsos: 0,
    tempoTotalUsoMinutos: 0,
    kmTotalRodado: 0,
    quantidadeManutencoes: 0,
    manutencoesProximas: 0,
    manutencoesVencidas: 0,
    custoTotalManutencoes: 0
  };

  return (
    <>
      <Header title="Relatórios RH" subtitle="Abastecimentos, uso de veículos e manutenções conforme os filtros aplicados" />

      <form className="card card-soft p-3 mb-3" onSubmit={filtrar}>
        <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Filter size={17} /> Filtros</h5>
        <div className="row">
          <Input
            label="Data inicial"
            type="date"
            value={filtro.dataInicio}
            onChange={v => setFiltro({ ...filtro, dataInicio: v })}
          />

          <Input
            label="Data final"
            type="date"
            value={filtro.dataFim}
            onChange={v => setFiltro({ ...filtro, dataFim: v })}
          />

          <Select
            label="Veículo"
            value={filtro.veiculoId}
            onChange={v => setFiltro({ ...filtro, veiculoId: v })}
            items={veiculos}
            text={x => `${x.modelo} - ${x.placa}`}
          />

          <Select
            label="Motorista"
            value={filtro.motoristaId}
            onChange={v => setFiltro({ ...filtro, motoristaId: v })}
            items={motoristas}
            text={x => x.nome}
          />

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button className="btn btn-primary w-100">
              <Filter size={16} /> Filtrar
            </button>
          </div>

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button type="button" className="btn btn-outline-secondary w-100" onClick={limparFiltros}>
              <RotateCcw size={16} /> Todos
            </button>
          </div>

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button type="button" className="btn btn-success w-100" onClick={exportarCsv}>
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>
      </form>

      <div className="row g-3 mb-4">
        <Metric title="Abastecimentos" value={resumo.quantidade} />
        <Metric title="Litros totais" value={litros(resumo.totalLitros)} />
        <Metric title="Gasto total" value={money(resumo.totalValor)} />
        <Metric title="Média abastecimento" value={money(resumo.mediaValor)} />
        <Metric title="Usos de veículos" value={resumo.quantidadeUsos} />
        <Metric title="Tempo total de uso" value={formatTempo(resumo.tempoTotalUsoMinutos)} />
        <Metric title="KM rodado em usos" value={number(resumo.kmTotalRodado)} />
        <Metric title="Manutenções feitas" value={resumo.quantidadeManutencoes} />
        <Metric title="Manutenções próximas" value={resumo.manutencoesProximas} />
        <Metric title="Manutenções vencidas" value={resumo.manutencoesVencidas} />
        <Metric title="Custo manutenções" value={money(resumo.custoTotalManutencoes)} />
      </div>

      <div className="row g-3 mb-4">
        <TabelaResumo
          titulo="Abastecimentos por veículo"
          colunas={['Veículo', 'Qtd.', 'Litros', 'Total']}
          linhas={(dados?.abastecimentos?.porVeiculo || []).map(x => [
            x.veiculo,
            x.quantidade,
            litros(x.totalLitros),
            money(x.totalValor)
          ])}
        />

        <TabelaResumo
          titulo="Abastecimentos por motorista"
          colunas={['Motorista', 'Qtd.', 'Litros', 'Total']}
          linhas={(dados?.abastecimentos?.porMotorista || []).map(x => [
            x.motorista,
            x.quantidade,
            litros(x.totalLitros),
            money(x.totalValor)
          ])}
        />

        <TabelaResumo
          titulo="Uso por veículo"
          colunas={['Veículo', 'Qtd. usos', 'Tempo', 'KM rodado']}
          linhas={(dados?.usos?.porVeiculo || []).map(x => [
            x.veiculo,
            x.quantidadeUsos,
            formatTempo(x.tempoTotalMinutos),
            number(x.kmRodado)
          ])}
        />

        <TabelaResumo
          titulo="Uso por motorista"
          colunas={['Motorista', 'Qtd. usos', 'Tempo', 'KM rodado']}
          linhas={(dados?.usos?.porMotorista || []).map(x => [
            x.motorista,
            x.quantidadeUsos,
            formatTempo(x.tempoTotalMinutos),
            number(x.kmRodado)
          ])}
        />
      </div>

      <TabelaManutencoes
        titulo="Manutenções próximas"
        items={dados?.manutencoes?.proximas || []}
      />

      <TabelaManutencoes
        titulo="Manutenções vencidas"
        items={dados?.manutencoes?.vencidas || []}
      />

      <TabelaUsos items={dados?.usos?.itens || []} />

      <div className="card card-soft table-card mt-3">
        <div className="card-body">
          <h5>Abastecimentos detalhados</h5>
        </div>

        <TabelaAbastecimentosDetalhados items={dados?.abastecimentos?.itens || []} />
      </div>

      <TabelaManutencoes
        titulo="Manutenções feitas"
        items={dados?.manutencoes?.feitas || []}
        detalhada
      />
    </>
  );
}

function Metric({ title, value }) {
  return (
    <div className="col-md-3">
      <div className="card-soft metric">
        <small>{title}</small>
        <h3>{value}</h3>
      </div>
    </div>
  );
}

function TabelaResumo({ titulo, colunas, linhas }) {
  return (
    <div className="col-lg-6">
      <div className="card card-soft table-card">
        <div className="card-body">
          <h5>{titulo}</h5>
        </div>

        <table className="table table-hover">
          <thead>
            <tr>
              {colunas.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>

          <tbody>
            {linhas.map((linha, index) => (
              <tr key={index}>
                {linha.map((valor, i) => <td key={i}>{valor}</td>)}
              </tr>
            ))}

            {linhas.length === 0 && (
              <tr>
                <td colSpan={colunas.length} className="text-muted">
                  Nenhum dado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaAbastecimentosDetalhados({ items }) {
  return (
    <table className="table table-hover">
      <thead>
        <tr>
          <th>Data</th>
          <th>Veículo</th>
          <th>Motorista</th>
          <th>Tipo de combustível</th>
          <th>KM</th>
          <th>Litros</th>
          <th>Valor</th>
          <th>Posto</th>
        </tr>
      </thead>

      <tbody>
        {items.map(x => (
          <tr key={x.id}>
            <td>{formatDate(x.dataAbastecimento)}</td>
            <td>{x.veiculo ? `${x.veiculo.modelo || ''} - ${x.veiculo.placa || ''}` : '-'}</td>
            <td>{x.motorista?.nome || '-'}</td>
            <td>{combustivel(x.veiculo?.tipoCombustivel) || '-'}</td>
            <td>{number(x.kmAtual)}</td>
            <td>{litros(x.litros)}</td>
            <td>{money(x.valorTotal)}</td>
            <td>{x.posto || '-'}</td>
          </tr>
        ))}

        {items.length === 0 && (
          <tr>
            <td colSpan="8" className="text-muted">Nenhum abastecimento encontrado.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function TabelaUsos({ items }) {
  return (
    <div className="card card-soft table-card mt-3">
      <div className="card-body">
        <h5>Uso de veículos detalhado</h5>
      </div>

      <table className="table table-hover">
        <thead>
          <tr>
            <th>Veículo</th>
            <th>Motorista</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Tempo</th>
            <th>KM inicial</th>
            <th>KM final</th>
            <th>KM rodado</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {items.map(x => (
            <tr key={x.id}>
              <td>{x.veiculo?.modelo} - {x.veiculo?.placa}</td>
              <td>{x.motorista?.nome}</td>
              <td>{formatDate(x.dataInicio)}</td>
              <td>{formatDate(x.dataFim)}</td>
              <td>{formatTempo(x.tempoUsoMinutos)}</td>
              <td>{number(x.kmInicial)}</td>
              <td>{x.kmFinal ? number(x.kmFinal) : '-'}</td>
              <td>{x.kmFinal ? number(x.kmFinal - x.kmInicial) : '-'}</td>
              <td>
                <span className={`chip ${x.status === 1 || x.status === 'EmUso' ? 'chip-warn' : 'chip-success'}`}>
                  {x.status === 1 || x.status === 'EmUso' ? 'Em uso' : 'Finalizado'}
                </span>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan="9" className="text-muted">Nenhum uso encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TabelaManutencoes({ titulo, items, detalhada = false }) {
  return (
    <div className="card card-soft table-card mt-3">
      <div className="card-body">
        <h5>{titulo}</h5>
      </div>

      <table className="table table-hover">
        <thead>
          <tr>
            <th>Veículo</th>
            <th>Tipo</th>
            {detalhada && <th>Data</th>}
            {detalhada && <th>KM</th>}
            {detalhada && <th>Custo</th>}
            <th>Próximo KM</th>
            <th>Próxima data</th>
            <th>KM restante</th>
            <th>Dias restantes</th>
          </tr>
        </thead>

        <tbody>
          {items.map(x => (
            <tr key={x.id}>
              <td>{x.veiculo?.modelo} - {x.veiculo?.placa}</td>
              <td>{x.tipo}</td>
              {detalhada && <td>{formatDateOnly(x.dataManutencao)}</td>}
              {detalhada && <td>{number(x.kmManutencao)}</td>}
              {detalhada && <td>{x.custo ? money(x.custo) : '-'}</td>}
              <td>{x.proximaManutencaoKm ? number(x.proximaManutencaoKm) : '-'}</td>
              <td>{formatDateOnly(x.proximaManutencaoData)}</td>
              <td>{x.kmRestante ?? '-'}</td>
              <td>{x.diasRestantes ?? '-'}</td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan={detalhada ? 9 : 6} className="text-muted">
                Nenhuma manutenção encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
