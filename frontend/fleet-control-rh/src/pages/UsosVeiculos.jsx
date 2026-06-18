import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ClipboardList, Download, Edit3, Filter, KeyRound, PlayCircle, RotateCcw, Search, StopCircle } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { Select } from '../components/Forms/Select';
import { FiltrosSalvos } from '../components/Forms/FiltrosSalvos';
import { EmptyState } from '../components/UI/EmptyState';
import { usoVeiculoService } from '../services/usoVeiculoService';
import { veiculoService } from '../services/veiculoService';
import { motoristaService } from '../services/motoristaService';
import { getUser, temPermissao } from '../utils/permissions';
import { dataHora, number } from '../utils/formatters';
import { exportarCsv } from '../utils/exportCsv';

const initialForm = {
  veiculoId: '',
  motoristaId: '',
  kmInicial: '',
  observacaoInicio: ''
};

const initialFinalizar = {
  usoId: null,
  kmFinal: '',
  observacaoFim: ''
};

const initialEditForm = {
  veiculoId: '',
  motoristaId: '',
  kmInicial: '',
  kmFinal: '',
  observacaoInicio: '',
  observacaoFim: '',
  status: null
};

function formatDate(value) {
  return dataHora(value);
}

function formatTempo(minutos) {
  if (minutos === null || minutos === undefined) return '-';

  const total = Math.round(Number(minutos));
  const horas = Math.floor(total / 60);
  const mins = total % 60;

  if (horas <= 0) return `${mins} min`;

  return `${horas}h ${mins}min`;
}

function emUso(status) {
  return status === 1 || status === 'EmUso';
}

function finalizado(status) {
  return status === 2 || status === 'Finalizado';
}

export function UsosVeiculos() {
  const user = getUser();

  const [items, setItems] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [veiculosDisponiveis, setVeiculosDisponiveis] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [aba, setAba] = useState('registrar');
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });
  const [form, setForm] = useState(initialForm);
  const [finalizar, setFinalizar] = useState(initialFinalizar);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [filtro, setFiltro] = useState({
    veiculoId: '',
    motoristaId: '',
    somenteAtivos: false
  });

  const usuarioTecnico = user?.perfil === 3 || user?.perfil === 'Tecnico';
  const podeEditar = user?.perfil === 1 || user?.perfil === 2 || temPermissao('UsosVeiculos.Editar');

  const usosAtivos = useMemo(
    () => items.filter(x => emUso(x.status)),
    [items]
  );

  const itemsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return items.filter(x => {
      if (q) {
        const alvo = `${x.veiculo?.modelo || ''} ${x.veiculo?.placa || ''} ${x.motorista?.nome || ''} ${x.observacaoInicio || ''} ${x.observacaoFim || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }

      if (periodo.de || periodo.ate) {
        const dia = String(x.dataInicio || '').slice(0, 10);
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
      motoristaId: f.motoristaId || undefined,
      somenteAtivos: f.somenteAtivos || undefined
    };

    const [usosRes, veiculosRes, disponiveisRes, motoristasRes] = await Promise.all([
      usoVeiculoService.listar(params),
      veiculoService.listar(),
      usoVeiculoService.veiculosDisponiveis(),
      motoristaService.listar()
    ]);

    setItems(usosRes.data);
    setVeiculos(veiculosRes.data);
    setVeiculosDisponiveis(disponiveisRes.data);
    setMotoristas(motoristasRes.data);
  }

  useEffect(() => {
    load({
      veiculoId: '',
      motoristaId: '',
      somenteAtivos: false
    }).catch(() => toast.error('Erro ao carregar uso de veiculos.'));
  }, []);

  async function iniciarUso(e) {
    e.preventDefault();

    try {
      const payload = {
        veiculoId: Number(form.veiculoId),
        motoristaId: usuarioTecnico
          ? Number(user?.motoristaId || 0)
          : Number(form.motoristaId),
        kmInicial: Number(form.kmInicial),
        observacaoInicio: form.observacaoInicio
      };

      await usoVeiculoService.iniciar(payload);

      toast.success('Uso do veiculo iniciado.');
      setForm(initialForm);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao iniciar uso do veiculo.');
    }
  }

  async function finalizarUso(e) {
    e.preventDefault();

    if (!finalizar.usoId) {
      toast.warning('Selecione um uso ativo para finalizar.');
      return;
    }

    try {
      await usoVeiculoService.finalizar(finalizar.usoId, {
        kmFinal: Number(finalizar.kmFinal),
        observacaoFim: finalizar.observacaoFim
      });

      toast.success('Uso do veiculo finalizado.');
      setFinalizar(initialFinalizar);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao finalizar uso do veiculo.');
    }
  }

  function abrirEdicao(uso) {
    setEditandoId(uso.id);
    setEditForm({
      veiculoId: uso.veiculoId || '',
      motoristaId: uso.motoristaId || '',
      kmInicial: uso.kmInicial ?? '',
      kmFinal: uso.kmFinal ?? '',
      observacaoInicio: uso.observacaoInicio || '',
      observacaoFim: uso.observacaoFim || '',
      status: uso.status
    });

    setAba('registrar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEditForm(initialEditForm);
  }

  async function salvarEdicao(e) {
    e.preventDefault();

    if (!editandoId) return;

    try {
      await usoVeiculoService.editar(editandoId, {
        veiculoId: Number(editForm.veiculoId),
        motoristaId: usuarioTecnico
          ? Number(user?.motoristaId || 0)
          : Number(editForm.motoristaId),
        kmInicial: Number(editForm.kmInicial),
        kmFinal: editForm.kmFinal === '' ? null : Number(editForm.kmFinal),
        observacaoInicio: editForm.observacaoInicio,
        observacaoFim: editForm.observacaoFim
      });

      toast.success('Uso do veiculo atualizado.');

      cancelarEdicao();
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao atualizar uso do veiculo.');
    }
  }

  function aplicarFiltro() {
    setAba('consultar');
    load(filtro).catch(() => toast.error('Erro ao filtrar usos de veiculos.'));
  }

  function limparConsulta() {
    const novo = { veiculoId: '', motoristaId: '', somenteAtivos: false };
    setFiltro(novo);
    setBusca('');
    setPeriodo({ de: '', ate: '' });
    load(novo).catch(() => toast.error('Erro ao carregar uso de veiculos.'));
  }

  function exportar() {
    exportarCsv('uso-veiculos', [
      { label: 'Status', value: x => emUso(x.status) ? 'Em uso' : 'Finalizado' },
      { label: 'Veículo', value: x => `${x.veiculo?.modelo || ''} - ${x.veiculo?.placa || ''}` },
      { label: 'Técnico', value: x => x.motorista?.nome || '' },
      { label: 'Inicio', value: x => formatDate(x.dataInicio) },
      { label: 'Fim', value: x => formatDate(x.dataFim) },
      { label: 'Tempo', value: x => formatTempo(x.tempoUsoMinutos) },
      { label: 'KM inicial', value: x => number(x.kmInicial) },
      { label: 'KM final', value: x => x.kmFinal ? number(x.kmFinal) : '' },
      { label: 'KM rodado', value: x => x.kmFinal ? number(x.kmFinal - x.kmInicial) : '' }
    ], itemsFiltrados);
  }

  return (
    <>
      <Header
        title="Uso de Veículos"
        subtitle={aba === 'registrar' ? 'Inicie, finalize ou edite o uso da frota' : 'Consulte disponibilidade, bloqueio e tempo de uso'}
        actions={editandoId && aba === 'registrar'
          ? <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>Cancelar edição</button>
          : <span className="badge-soft">{usosAtivos.length} em uso</span>}
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
          <div className="row">
            <div className="col-lg-6">
              <form className="card card-soft p-3 mb-3" onSubmit={iniciarUso}>
                <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PlayCircle size={17} /> Iniciar uso</h5>

                <div className="row">
                  <Select
                    label="Veículo disponível"
                    value={form.veiculoId}
                    onChange={v => setForm({ ...form, veiculoId: v })}
                    items={veiculosDisponiveis}
                    text={x => `${x.modelo} - ${x.placa} | KM ${number(x.kmAtual)}`}
                  />

                  {!usuarioTecnico && (
                    <Select
                      label="Motorista/Técnico"
                      value={form.motoristaId}
                      onChange={v => setForm({ ...form, motoristaId: v })}
                      items={motoristas}
                      text={x => x.nome}
                    />
                  )}

                  <Input
                    label="KM inicial"
                    type="number"
                    value={form.kmInicial}
                    onChange={v => setForm({ ...form, kmInicial: v })}
                  />

                  <div className="col-md-12 mb-3">
                    <label>Observação de início</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={form.observacaoInicio}
                      onChange={e => setForm({ ...form, observacaoInicio: e.target.value })}
                    />
                  </div>
                </div>

                <button className="btn btn-success">Iniciar uso do veículo</button>
              </form>
            </div>

            <div className="col-lg-6">
              <form className="card card-soft p-3 mb-3" onSubmit={finalizarUso}>
                <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StopCircle size={17} /> Finalizar uso</h5>

                <div className="row">
                  <Select
                    label="Uso ativo"
                    value={finalizar.usoId || ''}
                    onChange={v => setFinalizar({ ...finalizar, usoId: v })}
                    items={usosAtivos}
                    text={x => `${x.veiculo?.placa || ''} - ${x.motorista?.nome || ''} | Inicio ${formatDate(x.dataInicio)}`}
                  />

                  <Input
                    label="KM final"
                    type="number"
                    value={finalizar.kmFinal}
                    onChange={v => setFinalizar({ ...finalizar, kmFinal: v })}
                  />

                  <div className="col-md-12 mb-3">
                    <label>Observação de fim</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={finalizar.observacaoFim}
                      onChange={e => setFinalizar({ ...finalizar, observacaoFim: e.target.value })}
                    />
                  </div>
                </div>

                <button className="btn btn-primary">Finalizar uso</button>
              </form>
            </div>
          </div>

          {editandoId && (
            <form className="card card-soft p-3 mb-3" onSubmit={salvarEdicao}>
              <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={17} /> Editar uso
              </h5>

              <div className="row">
                <Select
                  label="Veículo"
                  value={editForm.veiculoId}
                  onChange={v => setEditForm({ ...editForm, veiculoId: v })}
                  items={veiculos}
                  text={x => `${x.modelo} - ${x.placa} | KM ${number(x.kmAtual)}`}
                />

                {!usuarioTecnico && (
                  <Select
                    label="Motorista/Técnico"
                    value={editForm.motoristaId}
                    onChange={v => setEditForm({ ...editForm, motoristaId: v })}
                    items={motoristas}
                    text={x => x.nome}
                  />
                )}

                <Input
                  label="KM inicial"
                  type="number"
                  value={editForm.kmInicial}
                  onChange={v => setEditForm({ ...editForm, kmInicial: v })}
                />

                {finalizado(editForm.status) && (
                  <Input
                    label="KM final"
                    type="number"
                    value={editForm.kmFinal}
                    onChange={v => setEditForm({ ...editForm, kmFinal: v })}
                  />
                )}

                <div className="col-md-6 mb-3">
                  <label>Observação de início</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={editForm.observacaoInicio}
                    onChange={e => setEditForm({ ...editForm, observacaoInicio: e.target.value })}
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label>Observação de fim</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={editForm.observacaoFim}
                    onChange={e => setEditForm({ ...editForm, observacaoFim: e.target.value })}
                  />
                </div>

                <div className="col-md-3 d-flex align-items-end mb-3">
                  <button className="btn btn-success w-100">Atualizar uso</button>
                </div>

                <div className="col-md-3 d-flex align-items-end mb-3">
                  <button type="button" className="btn btn-outline-secondary w-100" onClick={cancelarEdicao}>Cancelar</button>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {aba === 'consultar' && (
        <>
          <div className="card card-soft p-3 mb-3">
            <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><KeyRound size={17} /> Filtros</h5>

            <div className="row">
              <Select
                label="Veículo"
                value={filtro.veiculoId}
                onChange={v => setFiltro({ ...filtro, veiculoId: v })}
                items={veiculos}
                text={x => `${x.modelo} - ${x.placa}`}
              />

              {!usuarioTecnico && (
                <Select
                  label="Motorista/Tecnico"
                  value={filtro.motoristaId}
                  onChange={v => setFiltro({ ...filtro, motoristaId: v })}
                  items={motoristas}
                  text={x => x.nome}
                />
              )}

              <Input label="De" type="date" value={periodo.de} onChange={v => setPeriodo({ ...periodo, de: v })} />
              <Input label="Ate" type="date" value={periodo.ate} onChange={v => setPeriodo({ ...periodo, ate: v })} />

              <div className="col-md-3 mb-3 d-flex align-items-end">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={filtro.somenteAtivos}
                    onChange={e => setFiltro({ ...filtro, somenteAtivos: e.target.checked })}
                    id="somenteAtivos"
                  />
                  <label className="form-check-label" htmlFor="somenteAtivos">
                    Somente em uso
                  </label>
                </div>
              </div>

              <div className="col-md-12 mb-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Buscar</label>
                <input
                  className="form-control"
                  placeholder="Placa, modelo, técnico ou observação"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              <FiltrosSalvos
                storageKey="filtros-usos-veiculos"
                value={{ busca, filtro, periodo }}
                onApply={v => {
                  setBusca(v.busca || '');
                  setFiltro(v.filtro || { veiculoId: '', motoristaId: '', somenteAtivos: false });
                  setPeriodo(v.periodo || { de: '', ate: '' });
                }}
              />

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

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-success w-100" onClick={exportar}>
                  <Download size={16} /> Exportar
                </button>
              </div>
            </div>

            <small className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardList size={14} /> Exibindo {itemsFiltrados.length} de {items.length} uso(s).
              Veículo, motorista e ativos filtram no servidor; busca e datas refinam a lista carregada.
            </small>
          </div>

          <div className="card card-soft table-card">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Veículo</th>
                  <th>Técnico</th>
                  <th>Inicio</th>
                  <th>Fim</th>
                  <th>Tempo</th>
                  <th>KM inicial</th>
                  <th>KM final</th>
                  <th>KM rodado</th>
                  {podeEditar && <th width="100"></th>}
                </tr>
              </thead>

              <tbody>
                {itemsFiltrados.map(x => (
                  <tr key={x.id}>
                    <td>
                      <span className={emUso(x.status) ? 'badge bg-warning text-dark' : 'badge bg-success'}>
                        {emUso(x.status) ? 'Em uso' : 'Finalizado'}
                      </span>
                    </td>
                    <td>{x.veiculo?.modelo} - {x.veiculo?.placa}</td>
                    <td>{x.motorista?.nome}</td>
                    <td>{formatDate(x.dataInicio)}</td>
                    <td>{formatDate(x.dataFim)}</td>
                    <td>{formatTempo(x.tempoUsoMinutos)}</td>
                    <td>{number(x.kmInicial)}</td>
                    <td>{x.kmFinal ? number(x.kmFinal) : '-'}</td>
                    <td>{x.kmFinal ? number(x.kmFinal - x.kmInicial) : '-'}</td>
                    {podeEditar && (
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-sm btn-warning" onClick={() => abrirEdicao(x)}>Editar</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {itemsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={podeEditar ? 10 : 9}>
                      <EmptyState
                        title="Nenhum uso encontrado"
                        description="Ajuste os filtros ou registre uma nova utilização da frota."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
