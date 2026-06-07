import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Wrench, AlertTriangle, CalendarClock } from 'lucide-react';
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
  if (status === 'Próxima') return 'chip chip-warn';
  return 'chip chip-success';
}

export function Manutencoes() {
  const user = getUser();
  const podeGerenciar = user?.permissoes?.includes('Manutencoes.Gerenciar');

  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);
  const [filtro, setFiltro] = useState({
    veiculoId: '',
    status: ''
  });

  const totalAlertas = useMemo(() => ({
    proximas: alertas.filter(x => x.status === 'Próxima').length,
    vencidas: alertas.filter(x => x.status === 'Vencida').length
  }), [alertas]);

  async function load() {
    const params = {
      veiculoId: filtro.veiculoId || undefined,
      status: filtro.status || undefined
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
    let cancelled = false;

    async function carregar() {
      try {
        const [manutencoesRes, alertasRes, veiculosRes] = await Promise.all([
          manutencaoService.listar({}),
          manutencaoService.alertas(),
          veiculoService.listar()
        ]);

        if (!cancelled) {
          setItems(manutencoesRes.data);
          setAlertas(alertasRes.data);
          setVeiculos(veiculosRes.data);
        }
      } catch {
        if (!cancelled) toast.error('Erro ao carregar manutenções.');
      }
    }

    carregar();

    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e) {
    e.preventDefault();

    if (!podeGerenciar) {
      toast.warning('Você não tem permissão para gerenciar manutenções.');
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
        toast.success('Manutenção atualizada.');
      } else {
        await manutencaoService.criar(payload);
        toast.success('Manutenção cadastrada.');
      }

      setForm(initialForm);
      setEdit(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar manutenção.');
    }
  }

  async function remover(id) {
    if (!confirm('Remover manutenção?')) return;

    try {
      await manutencaoService.remover(id);
      toast.success('Manutenção removida.');
      await load();
    } catch {
      toast.error('Erro ao remover manutenção.');
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
  }

  return (
    <>
      <Header
        title="Manutenções"
        subtitle="Controle de manutenções, próximos vencimentos por KM e alertas por data"
      />

      <div className="row g-3 mb-3">
        <Metric title="Alertas próximos" value={totalAlertas.proximas} icon={<CalendarClock size={20} />} cor="#d97706" />
        <Metric title="Alertas vencidos" value={totalAlertas.vencidas} icon={<AlertTriangle size={20} />} cor="#dc2626" />
      </div>

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

      {podeGerenciar && (
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
          </div>

          <div>
            <button className="btn btn-success me-2">
              {edit ? 'Atualizar manutenção' : 'Salvar manutenção'}
            </button>

            {edit && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEdit(null);
                  setForm(initialForm);
                }}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      )}

      <div className="card card-soft p-3 mb-3">
        <h5>Filtros</h5>

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

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button className="btn btn-outline-primary w-100" onClick={load}>
              Filtrar
            </button>
          </div>
        </div>
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
              <th width="180"></th>
            </tr>
          </thead>

          <tbody>
            {items.map(x => (
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

            {items.length === 0 && (
              <tr><td colSpan="8" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhuma manutenção encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
