import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../api/api';
import { Metric } from '../components/Dashboard/Metric';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { money, number } from '../utils/formatters';

export function Dashboard() {
  const [data, setData] = useState(null);
  const [abastecimentos, setAbastecimentos] = useState([]);

  useEffect(() => {
    let cancelled = false;

    api.get('/dashboard')
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) toast.error('Erro ao carregar dashboard.'); });

    api.get('/abastecimentos')
      .then(r => { if (!cancelled) setAbastecimentos(r.data.slice(0, 5)); })
      .catch(() => { if (!cancelled) toast.error('Erro ao carregar abastecimentos.'); });

    return () => { cancelled = true; };
  }, []);

  if (!data) return <p>Carregando...</p>;

  return (
    <>
      <h2 className="mb-3">Dashboard RH</h2>

      <div className="row g-3 mb-4">
        <Metric title="Veículos ativos" value={data.veiculos} />
        <Metric title="Motoristas ativos" value={data.motoristas} />
        <Metric title="Abastecimentos" value={data.abastecimentos} />
        <Metric title="Litros totais" value={number(data.totalLitros)} />
        <Metric title="Gasto total" value={money(data.totalValor)} />
      </div>

      <div className="card card-soft table-card">
        <div className="card-body"><h5>Últimos abastecimentos</h5></div>
        <AbastecimentosTabela items={abastecimentos} />
      </div>
    </>
  );
}
