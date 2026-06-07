import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Car } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { FormVeiculo } from '../components/Forms/FormVeiculo';
import { Search } from '../components/Forms/Search';
import { veiculoService } from '../services/veiculoService';
import { combustivel, number } from '../utils/formatters';

const initialForm = { modelo: '', placa: '', kmAtual: 0, tipoCombustivel: 2, ativo: true };

export function Veiculos() {
  const [items, setItems] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);

  const filtered = useMemo(() => items.filter(x => `${x.modelo}${x.placa}`.toLowerCase().includes(busca.toLowerCase())), [items, busca]);

  async function load() {
    const r = await veiculoService.listar();
    setItems(r.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Erro ao carregar veículos.'));
  }, []);

  async function save(e) {
    e.preventDefault();

    try {
      if (edit) await veiculoService.atualizar(edit, form);
      else await veiculoService.criar(form);

      toast.success('Veículo salvo.');
      setForm(initialForm);
      setEdit(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar.');
    }
  }

  async function del(id) {
    if (!confirm('Remover veículo?')) return;

    try {
      await veiculoService.remover(id);
      toast.success('Veículo removido.');
      await load();
    } catch {
      toast.error('Erro ao remover veículo.');
    }
  }

  return (
    <>
      <Header
        title="Veículos"
        subtitle="Cadastro e manutenção da frota"
        actions={<span className="badge-soft">{items.length} cadastrados</span>}
      />

      <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Car size={17} /> {edit ? 'Editar veículo' : 'Novo veículo'}
      </h5>
      <FormVeiculo form={form} setForm={setForm} save={save} edit={edit} />

      <Search value={busca} setValue={setBusca} />

      <div className="card card-soft table-card">
        <table className="table table-hover">
          <thead>
            <tr><th>Modelo</th><th>Placa</th><th>KM atual</th><th>Combustível</th><th width="180"></th></tr>
          </thead>
          <tbody>
            {filtered.map(x => (
              <tr key={x.id}>
                <td>{x.modelo}</td>
                <td><span className="badge-soft">{x.placa}</span></td>
                <td>{number(x.kmAtual)}</td>
                <td><span className="chip chip-success">{combustivel(x.tipoCombustivel)}</span></td>
                <td>
                  <button className="btn btn-sm btn-warning me-2" onClick={() => { setEdit(x.id); setForm(x); }}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(x.id)}>Remover</button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr><td colSpan="5" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum veículo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
