import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ClipboardList, Filter, RotateCcw, Search, ShieldCheck, UserCog } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { usuarioService } from '../services/usuarioService';
import { TODAS_PERMISSOES } from '../utils/constants';
import { perfil } from '../utils/formatters';
import { PermissoesSelect } from '../components/Forms/PermissoesSelect';

const initialForm = {
  nome: '',
  email: '',
  senha: '123456',
  perfil: 3,
  motoristaId: '',
  ativo: true,
  permissoes: []
};

export function Usuarios() {
  const [items, setItems] = useState([]);
  const [aba, setAba] = useState('registrar');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState({ perfil: '', status: '' });
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return items.filter(x => {
      if (q) {
        const alvo = `${x.nome || ''} ${x.email || ''} ${x.motoristaId || ''} ${(x.permissoes || []).join(' ')}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }

      if (filtro.perfil && String(x.perfil) !== filtro.perfil) return false;
      if (filtro.status && String(Boolean(x.ativo)) !== filtro.status) return false;
      return true;
    });
  }, [items, busca, filtro]);

  async function load() {
    const r = await usuarioService.listar();
    setItems(r.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Voce nao tem permissao para acessar usuarios.'));
  }, []);

  async function save(e) {
    e.preventDefault();

    const payload = {
      ...form,
      motoristaId: form.motoristaId ? Number(form.motoristaId) : null,
      perfil: Number(form.perfil),
      permissoes: form.permissoes || []
    };

    try {
      if (edit) await usuarioService.atualizar(edit, payload);
      else await usuarioService.criar(payload);

      toast.success('Usuario salvo.');
      setForm(initialForm);
      setEdit(null);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar usuario.');
    }
  }

  function aplicarPermissoesPadrao(perfilSelecionado) {
    const perfilNumero = Number(perfilSelecionado);
    let permissoesPadrao = [];

    if (perfilNumero === 1) permissoesPadrao = TODAS_PERMISSOES;
    if (perfilNumero === 2) permissoesPadrao = [
      'Dashboard.Visualizar', 'Veiculos.Visualizar', 'Motoristas.Visualizar',
      'Abastecimentos.Visualizar', 'Abastecimentos.Criar', 'Abastecimentos.Editar',
      'Relatorios.Visualizar', 'Relatorios.Exportar'
    ];
    if (perfilNumero === 3) permissoesPadrao = [
      'Dashboard.Visualizar', 'Abastecimentos.Visualizar', 'Abastecimentos.Criar'
    ];

    setForm({ ...form, perfil: perfilNumero, permissoes: permissoesPadrao });
  }

  function chipPerfil(p) {
    const cls = p === 1 ? 'chip-danger' : p === 2 ? 'chip-warn' : 'chip-success';
    return <span className={`chip ${cls}`}>{perfil(p)}</span>;
  }

  function editar(item) {
    setEdit(item.id);
    setForm({
      nome: item.nome || '',
      email: item.email || '',
      senha: '',
      perfil: item.perfil,
      motoristaId: item.motoristaId || '',
      ativo: item.ativo,
      permissoes: item.permissoes || []
    });
    setAba('registrar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEdit(null);
    setForm(initialForm);
  }

  function limparConsulta() {
    setBusca('');
    setFiltro({ perfil: '', status: '' });
  }

  return (
    <>
      <Header
        title="Usuarios"
        subtitle={aba === 'registrar' ? 'Controle de acesso, perfis e permissoes' : 'Consulte e filtre usuarios cadastrados'}
        actions={edit && aba === 'registrar'
          ? <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>Cancelar edicao</button>
          : <span className="badge-soft">{items.length} usuarios</span>}
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
            <UserCog size={17} /> {edit ? 'Editar usuario' : 'Novo usuario'}
          </h5>

          <form className="card card-soft p-3 mb-3" onSubmit={save}>
            <div className="row">
              <Input label="Nome" required value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
              <Input label="E-mail" required type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
              <Input label="Senha" required={!edit} minLength={4} value={form.senha || ''} onChange={v => setForm({ ...form, senha: v })} />

              <div className="col-md-2 mb-3">
                <label>Perfil</label>
                <select className="form-select" required value={form.perfil} onChange={e => aplicarPermissoesPadrao(e.target.value)}>
                  <option value="1">Master</option>
                  <option value="2">RH</option>
                  <option value="3">Tecnico</option>
                </select>
              </div>

              <Input label="MotoristaId" type="number" value={form.motoristaId} onChange={v => setForm({ ...form, motoristaId: v })} />

              <div className="col-md-2 mb-3">
                <label>Status</label>
                <select className="form-select" value={form.ativo ? 'true' : 'false'} onChange={e => setForm({ ...form, ativo: e.target.value === 'true' })}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              <div className="col-md-12 mb-3">
                <div className="nfce-section">
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ShieldCheck size={15} /> Permissoes de acesso
                    <span className="badge-soft" style={{ marginLeft: 'auto' }}>{form.permissoes.length} ativas</span>
                  </div>
                  <div className="mt-2">
                    <PermissoesSelect
                      todas={TODAS_PERMISSOES}
                      value={form.permissoes}
                      onChange={permissoes => setForm({ ...form, permissoes })}
                    />
                  </div>
                </div>
              </div>

              <div className="col-md-2 d-flex align-items-end mb-3"><button className="btn btn-success w-100">{edit ? 'Atualizar' : 'Salvar'}</button></div>
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
                <label>Perfil</label>
                <select className="form-select" value={filtro.perfil} onChange={e => setFiltro({ ...filtro, perfil: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="1">Master</option>
                  <option value="2">RH</option>
                  <option value="3">Tecnico</option>
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
                <input className="form-control" placeholder="Nome, e-mail, MotoristaId ou permissao" value={busca} onChange={e => setBusca(e.target.value)} />
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
              <ClipboardList size={14} /> Exibindo {filtered.length} de {items.length} usuario(s).
            </small>
          </div>

          <div className="card card-soft table-card">
            <table className="table table-hover">
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>MotoristaId</th><th>Status</th><th>Permissoes</th><th></th></tr></thead>
              <tbody>
                {filtered.map(x => (
                  <tr key={x.id}>
                    <td>{x.nome}</td>
                    <td>{x.email}</td>
                    <td>{chipPerfil(x.perfil)}</td>
                    <td>{x.motoristaId || '-'}</td>
                    <td><span className={`chip ${x.ativo ? 'chip-success' : 'chip-danger'}`}>{x.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td><span className="badge-soft">{x.permissoes?.length || 0}</span></td>
                    <td>
                      <button className="btn btn-sm btn-warning" onClick={() => editar(x)}>Editar</button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr><td colSpan="7" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum usuario encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
