import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Header } from '../components/Layout/Header';
import { Select } from '../components/Forms/Select';
import { Input } from '../components/Forms/Input';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { relatorioService } from '../services/relatorioService';
import { veiculoService } from '../services/veiculoService';
import { motoristaService } from '../services/motoristaService';
import { litros, money } from '../utils/formatters';

const hoje = new Date().toISOString().slice(0, 10);

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

  async function carregarRelatorio() {
    const params = {
      dataInicio: filtro.dataInicio || undefined,
      dataFim: filtro.dataFim || undefined,
      veiculoId: filtro.veiculoId || undefined,
      motoristaId: filtro.motoristaId || undefined
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

  const resumo = dados?.resumo || {
    quantidade: 0,
    totalLitros: 0,
    totalValor: 0,
    mediaLitros: 0,
    mediaValor: 0
  };

  return (
    <>
      <Header title="Relatórios RH" subtitle="Análise dos abastecimentos por período, veículo e motorista" />

      <form className="card card-soft p-3 mb-3" onSubmit={filtrar}>
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
              Filtrar
            </button>
          </div>
        </div>
      </form>

      <div className="row g-3 mb-4">
        <Metric title="Abastecimentos" value={resumo.quantidade} />
        <Metric title="Litros totais" value={litros(resumo.totalLitros)} />
        <Metric title="Gasto total" value={money(resumo.totalValor)} />
        <Metric title="Média por abastecimento" value={money(resumo.mediaValor)} />
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="card card-soft table-card">
            <div className="card-body">
              <h5>Resumo por veículo</h5>
            </div>
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Qtd.</th>
                  <th>Litros</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.porVeiculo || []).map(x => (
                  <tr key={x.veiculoId}>
                    <td>{x.veiculo}</td>
                    <td>{x.quantidade}</td>
                    <td>{litros(x.totalLitros)}</td>
                    <td>{money(x.totalValor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card card-soft table-card">
            <div className="card-body">
              <h5>Resumo por motorista</h5>
            </div>
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Motorista</th>
                  <th>Qtd.</th>
                  <th>Litros</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.porMotorista || []).map(x => (
                  <tr key={x.motoristaId}>
                    <td>{x.motorista}</td>
                    <td>{x.quantidade}</td>
                    <td>{litros(x.totalLitros)}</td>
                    <td>{money(x.totalValor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card-soft table-card">
        <div className="card-body">
          <h5>Abastecimentos do período</h5>
        </div>
        <AbastecimentosTabela items={dados?.itens || []} />
      </div>
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
