import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, CalendarClock, ClipboardList, Download, Eye, Filter, Paperclip, Plus, RotateCcw, Search, Trash2, Wrench } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { Select } from '../components/Forms/Select';
import { FiltrosSalvos } from '../components/Forms/FiltrosSalvos';
import { Metric } from '../components/Dashboard/Metric';
import { EmptyState } from '../components/UI/EmptyState';
import { manutencaoService } from '../services/manutencaoService';
import { veiculoService } from '../services/veiculoService';
import { getUser } from '../utils/permissions';
import { money, number } from '../utils/formatters';
import { exportarCsv } from '../utils/exportCsv';
import { dataBrasil, dataInputBrasil } from '../utils/dataBrasil';

const hoje = dataInputBrasil();

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

const itemMensalInicial = { item: '', observacao: '' };

function formatDate(value) {
  return dataBrasil(value);
}

function statusClass(status) {
  if (status === 'Vencida') return 'chip chip-danger';
  if (status === 'Proxima' || status === 'Próxima') return 'chip chip-warn';
  return 'chip chip-success';
}

export function Manutencoes() {
  const [searchParams] = useSearchParams();
  const user = getUser();
  const podeGerenciar = user?.permissoes?.includes('Manutencoes.Gerenciar');

  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [aba, setAba] = useState('registrar');
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });
  const [form, setForm] = useState(initialForm);
  const [itensMensais, setItensMensais] = useState([{ ...itemMensalInicial }]);
  const [anexo, setAnexo] = useState(null);
  const [edit, setEdit] = useState(null);
  const [filtro, setFiltro] = useState({
    veiculoId: '',
    status: ''
  });

  useEffect(() => {
    const veiculoId = searchParams.get('veiculoId') || '';
    const status = searchParams.get('status') || '';
    const abaUrl = searchParams.get('aba');

    if (abaUrl === 'consultar' || abaUrl === 'registrar') setAba(abaUrl);
    if (veiculoId || status) {
      setFiltro(f => ({ ...f, veiculoId: veiculoId || f.veiculoId, status: status || f.status }));
      setForm(f => ({ ...f, veiculoId: veiculoId || f.veiculoId }));
    }
  }, [searchParams]);

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
      toast.warning('Você não tem permissão para gerenciar manutenções.');
      return;
    }

    const payload = new FormData();
    payload.append('veiculoId', Number(form.veiculoId));
    payload.append('tipo', form.tipo);
    payload.append('dataManutencao', form.dataManutencao);
    payload.append('kmManutencao', Number(form.kmManutencao));
    payload.append('descricao', form.descricao || '');
    payload.append('custo', form.custo === '' ? '' : String(form.custo).replace(',', '.'));
    payload.append('proximaManutencaoKm', form.proximaManutencaoKm === '' ? '' : Number(form.proximaManutencaoKm));
    payload.append('proximaManutencaoData', form.proximaManutencaoData || '');
    if (anexo) payload.append('anexo', anexo);

    try {
      if (edit) {
        await manutencaoService.atualizar(edit, payload);
        toast.success('Manutenção atualizada.');
      } else {
        await manutencaoService.criar(payload);
        toast.success('Manutenção cadastrada.');
      }

      setForm(initialForm);
      setAnexo(null);
      setEdit(null);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar manutencao.');
    }
  }

  function proximaDataMensal(dataBase) {
    const data = new Date(`${dataBase || hoje}T12:00:00`);
    data.setMonth(data.getMonth() + 1);
    return data.toISOString().slice(0, 10);
  }

  async function salvarChecklistMensal() {
    if (!podeGerenciar) {
      toast.warning('Você não tem permissão para gerenciar manutenções.');
      return;
    }

    if (!form.veiculoId) return toast.warning('Selecione um veiculo.');

    const veiculo = veiculos.find(x => String(x.id) === String(form.veiculoId));
    const itensValidos = itensMensais.filter(x => x.item.trim());

    if (itensValidos.length === 0) return toast.warning('Informe ao menos um item da revisao mensal.');

    try {
      await Promise.all(itensValidos.map(item => {
        const payload = new FormData();
        payload.append('veiculoId', Number(form.veiculoId));
        payload.append('tipo', `Revisao mensal - ${item.item.trim()}`);
        payload.append('dataManutencao', form.dataManutencao || hoje);
        payload.append('kmManutencao', Number(form.kmManutencao || veiculo?.kmAtual || 0));
        payload.append('descricao', item.observacao?.trim() || '');
        payload.append('custo', '');
        payload.append('proximaManutencaoKm', '');
        payload.append('proximaManutencaoData', proximaDataMensal(form.dataManutencao));
        return manutencaoService.criar(payload);
      }));

      toast.success('Itens mensais cadastrados e alerta criado.');
      setItensMensais([{ ...itemMensalInicial }]);
      setAba('consultar');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao cadastrar itens mensais.');
    }
  }

  function atualizarItemMensal(index, campo, valor) {
    setItensMensais(lista => lista.map((item, i) => i === index ? { ...item, [campo]: valor } : item));
  }

  function adicionarItemMensal() {
    setItensMensais(lista => [...lista, { ...itemMensalInicial }]);
  }

  function removerItemMensal(index) {
    setItensMensais(lista => lista.length === 1 ? lista : lista.filter((_, i) => i !== index));
  }

  async function remover(id) {
    if (!confirm('Remover manutenção?')) return;

    try {
      await manutencaoService.remover(id);
      toast.success('Manutenção removida.');
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
    setAnexo(null);
    setAba('registrar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEdit(null);
    setForm(initialForm);
    setAnexo(null);
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

  function exportar() {
    exportarCsv('manutencoes', [
      { label: 'Veículo', value: x => `${x.veiculo?.modelo || ''} - ${x.veiculo?.placa || ''}` },
      { label: 'Tipo', value: 'tipo' },
      { label: 'Data', value: x => formatDate(x.dataManutencao) },
      { label: 'KM', value: x => number(x.kmManutencao) },
      { label: 'Custo', value: x => x.custo ? money(x.custo) : '' },
      { label: 'Próximo KM', value: x => x.proximaManutencaoKm ? number(x.proximaManutencaoKm) : '' },
      { label: 'Próxima data', value: x => formatDate(x.proximaManutencaoData) },
      { label: 'Anexo', value: x => x.temAnexo ? (x.anexoNome || 'Sim') : '' }
    ], itemsFiltrados);
  }

  async function abrirAnexo(item) {
    try {
      const resp = await manutencaoService.anexo(item.id);
      const url = URL.createObjectURL(resp.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error('Erro ao abrir anexo.');
    }
  }

  return (
    <>
      <Header
        title="Manutenções"
        subtitle={aba === 'registrar' ? 'Registre manutenções e próximos vencimentos' : 'Consulte manutenções, filtros e alertas'}
        actions={edit && aba === 'registrar' && (
          <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>Cancelar edição</button>
        )}
      />

      <div className="row g-3 mb-3">
        <Metric title="Alertas próximos" value={totalAlertas.proximas} icon={<CalendarClock size={20} />} cor="#f8e000" />
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
            <>
            <form className="card card-soft p-3 mb-3" onSubmit={save}>
              <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={17} /> {edit ? 'Editar manutenção' : 'Registrar manutenção'}
              </h5>

              <div className="row">
                <Select
                  label="Veículo"
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
                  label="KM manutenção"
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
                  label="Próxima em KM"
                  type="number"
                  value={form.proximaManutencaoKm}
                  onChange={v => setForm({ ...form, proximaManutencaoKm: v })}
                />

                <Input
                  label="Próxima data"
                  type="date"
                  value={form.proximaManutencaoData}
                  onChange={v => setForm({ ...form, proximaManutencaoData: v })}
                />

                <div className="col-md-12 mb-3">
                  <label>Descrição</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={form.descricao}
                    onChange={e => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>

                <div className="col-md-12 mb-3">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Paperclip size={14} /> Anexo
                  </label>
                  <input
                    className="form-control"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setAnexo(e.target.files?.[0] || null)}
                  />
                  {edit && <small className="text-muted d-block mt-1">Envie um novo arquivo somente se quiser substituir o anexo atual.</small>}
                </div>
              </div>

              <div>
                <button className="btn btn-success me-2">
                  {edit ? 'Atualizar manutenção' : 'Salvar manutenção'}
                </button>

                {edit && (
                  <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
            <div className="card card-soft p-3 mb-3">
              <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={17} /> Itens da revisão mensal
              </h5>

              <div className="row">
                <Select
                  label="Veículo"
                  value={form.veiculoId}
                  onChange={v => setForm({ ...form, veiculoId: v })}
                  items={veiculos}
                  text={x => `${x.modelo} - ${x.placa} | KM ${number(x.kmAtual)}`}
                />

                <Input
                  label="Data da revisão"
                  type="date"
                  value={form.dataManutencao}
                  onChange={v => setForm({ ...form, dataManutencao: v })}
                />

                <Input
                  label="KM atual"
                  type="number"
                  value={form.kmManutencao}
                  onChange={v => setForm({ ...form, kmManutencao: v })}
                />
              </div>

              {itensMensais.map((item, index) => (
                <div key={index} className="row align-items-end">
                  <div className="col-md-4 mb-2">
                    <label>Item</label>
                    <input
                      className="form-control"
                      placeholder="Ex: pneus, oleo, luzes, freios"
                      value={item.item}
                      onChange={e => atualizarItemMensal(index, 'item', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label>Observação</label>
                    <input
                      className="form-control"
                      placeholder="Observação do item revisado"
                      value={item.observacao}
                      onChange={e => atualizarItemMensal(index, 'observacao', e.target.value)}
                    />
                  </div>
                  <div className="col-md-2 mb-2">
                    <button
                      type="button"
                      className="btn btn-outline-danger w-100"
                      onClick={() => removerItemMensal(index)}
                      disabled={itensMensais.length === 1}
                    >
                      <Trash2 size={14} /> Remover
                    </button>
                  </div>
                </div>
              ))}

              <div className="d-flex gap-2 mt-2">
                <button type="button" className="btn btn-outline-primary" onClick={adicionarItemMensal}>
                  <Plus size={14} /> Adicionar item
                </button>
                <button type="button" className="btn btn-success" onClick={salvarChecklistMensal}>
                  Criar alerta mensal
                </button>
              </div>
            </div>
            </>
          ) : (
            <div className="card card-soft p-3 mb-3">
              <p className="text-muted" style={{ margin: 0 }}>Você não tem permissão para registrar manutenções.</p>
            </div>
          )}
        </>
      )}

      {aba === 'consultar' && (
        <>
          {alertas.length > 0 && (
            <div className="card card-soft table-card mb-3">
              <div className="card-body">
                <h5>Alertas de manutenção</h5>
              </div>

              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Veículo</th>
                    <th>Tipo</th>
                    <th>KM atual</th>
                    <th>Próximo KM</th>
                    <th>KM restante</th>
                    <th>Próxima data</th>
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
                label="Veículo"
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
                  <option value="Próxima">Próxima</option>
                  <option value="Vencida">Vencida</option>
                </select>
              </div>

              <Input label="De" type="date" value={periodo.de} onChange={v => setPeriodo({ ...periodo, de: v })} />
              <Input label="Ate" type="date" value={periodo.ate} onChange={v => setPeriodo({ ...periodo, ate: v })} />

              <div className="col-md-12 mb-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Buscar</label>
                <input
                  className="form-control"
                  placeholder="Veículo, placa, tipo ou descrição"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              <FiltrosSalvos
                storageKey="filtros-manutencoes"
                value={{ busca, filtro, periodo }}
                onApply={v => {
                  setBusca(v.busca || '');
                  setFiltro(v.filtro || { veiculoId: '', status: '' });
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
              <ClipboardList size={14} /> Exibindo {itemsFiltrados.length} de {items.length} manutencao(oes).
              Veículo e status filtram no servidor; busca e datas refinam a lista carregada.
            </small>
          </div>

          <div className="card card-soft table-card">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>KM</th>
                  <th>Custo</th>
                  <th>Próximo KM</th>
                  <th>Próxima data</th>
                  <th>Anexo</th>
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
                      {x.temAnexo ? (
                        <button className="btn btn-sm btn-outline-primary" onClick={() => abrirAnexo(x)}>
                          <Eye size={14} /> Ver
                        </button>
                      ) : '-'}
                    </td>
                    <td>
                      <div className="table-actions">
                      {podeGerenciar && (
                        <>
                          <button className="btn btn-sm btn-warning" onClick={() => editar(x)}>
                            Editar
                          </button>

                          <button className="btn btn-sm btn-danger" onClick={() => remover(x.id)}>
                            Remover
                          </button>
                        </>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}

                {itemsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="9">
                      <EmptyState
                        title="Nenhuma manutenção encontrada"
                        description="Revise os filtros ou registre uma nova manutenção."
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
