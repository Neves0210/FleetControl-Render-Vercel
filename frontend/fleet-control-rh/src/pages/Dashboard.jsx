import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Car, Users, Fuel, Droplets, DollarSign, TrendingUp, TrendingDown,
  Plus, FileBarChart, AlertTriangle, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { Header } from '../components/Layout/Header';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { AreaChart, BarsVeiculo, Donut, Sparkline } from '../components/Dashboard/Charts';
import { money, number, litros as litrosFmt, toNumber } from '../utils/formatters';
import '../components/Dashboard/dashboard.css';

/* ── Configurações ───────────────────────────────────────────────────────── */
const PERIODOS = [
  { id: '6m', label: '6 meses', meses: 6 },
  { id: '12m', label: '12 meses', meses: 12 },
  { id: 'all', label: 'Tudo', meses: null }
];

const COMBUSTIVEIS = {
  1: { nome: 'Gasolina', cor: '#2563eb' },
  2: { nome: 'Etanol', cor: '#16a34a' },
  3: { nome: 'Diesel', cor: '#d97706' },
  4: { nome: 'Flex', cor: '#7c3aed' }
};
const COMB_OUTROS = { nome: 'Outros', cor: '#94a3b8' };

/* ── Helpers de agregação ────────────────────────────────────────────────── */
function parseData(s) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function dentroDoPeriodo(d, meses) {
  if (meses == null) return true;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  return d >= limite;
}

function rotuloMes(d) {
  const l = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return l.charAt(0).toUpperCase() + l.slice(1, 3);
}

/** Agrupa por mês: [{ key, rotulo, valor, count }] ordenado cronologicamente. */
function agruparPorMes(lista) {
  const mapa = new Map();

  lista.forEach(x => {
    const d = parseData(x.dataAbastecimento);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const atual = mapa.get(key) || { key, d, valor: 0, count: 0 };
    atual.valor += toNumber(x.valorTotal);
    atual.count += 1;
    mapa.set(key, atual);
  });

  return [...mapa.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map(m => ({ key: m.key, rotulo: rotuloMes(m.d), valor: m.valor, count: m.count }));
}

function gastoPorVeiculo(lista) {
  const mapa = new Map();

  lista.forEach(x => {
    const placa = x.veiculo?.placa || x.veiculo?.modelo || '—';
    mapa.set(placa, (mapa.get(placa) || 0) + toNumber(x.valorTotal));
  });

  return [...mapa.entries()]
    .map(([placa, valor]) => ({ placa, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
}

function litrosPorCombustivel(lista) {
  const mapa = new Map();
  let total = 0;

  lista.forEach(x => {
    const tipo = x.veiculo?.tipoCombustivel ?? 0;
    const l = toNumber(x.litros);
    mapa.set(tipo, (mapa.get(tipo) || 0) + l);
    total += l;
  });

  if (total <= 0) return [];

  return [...mapa.entries()]
    .map(([tipo, l]) => {
      const meta = COMBUSTIVEIS[tipo] || COMB_OUTROS;
      return { nome: meta.nome, cor: meta.cor, litros: l, pct: Math.round((l / total) * 100) };
    })
    .sort((a, b) => b.litros - a.litros);
}

function tendencia(serie, campo) {
  if (serie.length < 2) return null;
  const atual = serie[serie.length - 1][campo];
  const anterior = serie[serie.length - 2][campo];
  if (!anterior) return null;
  const p = Math.round(((atual - anterior) / anterior) * 100);
  return { txt: `${p >= 0 ? '+' : ''}${p}%`, dir: p >= 0 ? 'up' : 'down' };
}

function litrosCurto(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}k`;
  return Math.round(v).toString();
}

/* ── KPI card ─────────────────────────────────────────────────────────────── */
function Kpi({ icon, label, value, cor, trend, sparkData }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-icon" style={{ background: `${cor}14`, color: cor }}>{icon}</span>
        {sparkData?.length > 1 && <Sparkline data={sparkData} cor={cor} />}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        <span className="kpi-label">{label}</span>
        {trend && (
          <span className={`kpi-trend ${trend.dir}`}>
            {trend.dir === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{trend.txt}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Página ─────────────────────────────────────────────────────────────── */
export function Dashboard() {
  const navigate = useNavigate();
  const [dash, setDash] = useState(null);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [periodo, setPeriodo] = useState('12m');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function carregar() {
      try {
        const [dashRes, abastRes] = await Promise.all([
          api.get('/dashboard'),
          api.get('/abastecimentos')
        ]);

        if (cancelled) return;
        setDash(dashRes.data);
        setAbastecimentos(Array.isArray(abastRes.data) ? abastRes.data : []);
      } catch {
        if (!cancelled) toast.error('Erro ao carregar o dashboard.');
      } finally {
        if (!cancelled) setCarregando(false);
      }

      // Alertas de manutenção são opcionais (depende de permissão) → falha em silêncio.
      try {
        const alertasRes = await api.get('/manutencoes/alertas');
        if (!cancelled) setAlertas(Array.isArray(alertasRes.data) ? alertasRes.data : []);
      } catch {
        if (!cancelled) setAlertas([]);
      }
    }

    carregar();
    return () => { cancelled = true; };
  }, []);

  const meses = PERIODOS.find(p => p.id === periodo)?.meses ?? null;

  /* Lista filtrada pelo período (afeta apenas os gráficos). */
  const listaFiltrada = useMemo(() => {
    return abastecimentos.filter(x => {
      const d = parseData(x.dataAbastecimento);
      return d && dentroDoPeriodo(d, meses);
    });
  }, [abastecimentos, meses]);

  const mensal = useMemo(() => {
    const todos = agruparPorMes(listaFiltrada);
    return todos.slice(-6); // até 6 meses no gráfico
  }, [listaFiltrada]);

  const serieGasto = useMemo(() => mensal.map(m => ({ rotulo: m.rotulo, valor: m.valor })), [mensal]);
  const sparkGasto = useMemo(() => mensal.map(m => m.valor), [mensal]);
  const sparkAbast = useMemo(() => mensal.map(m => m.count), [mensal]);
  const trendGasto = useMemo(() => tendencia(mensal, 'valor'), [mensal]);
  const trendAbast = useMemo(() => tendencia(mensal, 'count'), [mensal]);

  const porVeiculo = useMemo(() => gastoPorVeiculo(listaFiltrada), [listaFiltrada]);
  const combustivel = useMemo(() => litrosPorCombustivel(listaFiltrada), [listaFiltrada]);
  const totalGastoPeriodo = useMemo(
    () => listaFiltrada.reduce((s, x) => s + toNumber(x.valorTotal), 0),
    [listaFiltrada]
  );
  const totalLitrosPeriodo = useMemo(
    () => listaFiltrada.reduce((s, x) => s + toNumber(x.litros), 0),
    [listaFiltrada]
  );

  const alertasAtivos = useMemo(
    () => alertas.filter(a => a.status === 'Vencida' || a.status === 'Próxima').slice(0, 4),
    [alertas]
  );

  const recentes = useMemo(() => abastecimentos.slice(0, 5), [abastecimentos]);

  const hoje = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    []
  );

  if (carregando && !dash) {
    return (
      <>
        <Header title="Dashboard" subtitle="Carregando indicadores..." />
        <div className="card-soft p-3"><p className="text-muted" style={{ margin: 0 }}>Carregando...</p></div>
      </>
    );
  }

  const seletorPeriodo = (
    <div className="segmented">
      {PERIODOS.map(p => (
        <button key={p.id} className={`seg ${periodo === p.id ? 'active' : ''}`} onClick={() => setPeriodo(p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Resumo de ${hoje}`}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => navigate('/abastecimentos')}>
              <Plus size={16} /> Novo abastecimento
            </button>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/relatorios')}>
              <FileBarChart size={16} /> Relatórios
            </button>
          </>
        }
      />

      {/* KPIs (totais gerais vindos de /dashboard) */}
      <section className="kpi-grid">
        <Kpi icon={<Car size={20} />} label="Veículos ativos" value={number(dash?.veiculos ?? 0)} cor="#2563eb" />
        <Kpi icon={<Users size={20} />} label="Motoristas" value={number(dash?.motoristas ?? 0)} cor="#7c3aed" />
        <Kpi icon={<Fuel size={20} />} label="Abastecimentos" value={number(dash?.abastecimentos ?? 0)} cor="#0891b2"
          trend={trendAbast} sparkData={sparkAbast} />
        <Kpi icon={<Droplets size={20} />} label="Litros totais" value={litrosFmt(dash?.totalLitros ?? 0)} cor="#16a34a" />
        <Kpi icon={<DollarSign size={20} />} label="Gasto total" value={money(dash?.totalValor ?? 0)} cor="#d97706"
          trend={trendGasto} sparkData={sparkGasto} />
      </section>

      {/* Gráficos */}
      <section className="panel-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Gasto por mês</h3>
              <span className="panel-sub">Valor abastecido no período</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="panel-total">{money(totalGastoPeriodo)}</span>
              {seletorPeriodo}
            </div>
          </div>
          <AreaChart serie={serieGasto} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Combustível</h3>
              <span className="panel-sub">Litros por tipo</span>
            </div>
          </div>
          <Donut dados={combustivel} centerNum={litrosCurto(totalLitrosPeriodo)} centerLbl="litros" />
        </div>
      </section>

      <section className="panel-grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Gasto por veículo</h3>
              <span className="panel-sub">Top 5 no período</span>
            </div>
          </div>
          <BarsVeiculo dados={porVeiculo} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Alertas de manutenção</h3>
              <span className="panel-sub">Requer atenção</span>
            </div>
            {alertasAtivos.length > 0 && (
              <span className="badge-alert"><AlertTriangle size={13} /> {alertasAtivos.length}</span>
            )}
          </div>

          {alertasAtivos.length === 0 ? (
            <div className="alert-empty">Nenhum alerta de manutenção. 🎉</div>
          ) : (
            <div className="alert-list">
              {alertasAtivos.map((a, i) => (
                <div className="alert-item" key={a.manutencaoId || i}>
                  <span className={`status-dot ${a.status === 'Vencida' ? 'danger' : 'warn'}`} />
                  <div className="alert-info">
                    <strong>{a.veiculo}{a.placa ? ` — ${a.placa}` : ''}</strong>
                    <span>{a.tipo}</span>
                  </div>
                  <span className={`chip ${a.status === 'Vencida' ? 'chip-danger' : 'chip-warn'}`}>{a.status}</span>
                </div>
              ))}
              <button className="alert-cta" onClick={() => navigate('/manutencoes')}>
                Ver manutenções <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Últimos abastecimentos */}
      <div className="card card-soft table-card">
        <div className="card-body"><h5>Últimos abastecimentos</h5></div>
        <AbastecimentosTabela items={recentes} />
      </div>
    </>
  );
}
