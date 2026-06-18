import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Car, Download, Fuel, KeyRound, Plus, Route, Wrench } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Metric } from '../components/Dashboard/Metric';
import { veiculoService } from '../services/veiculoService';
import { combustivel, dataHora, litros, money, number } from '../utils/formatters';
import { exportarCsv } from '../utils/exportCsv';
import { dataBrasil } from '../utils/dataBrasil';

function data(value) {
  return dataBrasil(value);
}

function statusUso(status) {
  return status === 1 || status === 'EmUso' ? 'Em uso' : 'Finalizado';
}

export function HistoricoVeiculo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);

  useEffect(() => {
    veiculoService.historico(id)
      .then(r => setDados(r.data))
      .catch(() => toast.error('Erro ao carregar historico do veiculo.'));
  }, [id]);

  if (!dados) {
    return (
      <>
        <Header title="Historico do veiculo" subtitle="Carregando..." />
        <div className="card card-soft p-3"><p className="text-muted" style={{ margin: 0 }}>Carregando...</p></div>
      </>
    );
  }

  const { veiculo, resumo, abastecimentos, usos, manutencoes, auditoria } = dados;

  function exportar() {
    const linhas = [
      ...abastecimentos.map(x => ({ tipo: 'Abastecimento', data: dataHora(x.dataAbastecimento), descricao: x.posto || '-', km: x.kmAtual, valor: x.valorTotal })),
      ...usos.map(x => ({ tipo: 'Uso', data: dataHora(x.dataInicio), descricao: `${x.motorista || '-'} | ${statusUso(x.status)}`, km: x.kmFinal || x.kmInicial, valor: '' })),
      ...manutencoes.map(x => ({ tipo: 'Manutencao', data: data(x.dataManutencao), descricao: x.tipo, km: x.kmManutencao, valor: x.custo || '' }))
    ];

    exportarCsv(`historico-${veiculo.placa}`, [
      { label: 'Tipo', value: 'tipo' },
      { label: 'Data', value: 'data' },
      { label: 'Descricao', value: 'descricao' },
      { label: 'KM', value: x => number(x.km) },
      { label: 'Valor', value: x => x.valor === '' ? '' : money(x.valor) }
    ], linhas);
  }

  return (
    <>
      <Header
        title={`${veiculo.modelo} - ${veiculo.placa}`}
        subtitle={`Historico completo | ${combustivel(veiculo.tipoCombustivel)} | KM ${number(veiculo.kmAtual)}`}
        actions={
          <>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/veiculos')}>
              <ArrowLeft size={16} /> Voltar
            </button>
            <button className="btn btn-primary" onClick={() => navigate(`/abastecimentos?aba=registrar&veiculoId=${veiculo.id}`)}>
              <Plus size={16} /> Abastecer
            </button>
            <button className="btn btn-outline-secondary" onClick={() => navigate(`/uso-veiculos?aba=registrar&veiculoId=${veiculo.id}`)}>
              <Route size={16} /> Iniciar uso
            </button>
            <button className="btn btn-outline-secondary" onClick={() => navigate(`/manutencoes?aba=registrar&veiculoId=${veiculo.id}`)}>
              <Wrench size={16} /> Manutenção
            </button>
            <button className="btn btn-success" onClick={exportar}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />

      <div className="row g-3 mb-3">
        <Metric title="Abastecimentos" value={number(resumo.abastecimentos)} icon={<Fuel size={20} />} cor="#30a8d8" />
        <Metric title="Usos" value={number(resumo.usos)} icon={<KeyRound size={20} />} cor="#300840" />
        <Metric title="Manutencoes" value={number(resumo.manutencoes)} icon={<Wrench size={20} />} cor="#f8e000" />
        <Metric title="Litros" value={litros(resumo.litros)} icon={<Fuel size={20} />} cor="#10c040" />
        <Metric title="Custo total" value={money(resumo.gasto)} icon={<Car size={20} />} cor="#dc2626" />
      </div>

      <div className="card card-soft table-card mb-3">
        <div className="card-body"><h5>Abastecimentos</h5></div>
        <table className="table table-hover">
          <thead><tr><th>Data</th><th>Motorista</th><th>Posto</th><th>KM</th><th>Litros</th><th>Valor</th><th>Nota</th></tr></thead>
          <tbody>
            {abastecimentos.map(x => (
              <tr key={x.id}>
                <td>{dataHora(x.dataAbastecimento)}</td>
                <td>{x.motorista || '-'}</td>
                <td>{x.posto || '-'}</td>
                <td>{number(x.kmAtual)}</td>
                <td>{litros(x.litros)}</td>
                <td>{money(x.valorTotal)}</td>
                <td>{x.temFoto ? 'Sim' : '-'}</td>
              </tr>
            ))}
            {abastecimentos.length === 0 && <tr><td colSpan="7" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum abastecimento.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card card-soft table-card mb-3">
        <div className="card-body"><h5>Uso de veiculo</h5></div>
        <table className="table table-hover">
          <thead><tr><th>Status</th><th>Motorista</th><th>Inicio</th><th>Fim</th><th>KM inicial</th><th>KM final</th><th>Tempo</th></tr></thead>
          <tbody>
            {usos.map(x => (
              <tr key={x.id}>
                <td><span className={statusUso(x.status) === 'Em uso' ? 'chip chip-warn' : 'chip chip-success'}>{statusUso(x.status)}</span></td>
                <td>{x.motorista || '-'}</td>
                <td>{dataHora(x.dataInicio)}</td>
                <td>{dataHora(x.dataFim)}</td>
                <td>{number(x.kmInicial)}</td>
                <td>{x.kmFinal ? number(x.kmFinal) : '-'}</td>
                <td>{x.tempoUsoMinutos ? `${Math.round(x.tempoUsoMinutos)} min` : '-'}</td>
              </tr>
            ))}
            {usos.length === 0 && <tr><td colSpan="7" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum uso.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card card-soft table-card mb-3">
        <div className="card-body"><h5>Manutencoes</h5></div>
        <table className="table table-hover">
          <thead><tr><th>Tipo</th><th>Data</th><th>KM</th><th>Custo</th><th>Proximo KM</th><th>Proxima data</th><th>Anexo</th></tr></thead>
          <tbody>
            {manutencoes.map(x => (
              <tr key={x.id}>
                <td>{x.tipo}</td>
                <td>{data(x.dataManutencao)}</td>
                <td>{number(x.kmManutencao)}</td>
                <td>{x.custo ? money(x.custo) : '-'}</td>
                <td>{x.proximaManutencaoKm ? number(x.proximaManutencaoKm) : '-'}</td>
                <td>{data(x.proximaManutencaoData)}</td>
                <td>{x.temAnexo ? x.anexoNome || 'Sim' : '-'}</td>
              </tr>
            ))}
            {manutencoes.length === 0 && <tr><td colSpan="7" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhuma manutencao.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card card-soft table-card">
        <div className="card-body"><h5>Auditoria recente</h5></div>
        <table className="table table-hover">
          <thead><tr><th>Quando</th><th>Quem fez</th><th>O que fez</th><th>Detalhes</th></tr></thead>
          <tbody>
            {auditoria.map(x => (
              <tr key={x.id}>
                <td>{dataHora(x.criadoEm)}</td>
                <td>{x.usuarioNome || '-'}</td>
                <td>{x.acao}</td>
                <td>{x.resumo || '-'}</td>
              </tr>
            ))}
            {auditoria.length === 0 && <tr><td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum registro recente.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
