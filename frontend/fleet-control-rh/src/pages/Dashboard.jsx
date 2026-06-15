import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  FileBarChart,
  Fuel,
  Gauge,
  Plus,
  ShieldCheck,
  Truck,
  Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { Header } from '../components/Layout/Header';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { AreaChart, Sparkline } from '../components/Dashboard/Charts';
import { money, number, litros as litrosFmt, toNumber } from '../utils/formatters';
import { calcularAlertasOperacionais } from '../utils/operationalAlerts';
import '../components/Dashboard/dashboard.css';

const PERIODOS = [
  { id: '6m', label: '6 meses', meses: 6 },
  { id: '12m', label: '12 meses', meses: 12 },
  { id: 'all', label: 'Tudo', meses: null }
];

function parseData(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dentroDoPeriodo(d, meses) {
  if (meses == null) return true;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  return d >= limite;
}

function rotuloMes(d) {
  const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1, 3);
}

function agruparPorMes(lista) {
  const mapa = new Map();

  lista.forEach(item => {
    const d = parseData(item.dataAbastecimento);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const atual = mapa.get(key) || { key, d, valor: 0, litros: 0, count: 0 };
    atual.valor += toNumber(item.valorTotal);
    atual.litros += toNumber(item.litros);
    atual.count += 1;
    mapa.set(key, atual);
  });

  return [...mapa.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map(m => ({ key: m.key, rotulo: rotuloMes(m.d), valor: m.valor, litros: m.litros, count: m.count }));
}

function statusText(totalAlertas) {
  if (totalAlertas === 0) return 'Normal';
  if (totalAlertas < 4) return 'Monitorar';
  return 'Critico';
}

function MiniBars({ values = [] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mini-bars" aria-hidden="true">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${28 + (value / max) * 42}px` }} />
      ))}
    </div>
  );
}

function MonthlyColumns({ data = [] }) {
  if (!data.length) return <div className="chart-empty">Sem dados no periodo.</div>;
  const max = Math.max(...data.map(item => item.valor), 1);

  return (
    <div className="column-chart">
      {data.map(item => (
        <div className="column-item" key={item.key}>
          <div className="column-track">
            <span style={{ height: `${Math.max((item.valor / max) * 100, 8)}%` }} />
          </div>
          <small>{item.rotulo}</small>
        </div>
      ))}
    </div>
  );
}

function IndustrialKpi({ icon, label, value, meta, children, accent = 'green' }) {
  return (
    <article className={`industrial-kpi ${accent}`}>
      <div className="industrial-kpi-head">
        <span className="industrial-icon">{icon}</span>
        <span>{meta}</span>
      </div>
      <strong>{value}</strong>
      <p>{label}</p>
      {children}
    </article>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [dash, setDash] = useState(null);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [usos, setUsos] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [periodo, setPeriodo] = useState('12m');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function carregar() {
      try {
        const [dashRes, abastRes, veiculosRes, usosRes] = await Promise.all([
          api.get('/dashboard'),
          api.get('/abastecimentos'),
          api.get('/veiculos', { params: { incluirInativos: true } }),
          api.get('/usos-veiculos', { params: { somenteAtivos: true } })
        ]);

        if (cancelled) return;
        setDash(dashRes.data);
        setAbastecimentos(Array.isArray(abastRes.data) ? abastRes.data : []);
        setVeiculos(Array.isArray(veiculosRes.data) ? veiculosRes.data : []);
        setUsos(Array.isArray(usosRes.data) ? usosRes.data : []);
      } catch {
        if (!cancelled) toast.error('Erro ao carregar o dashboard.');
      } finally {
        if (!cancelled) setCarregando(false);
      }

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

  const listaFiltrada = useMemo(() => (
    abastecimentos.filter(item => {
      const data = parseData(item.dataAbastecimento);
      return data && dentroDoPeriodo(data, meses);
    })
  ), [abastecimentos, meses]);

  const mensal = useMemo(() => agruparPorMes(listaFiltrada).slice(-6), [listaFiltrada]);
  const serieGasto = useMemo(() => mensal.map(m => ({ rotulo: m.rotulo, valor: m.valor })), [mensal]);
  const sparkFuel = useMemo(() => mensal.map(m => m.litros), [mensal]);
  const sparkOps = useMemo(() => mensal.map(m => m.count), [mensal]);

  const totalGastoPeriodo = useMemo(
    () => listaFiltrada.reduce((sum, item) => sum + toNumber(item.valorTotal), 0),
    [listaFiltrada]
  );
  const totalLitrosPeriodo = useMemo(
    () => listaFiltrada.reduce((sum, item) => sum + toNumber(item.litros), 0),
    [listaFiltrada]
  );

  const alertasAtivos = useMemo(
    () => calcularAlertasOperacionais({ abastecimentos, usos, manutencoes: alertas, veiculos }),
    [abastecimentos, usos, alertas, veiculos]
  );

  const recentes = useMemo(() => abastecimentos.slice(0, 5), [abastecimentos]);
  const eficiencia = totalLitrosPeriodo > 0 ? totalGastoPeriodo / totalLitrosPeriodo : 0;
  const veiculosAtivos = dash?.veiculos ?? veiculos.filter(v => v.ativo !== false).length;
  const avisosCriticos = alertasAtivos.filter(a => a.tipo === 'danger').length;
  const operadorScore = Math.max(72, Math.min(98, 92 - avisosCriticos * 4 + Math.min(usos.length, 5)));

  const hoje = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    []
  );

  if (carregando && !dash) {
    return (
      <>
        <Header title="Dashboard" subtitle="Carregando indicadores..." />
        <div className="panel"><p className="text-muted m-0">Carregando...</p></div>
      </>
    );
  }

  const headerMetrics = [
    { label: 'Status', value: statusText(alertasAtivos.length) },
    { label: 'Litros', value: litrosFmt(dash?.totalLitros ?? 0) },
    { label: 'Gasto total', value: money(dash?.totalValor ?? 0) }
  ];

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Resumo operacional de ${hoje}`}
        metrics={headerMetrics}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => navigate('/abastecimentos')}>
              <Plus size={16} /> Novo abastecimento
            </button>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/relatorios')}>
              <FileBarChart size={16} /> Relatorios
            </button>
          </>
        }
      />

      <section className="industrial-kpi-grid">
        <IndustrialKpi
          icon={<Truck size={21} />}
          label="Active Trucks"
          value={number(veiculosAtivos)}
          meta="Fleet availability"
          accent="green"
        >
          <div className="health-track"><span style={{ width: `${Math.min(veiculosAtivos, 100)}%` }} /></div>
        </IndustrialKpi>

        <IndustrialKpi
          icon={<Fuel size={21} />}
          label="Fuel Efficiency"
          value={`${eficiencia.toFixed(2).replace('.', ',')} R$/L`}
          meta="Rolling average"
          accent="teal"
        >
          <Sparkline data={sparkFuel} cor="#10323a" />
        </IndustrialKpi>

        <IndustrialKpi
          icon={<ShieldCheck size={21} />}
          label="Operator Score"
          value={`${operadorScore}%`}
          meta="Driver behavior"
          accent="orange"
        >
          <MiniBars values={[72, 84, operadorScore, 79, 88, 93]} />
        </IndustrialKpi>
      </section>

      <section className="cockpit-chart-grid">
        <article className="panel panel-technical">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Monthly KPIs</p>
              <h3>Consumo financeiro por mes</h3>
            </div>
            <div className="segmented">
              {PERIODOS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`seg ${periodo === p.id ? 'active' : ''}`}
                  onClick={() => setPeriodo(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <MonthlyColumns data={mensal} />
        </article>

        <article className="panel panel-technical">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Performance History</p>
              <h3>Historico de performance</h3>
            </div>
            <span className="panel-total">{money(totalGastoPeriodo)}</span>
          </div>
          <AreaChart serie={serieGasto} />
        </article>
      </section>

      <section className="maintenance-panel">
        <div className="maintenance-head">
          <div>
            <p className="panel-kicker">Preventive maintenance alerts</p>
            <h2>Alertas de manutencao preventiva</h2>
          </div>
          <button className="alert-cta" onClick={() => navigate('/manutencoes')}>
            Abrir manutencoes <ChevronRight size={15} />
          </button>
        </div>

        <div className="maintenance-grid">
          <article className="maintenance-stat">
            <Truck size={26} />
            <span>Trucks em urgencia</span>
            <strong>{number(avisosCriticos)}</strong>
          </article>
          <article className="maintenance-stat">
            <Wrench size={26} />
            <span>Avisos criticos</span>
            <strong>{number(alertasAtivos.length)}</strong>
          </article>

          <div className="urgent-list">
            {(alertasAtivos.length ? alertasAtivos : [
              { titulo: 'Sistema em condicao normal', detalhe: 'Nenhuma manutencao preventiva urgente no momento.', tipo: 'success' },
              { titulo: 'Inspecao programada', detalhe: 'Continue monitorando pneus, fluidos e revisoes por quilometragem.', tipo: 'warn' }
            ]).slice(0, 5).map((alerta, index) => (
              <div className="urgent-row" key={`${alerta.titulo}-${index}`}>
                <AlertTriangle size={18} />
                <div>
                  <strong>{alerta.titulo}</strong>
                  <span>{alerta.detalhe}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="card card-soft table-card">
        <div className="card-body">
          <h5>Ultimos abastecimentos</h5>
        </div>
        <AbastecimentosTabela items={recentes} />
      </div>
    </>
  );
}
