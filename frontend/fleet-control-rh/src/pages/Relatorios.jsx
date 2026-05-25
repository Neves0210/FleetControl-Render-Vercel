import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Header } from '../components/Layout/Header';
import { api } from '../api/api';
import { litros, money, toNumber } from '../utils/formatters';

export function Relatorios() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get('/abastecimentos')
      .then(r => { if (!cancelled) setItems(r.data); })
      .catch(() => { if (!cancelled) toast.error('Erro ao carregar relatórios.'); });
    return () => { cancelled = true; };
  }, []);

  const porVeiculo = Object.values(items.reduce((acc, x) => {
    const k = x.veiculo?.placa || 'Sem placa';
    acc[k] ??= { nome: k, litros: 0, valor: 0, qtd: 0 };
    acc[k].litros += toNumber(x.litros);
    acc[k].valor += toNumber(x.valorTotal);
    acc[k].qtd++;
    return acc;
  }, {}));

  return (
    <>
      <Header title="Relatórios RH" subtitle="Consolidação por veículo" />
      <div className="card card-soft table-card">
        <table className="table table-hover">
          <thead><tr><th>Veículo</th><th>Qtd.</th><th>Litros</th><th>Total</th></tr></thead>
          <tbody>{porVeiculo.map(x => <tr key={x.nome}><td>{x.nome}</td><td>{x.qtd}</td><td>{litros(x.litros)}</td><td>{money(x.valor)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
