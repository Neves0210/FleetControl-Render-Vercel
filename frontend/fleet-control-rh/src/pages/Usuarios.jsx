import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { UserCog, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { usuarioService } from '../services/usuarioService';
import { TODAS_PERMISSOES } from '../utils/constants';
import { perfil } from '../utils/formatters';

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
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);

  async function load() {
    const r = await usuarioService.listar();
    setItems(r.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Você não tem permissão para acessar usuários.'));
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

      toast.success('Usuário salvo.');
      setForm(initialForm);
      setEdit(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar usuário.');
    }
  }

  function togglePermissao(permissao, checked) {
    const permissoes = checked
      ? [...form.permissoes, permissao]
      : form.permissoes.filter(x => x !== permissao);

    setForm({ ...form, permissoes });
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

  return (
    <>
      <Header
        title="Usuários"
        subtitle="Controle de acesso, perfis e permissões"
        actions={<span className="badge-soft">{items.length} usuários</span>}
      />

      <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <UserCog size={17} /> {edit ? 'Editar usuário' : 'Novo usuário'}
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
              <option value="3">Técnico</option>
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
                <ShieldCheck size={15} /> Permissões de acesso
                <span className="badge-soft" style={{ marginLeft: 'auto' }}>{form.permissoes.length} ativas</span>
              </div>
              <div className="row mt-2">
                {TODAS_PERMISSOES.map(p => (
                  <div className="col-md-4 mb-2" key={p}>
                    <label className="form-check">
                      <input type="checkbox" className="form-check-input" checked={form.permissoes.includes(p)} onChange={e => togglePermissao(p, e.target.checked)} />
                      <span className="form-check-label">{p}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-md-2 d-flex align-items-end mb-3"><button className="btn btn-success w-100">{edit ? 'Atualizar' : 'Salvar'}</button></div>
        </div>
      </form>

      <div className="card card-soft table-card">
        <table className="table table-hover">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>MotoristaId</th><th>Status</th><th>Permissões</th><th></th></tr></thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id}>
                <td>{x.nome}</td>
                <td>{x.email}</td>
                <td>{chipPerfil(x.perfil)}</td>
                <td>{x.motoristaId || '-'}</td>
                <td><span className={`chip ${x.ativo ? 'chip-success' : 'chip-danger'}`}>{x.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td><span className="badge-soft">{x.permissoes?.length || 0}</span></td>
                <td>
                  <button className="btn btn-sm btn-warning" onClick={() => {
                    setEdit(x.id);
                    setForm({ nome: x.nome || '', email: x.email || '', senha: '', perfil: x.perfil, motoristaId: x.motoristaId || '', ativo: x.ativo, permissoes: x.permissoes || [] });
                  }}>Editar</button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr><td colSpan="7" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
