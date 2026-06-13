import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Download, Fuel, KeyRound, Users } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Metric } from '../components/Dashboard/Metric';
import { motoristaService } from '../services/motoristaService';
import { abastecimentoService } from '../services/abastecimentoService';
import { usoVeiculoService } from '../services/usoVeiculoService';
import { dataHora, litros, money, number } from '../utils/formatters';
import { exportarCsv } from '../utils/exportCsv';

function statusUso(status) {
  return status === 1 || status === 'EmUso' ? 'Em uso' : 'Finalizado';
}

export function PerfilMotorista() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [motorista, setMotorista] = useState(null);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [usos, setUsos] = useState([]);

  useEffect(() => {
    async function carregar() {
      try {
        const [motoristasRes, abastecimentosRes, usosRes] = await Promise.all([
          motoristaService.listar({ incluirInativos: true }),
          abastecimentoService.listar({ motoristaId: id }),
          usoVeiculoService.listar({ motoristaId: id })
        ]);

        setMotorista(motoristasRes.data.find(x => String(x.id) === String(id)));
        setAbastecimentos(abastecimentosRes.data);
        setUsos(usosRes.data);
      } catch {
        toast.error('Erro ao carregar perfil do motorista.');
      }
    }

    carregar();
  }, [id]);

  const resumo = useMemo(() => ({
    abastecimentos: abastecimentos.length,
    usos: usos.length,
    litros: abastecimentos.reduce((s, x) => s + Number(x.litros || 0), 0),
    gasto: abastecimentos.reduce((s, x) => s + Number(x.valorTotal || 0), 0)
  }), [abastecimentos, usos]);

  function exportar() {
    const linhas = [
      ...abastecimentos.map(x => ({ tipo: 'Abastecimento', data: dataHora(x.dataAbastecimento), veiculo: `${x.veiculo?.modelo || ''} - ${x.veiculo?.placa || ''}`, km: x.kmAtual, valor: x.valorTotal })),
      ...usos.map(x => ({ tipo: 'Uso', data: dataHora(x.dataInicio), veiculo: `${x.veiculo?.modelo || ''} - ${x.veiculo?.placa || ''}`, km: x.kmFinal || x.kmInicial, valor: '' }))
    ];

    exportarCsv(`perfil-${motorista?.nome || id}`, [
      { label: 'Tipo', value: 'tipo' },
      { label: 'Data', value: 'data' },
      { label: 'Veiculo', value: 'veiculo' },
      { label: 'KM', value: x => number(x.km) },
      { label: 'Valor', value: x => x.valor === '' ? '' : money(x.valor) }
    ], linhas);
  }

  return (
    <>
      <Header
        title={motorista?.nome || 'Perfil do motorista'}
        subtitle={`${motorista?.cargo || 'Motorista/Tecnico'}${motorista?.telefone ? ` | ${motorista.telefone}` : ''}`}
        actions={
          <>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/motoristas')}>
              <ArrowLeft size={16} /> Voltar
            </button>
            <button className="btn btn-success" onClick={exportar}>
              <Download size={16} /> Exportar
            </button>
          </>
        }
      />

      <div className="row g-3 mb-3">
        <Metric title="Abastecimentos" value={number(resumo.abastecimentos)} icon={<Fuel size={20} />} cor="#0891b2" />
        <Metric title="Usos" value={number(resumo.usos)} icon={<KeyRound size={20} />} cor="#2563eb" />
        <Metric title="Litros" value={litros(resumo.litros)} icon={<Fuel size={20} />} cor="#16a34a" />
        <Metric title="Gasto abastecido" value={money(resumo.gasto)} icon={<Users size={20} />} cor="#d97706" />
      </div>

      <div className="card card-soft table-card mb-3">
        <div className="card-body"><h5>Abastecimentos</h5></div>
        <table className="table table-hover">
          <thead><tr><th>Data</th><th>Veiculo</th><th>Posto</th><th>KM</th><th>Litros</th><th>Valor</th></tr></thead>
          <tbody>
            {abastecimentos.map(x => (
              <tr key={x.id}>
                <td>{dataHora(x.dataAbastecimento)}</td>
                <td>{x.veiculo?.modelo} - {x.veiculo?.placa}</td>
                <td>{x.posto || '-'}</td>
                <td>{number(x.kmAtual)}</td>
                <td>{litros(x.litros)}</td>
                <td>{money(x.valorTotal)}</td>
              </tr>
            ))}
            {abastecimentos.length === 0 && <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum abastecimento.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card card-soft table-card">
        <div className="card-body"><h5>Uso de veiculos</h5></div>
        <table className="table table-hover">
          <thead><tr><th>Status</th><th>Veiculo</th><th>Inicio</th><th>Fim</th><th>KM inicial</th><th>KM final</th></tr></thead>
          <tbody>
            {usos.map(x => (
              <tr key={x.id}>
                <td><span className={statusUso(x.status) === 'Em uso' ? 'chip chip-warn' : 'chip chip-success'}>{statusUso(x.status)}</span></td>
                <td>{x.veiculo?.modelo} - {x.veiculo?.placa}</td>
                <td>{dataHora(x.dataInicio)}</td>
                <td>{dataHora(x.dataFim)}</td>
                <td>{number(x.kmInicial)}</td>
                <td>{x.kmFinal ? number(x.kmFinal) : '-'}</td>
              </tr>
            ))}
            {usos.length === 0 && <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum uso.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
