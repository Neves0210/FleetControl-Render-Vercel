import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { KeyRound, PlayCircle, StopCircle } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { Select } from '../components/Forms/Select';
import { usoVeiculoService } from '../services/usoVeiculoService';
import { veiculoService } from '../services/veiculoService';
import { motoristaService } from '../services/motoristaService';
import { getUser } from '../utils/permissions';
import { number } from '../utils/formatters';

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

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatTempo(minutos) {
  if (minutos === null || minutos === undefined) return '-';

  const total = Math.round(Number(minutos));
  const horas = Math.floor(total / 60);
  const mins = total % 60;

  if (horas <= 0) return `${mins} min`;

  return `${horas}h ${mins}min`;
}

export function UsosVeiculos() {
  const user = getUser();

  const [items, setItems] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [veiculosDisponiveis, setVeiculosDisponiveis] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [finalizar, setFinalizar] = useState(initialFinalizar);
  const [filtro, setFiltro] = useState({
    veiculoId: '',
    motoristaId: '',
    somenteAtivos: false
  });

  const usuarioTecnico = user?.perfil === 3 || user?.perfil === 'Tecnico';

  const usosAtivos = useMemo(
    () => items.filter(x => x.status === 1 || x.status === 'EmUso'),
    [items]
  );

  async function load() {
    const params = {
      veiculoId: filtro.veiculoId || undefined,
      motoristaId: filtro.motoristaId || undefined,
      somenteAtivos: filtro.somenteAtivos || undefined
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
    let cancelled = false;

    async function carregar() {
      try {
        const [usosRes, veiculosRes, disponiveisRes, motoristasRes] = await Promise.all([
          usoVeiculoService.listar({}),
          veiculoService.listar(),
          usoVeiculoService.veiculosDisponiveis(),
          motoristaService.listar()
        ]);

        if (!cancelled) {
          setItems(usosRes.data);
          setVeiculos(veiculosRes.data);
          setVeiculosDisponiveis(disponiveisRes.data);
          setMotoristas(motoristasRes.data);
        }
      } catch {
        if (!cancelled) toast.error('Erro ao carregar uso de veículos.');
      }
    }

    carregar();

    return () => {
      cancelled = true;
    };
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

      toast.success('Uso do veículo iniciado.');

      setForm(initialForm);

      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao iniciar uso do veículo.');
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

      toast.success('Uso do veículo finalizado.');

      setFinalizar(initialFinalizar);

      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao finalizar uso do veículo.');
    }
  }

  return (
    <>
      <Header
        title="Uso de Veículos"
        subtitle="Controle de disponibilidade, bloqueio e tempo de uso da frota"
        actions={<span className="badge-soft">{usosAtivos.length} em uso</span>}
      />

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
                text={x => `${x.veiculo?.placa || ''} - ${x.motorista?.nome || ''} | Início ${formatDate(x.dataInicio)}`}
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

      <div className="card card-soft p-3 mb-3">
        <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><KeyRound size={17} /> Filtros</h5>

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
              label="Motorista/Técnico"
              value={filtro.motoristaId}
              onChange={v => setFiltro({ ...filtro, motoristaId: v })}
              items={motoristas}
              text={x => x.nome}
            />
          )}

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
              <th>Status</th>
              <th>Veículo</th>
              <th>Técnico</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Tempo</th>
              <th>KM inicial</th>
              <th>KM final</th>
              <th>KM rodado</th>
            </tr>
          </thead>

          <tbody>
            {items.map(x => (
              <tr key={x.id}>
                <td>
                  <span className={x.status === 1 || x.status === 'EmUso' ? 'badge bg-warning text-dark' : 'badge bg-success'}>
                    {x.status === 1 || x.status === 'EmUso' ? 'Em uso' : 'Finalizado'}
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
              </tr>
            ))}

            {items.length === 0 && (
              <tr><td colSpan="9" className="text-muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum uso encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
