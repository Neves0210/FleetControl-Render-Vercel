import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Car, ClipboardList, Filter, RotateCcw, Search } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { FormVeiculo } from '../components/Forms/FormVeiculo';
import { Select } from '../components/Forms/Select';
import { veiculoService } from '../services/veiculoService';
import { combustivel, number } from '../utils/formatters';

const initialForm = { modelo: '', placa: '', kmAtual: 0, tipoCombustivel: 2, ativo: true };
const combustiveis = [
  { id: 1, nome: 'Gasolina' },
  { id: 2, nome: 'Etanol' },
  { id: 3, nome: 'Diesel' },
  { id: 4, nome: 'Flex' }
];

export function Veiculos() {
  const [items, setItems] = useState([]);
  const [aba, setAba] = useState('registrar');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState({ tipoCombustivel: '', status: '' });
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return items.filter(x => {
      if (q && !`${x.modelo} ${x.placa}`.toLowerCase().includes(q)) return false;
      if (filtro.tipoCombustivel && String(x.tipoCombustivel) !== String(filtro.tipoCombustivel)) return false;
      if (filtro.status && String(Boolean(x.ativo)) !== filtro.status) return false;
      return true;
    });
  }, [items, busca, filtro]);

  async function load() {
    const r = await veiculoService.listar();
    setItems(r.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Erro ao carregar veiculos.'));
  }, []);

  async function save(e) {
    e.preventDefault();

    try {
      if (edit) await veiculoService.atualizar(edit, form);
      else await veiculoService.criar(form);

      toast.success('Veiculo salvo.');
      setForm(initialForm);
      setEdit(null);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar.');
    }
  }

  async function del(id) {
    if (!confirm('Remover veiculo?')) return;

    try {
      await veiculoService.remover(id);
      toast.success('Veiculo removido.');
      await load();
    } catch {
      toast.error('Erro ao remover veiculo.');
    }
  }

  function editar(item) {
    setEdit(item.id);
    setForm(item);
    setAba('registrar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEdit(null);
    setForm(initialForm);
  }

  function limparConsulta() {
    setBusca('');
    setFiltro({ tipoCombustivel: '', status: '' });
  }

  return (
    <>
      <Header
        title="Veiculos"
        subtitle={aba === 'registrar' ? 'Cadastro e manutencao da frota' : 'Consulte e filtre a frota cadastrada'}
        actions={edit && aba === 'registrar'
          ? <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>Cancelar edicao</button>
          : <span className="badge-soft">{items.length} cadastrados</span>}
      />

      <div className="segmented" style={{ marginBottom: 18 }}>
        <button className={`seg ${aba === 'registrar' ? 'active' : ''}`} onClick={() => setAba('registrar')}>
          Registro
        </button>
        <button className={`seg ${aba === 'consultar' ? 'active' : ''}`} onClick={() => setAba('consultar')}>
          Consulta
        </button>
      </div>

      {aba === 'registrar' && (
        <>
          <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Car size={17} /> {edit ? 'Editar veiculo' : 'Novo veiculo'}
          </h5>
          <FormVeiculo form={form} setForm={setForm} save={save} edit={edit} />
        </>
      )}

      {aba === 'consultar' && (
        <>
          <div className="card card-soft p-3 mb-3">
            <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Filter size={17} /> Filtros
            </h5>

            <div className="row">
              <Select label="Combustivel" value={filtro.tipoCombustivel} onChange={v => setFiltro({ ...filtro, tipoCombustivel: v })} items={combustiveis} text={x => x.nome} />

              <div className="col-md-3 mb-3">
                <label>Status</label>
                <select className="form-select" value={filtro.status} onChange={e => setFiltro({ ...filtro, status: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="true">Ativos</option>
                  <option value="false">Inativos</option>
                </select>
              </div>

              <div className="col-md-12 mb-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Buscar</label>
                <input className="form-control" placeholder="Modelo ou placa" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-primary w-100">
                  <Filter size={16} /> Filtrar
                </button>
              </div>

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-outline-secondary w-100" onClick={limparConsulta}>
                  <RotateCcw size={16} /> Limpar
                </button>
              </div>
            </div>

            <small className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardList size={14} /> Exibindo {filtered.length} de {items.length} veiculo(s).
            </small>
          </div>

          <div className="card card-soft table-card">
            <table className="table table-hover">
              <thead>
                <tr><th>Modelo</th><th>Placa</th><th>KM atual</th><th>Combustivel</th><th>Status</th><th width="180"></th></tr>
              </thead>
              <tbody>
                {filtered.map(x => (
                  <tr key={x.id}>
                    <td>{x.modelo}</td>
                    <td><span className="badge-soft">{x.placa}</span></td>
                    <td>{number(x.kmAtual)}</td>
                    <td><span className="chip chip-success">{combustivel(x.tipoCombustivel)}</span></td>
                    <td><span className={`chip ${x.ativo ? 'chip-success' : 'chip-danger'}`}>{x.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <button className="btn btn-sm btn-warning me-2" onClick={() => editar(x)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(x.id)}>Remover</button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum veiculo encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
