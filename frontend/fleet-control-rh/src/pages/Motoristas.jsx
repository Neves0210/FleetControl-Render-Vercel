import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ClipboardList, Download, Filter, History, RotateCcw, Search, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { FiltrosSalvos } from '../components/Forms/FiltrosSalvos';
import { motoristaService } from '../services/motoristaService';
import { exportarCsv } from '../utils/exportCsv';

const initialForm = { nome: '', documento: '', telefone: '', cargo: 'Tecnico', ativo: true };

export function Motoristas() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [aba, setAba] = useState('registrar');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState({ cargo: '', status: '' });
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);

  const cargos = useMemo(() => {
    return [...new Set(items.map(x => x.cargo).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map(cargo => ({ id: cargo, nome: cargo }));
  }, [items]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return items.filter(x => {
      if (q && !`${x.nome} ${x.documento || ''} ${x.telefone || ''} ${x.cargo || ''}`.toLowerCase().includes(q)) return false;
      if (filtro.cargo && x.cargo !== filtro.cargo) return false;
      if (filtro.status && String(Boolean(x.ativo)) !== filtro.status) return false;
      return true;
    });
  }, [items, busca, filtro]);

  async function load() {
    const r = await motoristaService.listar({ incluirInativos: true });
    setItems(r.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Erro ao carregar motoristas.'));
  }, []);

  async function save(e) {
    e.preventDefault();

    try {
      if (edit) await motoristaService.atualizar(edit, form);
      else await motoristaService.criar(form);

      toast.success('Motorista salvo.');
      setForm(initialForm);
      setEdit(null);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar.');
    }
  }

  async function del(id) {
    if (!confirm('Remover motorista?')) return;

    try {
      await motoristaService.remover(id);
      toast.success('Motorista removido.');
      await load();
    } catch {
      toast.error('Erro ao remover motorista.');
    }
  }

  async function alternarStatus(item) {
    const proximoStatus = !item.ativo;

    try {
      await motoristaService.atualizar(item.id, { ...item, ativo: proximoStatus });
      toast.success(proximoStatus ? 'Motorista ativado.' : 'Motorista inativado.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao alterar status.');
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
    setFiltro({ cargo: '', status: '' });
  }

  function exportar() {
    exportarCsv('motoristas', [
      { label: 'Nome', value: 'nome' },
      { label: 'Documento', value: 'documento' },
      { label: 'Telefone', value: 'telefone' },
      { label: 'Cargo', value: 'cargo' },
      { label: 'Status', value: x => x.ativo ? 'Ativo' : 'Inativo' }
    ], filtered);
  }

  return (
    <>
      <Header
        title="Motoristas/Tecnicos"
        subtitle={aba === 'registrar' ? 'Equipe vinculada aos abastecimentos' : 'Consulte e filtre pessoas cadastradas'}
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
            <Users size={17} /> {edit ? 'Editar pessoa' : 'Nova pessoa'}
          </h5>
          <form className="card card-soft p-3 mb-3" onSubmit={save}>
            <div className="row">
              <Input label="Nome" required value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
              <Input label="Documento" value={form.documento || ''} onChange={v => setForm({ ...form, documento: v })} />
              <Input label="Telefone" value={form.telefone || ''} onChange={v => setForm({ ...form, telefone: v })} />
              <Input label="Cargo" value={form.cargo || ''} onChange={v => setForm({ ...form, cargo: v })} />

              <div className="col-md-2 mb-3">
                <label>Status</label>
                <select className="form-select" value={form.ativo ? 'true' : 'false'} onChange={e => setForm({ ...form, ativo: e.target.value === 'true' })}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              <div className="col-md-2 mb-3 d-flex align-items-end"><button className="btn btn-success w-100">{edit ? 'Atualizar' : 'Salvar'}</button></div>
            </div>
          </form>
        </>
      )}

      {aba === 'consultar' && (
        <>
          <div className="card card-soft p-3 mb-3">
            <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Filter size={17} /> Filtros
            </h5>

            <div className="row">
              <div className="col-md-3 mb-3">
                <label>Cargo</label>
                <select className="form-select" value={filtro.cargo} onChange={e => setFiltro({ ...filtro, cargo: e.target.value })}>
                  <option value="">Todos</option>
                  {cargos.map(cargo => <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>)}
                </select>
              </div>

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
                <input className="form-control" placeholder="Nome, documento, telefone ou cargo" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>

              <FiltrosSalvos
                storageKey="filtros-motoristas"
                value={{ busca, filtro }}
                onApply={v => {
                  setBusca(v.busca || '');
                  setFiltro(v.filtro || { cargo: '', status: '' });
                }}
              />

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

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-success w-100" onClick={exportar}>
                  <Download size={16} /> Exportar
                </button>
              </div>
            </div>

            <small className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardList size={14} /> Exibindo {filtered.length} de {items.length} pessoa(s).
            </small>
          </div>

          <div className="card card-soft table-card">
            <table className="table table-hover">
              <thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>Cargo</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map(x => (
                  <tr key={x.id}>
                    <td>{x.nome}</td><td>{x.documento}</td><td>{x.telefone}</td>
                    <td>{x.cargo ? <span className="chip chip-success">{x.cargo}</span> : '-'}</td>
                    <td><span className={`chip ${x.ativo ? 'chip-success' : 'chip-danger'}`}>{x.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => navigate(`/motoristas/${x.id}/perfil`)}>
                        <History size={14} /> Perfil
                      </button>
                      <button
                        className={`btn btn-sm ${x.ativo ? 'btn-outline-danger' : 'btn-outline-success'} me-2`}
                        onClick={() => alternarStatus(x)}
                      >
                        {x.ativo ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {x.ativo ? ' Inativar' : ' Ativar'}
                      </button>
                      <button className="btn btn-sm btn-warning me-2" onClick={() => editar(x)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(x.id)}>Remover</button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhuma pessoa encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
