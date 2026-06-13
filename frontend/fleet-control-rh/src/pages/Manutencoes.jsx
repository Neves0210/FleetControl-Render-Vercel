import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, CalendarClock, ClipboardList, Filter, RotateCcw, Search, Wrench } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { Select } from '../components/Forms/Select';
import { Metric } from '../components/Dashboard/Metric';
import { manutencaoService } from '../services/manutencaoService';
import { veiculoService } from '../services/veiculoService';
import { getUser } from '../utils/permissions';
import { money, number } from '../utils/formatters';

const hoje = new Date().toISOString().slice(0, 10);

const initialForm = {
  veiculoId: '',
  tipo: '',
  dataManutencao: hoje,
  kmManutencao: '',
  descricao: '',
  custo: '',
  proximaManutencaoKm: '',
  proximaManutencaoData: ''
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function statusClass(status) {
  if (status === 'Vencida') return 'chip chip-danger';
  if (status === 'Proxima' || status === 'Próxima') return 'chip chip-warn';
  return 'chip chip-success';
}

export function Manutencoes() {
  const user = getUser();
  const podeGerenciar = user?.permissoes?.includes('Manutencoes.Gerenciar');

  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [aba, setAba] = useState('registrar');
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);
  const [filtro, setFiltro] = useState({
    veiculoId: '',
    status: ''
  });

  const totalAlertas = useMemo(() => ({
    proximas: alertas.filter(x => x.status === 'Próxima' || x.status === 'Proxima').length,
    vencidas: alertas.filter(x => x.status === 'Vencida').length
  }), [alertas]);

  const itemsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return items.filter(x => {
      if (q) {
        const alvo = `${x.veiculo?.modelo || ''} ${x.veiculo?.placa || ''} ${x.tipo || ''} ${x.descricao || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }

      if (periodo.de || periodo.ate) {
        const dia = String(x.dataManutencao || '').slice(0, 10);
        if (!dia) return false;
        if (periodo.de && dia < periodo.de) return false;
        if (periodo.ate && dia > periodo.ate) return false;
      }

      return true;
    });
  }, [items, busca, periodo]);

  async function load(f = filtro) {
    const params = {
      veiculoId: f.veiculoId || undefined,
      status: f.status || undefined
    };

    const [manutencoesRes, alertasRes, veiculosRes] = await Promise.all([
      manutencaoService.listar(params),
      manutencaoService.alertas(),
      veiculoService.listar()
    ]);

    setItems(manutencoesRes.data);
    setAlertas(alertasRes.data);
    setVeiculos(veiculosRes.data);
  }

  useEffect(() => {
    load({ veiculoId: '', status: '' }).catch(() => toast.error('Erro ao carregar manutencoes.'));
  }, []);

  async function save(e) {
    e.preventDefault();

    if (!podeGerenciar) {
      toast.warning('Voce nao tem permissao para gerenciar manutencoes.');
      return;
    }

    const payload = {
      veiculoId: Number(form.veiculoId),
      tipo: form.tipo,
      dataManutencao: form.dataManutencao,
      kmManutencao: Number(form.kmManutencao),
      descricao: form.descricao,
      custo: form.custo === '' ? null : Number(String(form.custo).replace(',', '.')),
      proximaManutencaoKm: form.proximaManutencaoKm === '' ? null : Number(form.proximaManutencaoKm),
      proximaManutencaoData: form.proximaManutencaoData || null
    };

    try {
      if (edit) {
        await manutencaoService.atualizar(edit, payload);
        toast.success('Manutencao atualizada.');
      } else {
        await manutencaoService.criar(payload);
        toast.success('Manutencao cadastrada.');
      }

      setForm(initialForm);
      setEdit(null);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar manutencao.');
    }
  }

  async function remover(id) {
    if (!confirm('Remover manutencao?')) return;

    try {
      await manutencaoService.remover(id);
      toast.success('Manutencao removida.');
      await load();
    } catch {
      toast.error('Erro ao remover manutencao.');
    }
  }

  function editar(item) {
    setEdit(item.id);
    setForm({
      veiculoId: item.veiculoId,
      tipo: item.tipo || '',
      dataManutencao: item.dataManutencao?.substring(0, 10) || hoje,
      kmManutencao: item.kmManutencao || '',
      descricao: item.descricao || '',
      custo: item.custo ?? '',
      proximaManutencaoKm: item.proximaManutencaoKm ?? '',
      proximaManutencaoData: item.proximaManutencaoData?.substring(0, 10) || ''
    });
    setAba('registrar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEdit(null);
    setForm(initialForm);
  }

  function aplicarFiltro() {
    setAba('consultar');
    load(filtro).catch(() => toast.error('Erro ao filtrar manutencoes.'));
  }

  function limparConsulta() {
    const novo = { veiculoId: '', status: '' };
    setFiltro(novo);
    setBusca('');
    setPeriodo({ de: '', ate: '' });
    load(novo).catch(() => toast.error('Erro ao carregar manutencoes.'));
  }

  return (
    <>
      <Header
        title="Manutencoes"
        subtitle={aba === 'registrar' ? 'Registre manutencoes e proximos vencimentos' : 'Consulte manutencoes, filtros e alertas'}
        actions={edit && aba === 'registrar' && (
          <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>Cancelar edicao</button>
        )}
      />

      <div className="row g-3 mb-3">
        <Metric title="Alertas proximos" value={totalAlertas.proximas} icon={<CalendarClock size={20} />} cor="#d97706" />
        <Metric title="Alertas vencidos" value={totalAlertas.vencidas} icon={<AlertTriangle size={20} />} cor="#dc2626" />
      </div>

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
          {podeGerenciar ? (
            <form className="card card-soft p-3 mb-3" onSubmit={save}>
              <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={17} /> {edit ? 'Editar manutencao' : 'Registrar manutencao'}
              </h5>

              <div className="row">
                <Select
                  label="Veiculo"
                  value={form.veiculoId}
                  onChange={v => setForm({ ...form, veiculoId: v })}
                  items={veiculos}
                  text={x => `${x.modelo} - ${x.placa} | KM ${number(x.kmAtual)}`}
                />

                <Input
                  label="Tipo"
                  value={form.tipo}
                  onChange={v => setForm({ ...form, tipo: v })}
                />

                <Input
                  label="Data"
                  type="date"
                  value={form.dataManutencao}
                  onChange={v => setForm({ ...form, dataManutencao: v })}
                />

                <Input
                  label="KM manutencao"
                  type="number"
                  value={form.kmManutencao}
                  onChange={v => setForm({ ...form, kmManutencao: v })}
                />

                <Input
                  label="Custo"
                  value={form.custo}
                  onChange={v => setForm({ ...form, custo: v })}
                />

                <Input
                  label="Proxima em KM"
                  type="number"
                  value={form.proximaManutencaoKm}
                  onChange={v => setForm({ ...form, proximaManutencaoKm: v })}
                />

                <Input
                  label="Proxima data"
                  type="date"
                  value={form.proximaManutencaoData}
                  onChange={v => setForm({ ...form, proximaManutencaoData: v })}
                />

                <div className="col-md-12 mb-3">
                  <label>Descricao</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={form.descricao}
                    onChange={e => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <button className="btn btn-success me-2">
                  {edit ? 'Atualizar manutencao' : 'Salvar manutencao'}
                </button>

                {edit && (
                  <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>
                    Cancelar edicao
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="card card-soft p-3 mb-3">
              <p className="text-muted" style={{ margin: 0 }}>Voce nao tem permissao para registrar manutencoes.</p>
            </div>
          )}
        </>
      )}

      {aba === 'consultar' && (
        <>
          {alertas.length > 0 && (
            <div className="card card-soft table-card mb-3">
              <div className="card-body">
                <h5>Alertas de manutencao</h5>
              </div>

              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Veiculo</th>
                    <th>Tipo</th>
                    <th>KM atual</th>
                    <th>Proximo KM</th>
                    <th>KM restante</th>
                    <th>Proxima data</th>
                    <th>Dias restantes</th>
                  </tr>
                </thead>

                <tbody>
                  {alertas.map(x => (
                    <tr key={x.manutencaoId}>
                      <td><span className={statusClass(x.status)}>{x.status}</span></td>
                      <td>{x.veiculo} - {x.placa}</td>
                      <td>{x.tipo}</td>
                      <td>{number(x.kmAtual)}</td>
                      <td>{x.proximaManutencaoKm ? number(x.proximaManutencaoKm) : '-'}</td>
                      <td>{x.kmRestante ?? '-'}</td>
                      <td>{formatDate(x.proximaManutencaoData)}</td>
                      <td>{x.diasRestantes ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card card-soft p-3 mb-3">
            <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Filter size={17} /> Filtros
            </h5>

            <div className="row">
              <Select
                label="Veiculo"
                value={filtro.veiculoId}
                onChange={v => setFiltro({ ...filtro, veiculoId: v })}
                items={veiculos}
                text={x => `${x.modelo} - ${x.placa}`}
              />

              <div className="col-md-3 mb-3">
                <label>Status</label>
                <select
                  className="form-select"
                  value={filtro.status}
                  onChange={e => setFiltro({ ...filtro, status: e.target.value })}
                >
                  <option value="">Todos</option>
                  <option value="Em dia">Em dia</option>
                  <option value="PrÃ³xima">Proxima</option>
                  <option value="Vencida">Vencida</option>
                </select>
              </div>

              <Input label="De" type="date" value={periodo.de} onChange={v => setPeriodo({ ...periodo, de: v })} />
              <Input label="Ate" type="date" value={periodo.ate} onChange={v => setPeriodo({ ...periodo, ate: v })} />

              <div className="col-md-12 mb-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Buscar</label>
                <input
                  className="form-control"
                  placeholder="Veiculo, placa, tipo ou descricao"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-primary w-100" onClick={aplicarFiltro}>
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
              <ClipboardList size={14} /> Exibindo {itemsFiltrados.length} de {items.length} manutencao(oes).
              Veiculo e status filtram no servidor; busca e datas refinam a lista carregada.
            </small>
          </div>

          <div className="card card-soft table-card">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Veiculo</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>KM</th>
                  <th>Custo</th>
                  <th>Proximo KM</th>
                  <th>Proxima data</th>
                  <th width="180"></th>
                </tr>
              </thead>

              <tbody>
                {itemsFiltrados.map(x => (
                  <tr key={x.id}>
                    <td>{x.veiculo?.modelo} - {x.veiculo?.placa}</td>
                    <td>{x.tipo}</td>
                    <td>{formatDate(x.dataManutencao)}</td>
                    <td>{number(x.kmManutencao)}</td>
                    <td>{x.custo ? money(x.custo) : '-'}</td>
                    <td>{x.proximaManutencaoKm ? number(x.proximaManutencaoKm) : '-'}</td>
                    <td>{formatDate(x.proximaManutencaoData)}</td>
                    <td>
                      {podeGerenciar && (
                        <>
                          <button className="btn btn-sm btn-warning me-2" onClick={() => editar(x)}>
                            Editar
                          </button>

                          <button className="btn btn-sm btn-danger" onClick={() => remover(x.id)}>
                            Remover
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}

                {itemsFiltrados.length === 0 && (
                  <tr><td colSpan="8" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhuma manutencao encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
