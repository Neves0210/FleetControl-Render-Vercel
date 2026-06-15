import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  FileBarChart,
  Fuel,
  RotateCcw,
  Settings2,
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
import { getUser } from '../utils/permissions';
import '../components/Dashboard/dashboard.css';

const PERIODOS = [
  { id: '6m', label: '6 meses', meses: 6 },
  { id: '12m', label: '12 meses', meses: 12 },
  { id: 'all', label: 'Tudo', meses: null }
];

const DASHBOARD_SECTIONS = [
  { id: 'kpis', label: 'Indicadores principais' },
  { id: 'charts', label: 'Gráficos operacionais' },
  { id: 'maintenance', label: 'Manutenção preventiva' },
  { id: 'recent', label: 'Últimos abastecimentos' }
];

const DEFAULT_DASHBOARD_CONFIG = {
  order: ['kpis', 'charts', 'maintenance', 'recent'],
  visible: {
    kpis: true,
    charts: true,
    maintenance: true,
    recent: true
  },
  kpiColumns: 3,
  density: 'normal',
  accent: '#f36b21'
};

function podePersonalizarDashboard(user) {
  return user?.perfil === 1 || user?.perfil === 2 || user?.perfil === 'Master' || user?.perfil === 'RH';
}

function dashboardConfigKey(user) {
  return `fleet-dashboard-config-${user?.id || user?.email || 'local'}`;
}

function normalizarConfig(config) {
  const visible = { ...DEFAULT_DASHBOARD_CONFIG.visible, ...(config?.visible || {}) };
  const order = Array.isArray(config?.order)
    ? [
        ...config.order.filter(id => DASHBOARD_SECTIONS.some(section => section.id === id)),
        ...DEFAULT_DASHBOARD_CONFIG.order.filter(id => !config.order.includes(id))
      ]
    : DEFAULT_DASHBOARD_CONFIG.order;

  return {
    ...DEFAULT_DASHBOARD_CONFIG,
    ...config,
    visible,
    order,
    kpiColumns: Number(config?.kpiColumns) || DEFAULT_DASHBOARD_CONFIG.kpiColumns
  };
}

function carregarConfigDashboard(user) {
  try {
    const salvo = localStorage.getItem(dashboardConfigKey(user));
    return normalizarConfig(salvo ? JSON.parse(salvo) : DEFAULT_DASHBOARD_CONFIG);
  } catch {
    return DEFAULT_DASHBOARD_CONFIG;
  }
}

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
  return 'Crítico';
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
  const user = getUser();
  const podeCustomizar = podePersonalizarDashboard(user);
  const [dash, setDash] = useState(null);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [usos, setUsos] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [periodo, setPeriodo] = useState('12m');
  const [carregando, setCarregando] = useState(true);
  const [editandoPainel, setEditandoPainel] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState(() => carregarConfigDashboard(user));

  useEffect(() => {
    if (!podeCustomizar) return;
    localStorage.setItem(dashboardConfigKey(user), JSON.stringify(dashboardConfig));
  }, [dashboardConfig, podeCustomizar, user]);

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
  const barrasPontuacao = useMemo(
    () => [72, 84, operadorScore, Math.max(70, operadorScore - 6), 88, Math.min(98, operadorScore + 4)],
    [operadorScore]
  );

  const hoje = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    []
  );

  if (carregando && !dash) {
    return (
      <>
        <Header title="Painel" subtitle="Carregando indicadores..." />
        <div className="panel"><p className="text-muted m-0">Carregando...</p></div>
      </>
    );
  }

  const headerMetrics = [
    { label: 'Status', value: statusText(alertasAtivos.length) },
    { label: 'Litros', value: litrosFmt(dash?.totalLitros ?? 0) },
    { label: 'Gasto total', value: money(dash?.totalValor ?? 0) }
  ];

  function atualizarConfig(parcial) {
    setDashboardConfig(config => normalizarConfig({ ...config, ...parcial }));
  }

  function toggleSection(id) {
    setDashboardConfig(config => normalizarConfig({
      ...config,
      visible: { ...config.visible, [id]: !config.visible[id] }
    }));
  }

  function moverSecao(id, direcao) {
    setDashboardConfig(config => {
      const order = [...config.order];
      const index = order.indexOf(id);
      const nextIndex = index + direcao;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return config;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return normalizarConfig({ ...config, order });
    });
  }

  function resetarPainel() {
    setDashboardConfig(DEFAULT_DASHBOARD_CONFIG);
  }

  const editorPainel = podeCustomizar && editandoPainel && (
    <section className="dashboard-customizer">
      <div className="customizer-head">
        <div>
          <p className="panel-kicker">Modo de montagem</p>
          <h3>Personalizar painel</h3>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={resetarPainel}>
          <RotateCcw size={14} /> Restaurar padrão
        </button>
      </div>

      <div className="customizer-grid">
        <div className="customizer-group">
          <label>Blocos do painel</label>
          <div className="section-builder-list">
            {dashboardConfig.order.map((id, index) => {
              const section = DASHBOARD_SECTIONS.find(item => item.id === id);
              if (!section) return null;

              return (
                <div className="section-builder-item" key={id}>
                  <button
                    className={`icon-toggle ${dashboardConfig.visible[id] ? 'active' : ''}`}
                    onClick={() => toggleSection(id)}
                    title={dashboardConfig.visible[id] ? 'Ocultar bloco' : 'Mostrar bloco'}
                    type="button"
                  >
                    {dashboardConfig.visible[id] ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <span>{section.label}</span>
                  <div className="move-actions">
                    <button type="button" onClick={() => moverSecao(id, -1)} disabled={index === 0}>↑</button>
                    <button type="button" onClick={() => moverSecao(id, 1)} disabled={index === dashboardConfig.order.length - 1}>↓</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="customizer-group">
          <label>Colunas dos indicadores</label>
          <div className="segmented customizer-segmented">
            {[1, 2, 3].map(value => (
              <button
                className={`seg ${dashboardConfig.kpiColumns === value ? 'active' : ''}`}
                key={value}
                onClick={() => atualizarConfig({ kpiColumns: value })}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>

          <label>Densidade</label>
          <div className="segmented customizer-segmented">
            {[
              { id: 'compact', label: 'Compacta' },
              { id: 'normal', label: 'Normal' }
            ].map(item => (
              <button
                className={`seg ${dashboardConfig.density === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => atualizarConfig({ density: item.id })}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="customizer-group">
          <label>Cor de destaque</label>
          <div className="accent-swatches">
            {[
              { label: 'Segurança', value: '#f36b21' },
              { label: 'Petróleo', value: '#10323a' },
              { label: 'Operação', value: '#16a34a' },
              { label: 'Crítico', value: '#dc2626' }
            ].map(color => (
              <button
                className={dashboardConfig.accent === color.value ? 'selected' : ''}
                key={color.value}
                onClick={() => atualizarConfig({ accent: color.value })}
                style={{ '--swatch': color.value }}
                title={color.label}
                type="button"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  const sections = {
    kpis: (
      <section
        className="industrial-kpi-grid"
        style={{ '--kpi-columns': dashboardConfig.kpiColumns }}
        key="kpis"
      >
        <IndustrialKpi
          icon={<Truck size={21} />}
          label="Veículos ativos"
          value={number(veiculosAtivos)}
          meta="Disponibilidade da frota"
          accent="green"
        >
          <div className="health-track"><span style={{ width: `${Math.min(veiculosAtivos, 100)}%` }} /></div>
        </IndustrialKpi>

        <IndustrialKpi
          icon={<Fuel size={21} />}
          label="Eficiência de combustível"
          value={`${eficiencia.toFixed(2).replace('.', ',')} R$/L`}
          meta="Média móvel"
          accent="teal"
        >
          <Sparkline data={sparkFuel} cor="#10323a" />
        </IndustrialKpi>

        <IndustrialKpi
          icon={<ShieldCheck size={21} />}
          label="Pontuação do operador"
          value={`${operadorScore}%`}
          meta="Comportamento dos condutores"
          accent="orange"
        >
          <MiniBars values={barrasPontuacao} />
        </IndustrialKpi>
      </section>
    ),
    charts: (
      <section className="cockpit-chart-grid" key="charts">
        <article className="panel panel-technical">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">KPIs mensais</p>
              <h3>Consumo financeiro por mês</h3>
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
              <p className="panel-kicker">Histórico de performance</p>
              <h3>Histórico de performance</h3>
            </div>
            <span className="panel-total">{money(totalGastoPeriodo)}</span>
          </div>
          <AreaChart serie={serieGasto} />
        </article>
      </section>
    ),
    maintenance: (
      <section className="maintenance-panel" key="maintenance">
        <div className="maintenance-head">
          <div>
            <p className="panel-kicker">Alertas de manutenção preventiva</p>
            <h2>Alertas de manutenção preventiva</h2>
          </div>
          <button className="alert-cta" onClick={() => navigate('/manutencoes')}>
            Abrir manutenções <ChevronRight size={15} />
          </button>
        </div>

        <div className="maintenance-grid">
          <article className="maintenance-stat">
            <Truck size={26} />
            <span>Veículos em urgência</span>
            <strong>{number(avisosCriticos)}</strong>
          </article>
          <article className="maintenance-stat">
            <Wrench size={26} />
            <span>Avisos críticos</span>
            <strong>{number(alertasAtivos.length)}</strong>
          </article>

          <div className="urgent-list">
            {(alertasAtivos.length ? alertasAtivos : [
              { titulo: 'Sistema em condição normal', detalhe: 'Nenhuma manutenção preventiva urgente no momento.', tipo: 'success' },
              { titulo: 'Inspeção programada', detalhe: 'Continue monitorando pneus, fluidos e revisões por quilometragem.', tipo: 'warn' }
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
    ),
    recent: (
      <div className="card card-soft table-card" key="recent">
        <div className="card-body">
          <h5>Últimos abastecimentos</h5>
        </div>
        <AbastecimentosTabela items={recentes} />
      </div>
    )
  };

  return (
    <div
      className={`dashboard-workspace density-${dashboardConfig.density}`}
      style={{ '--dashboard-accent': dashboardConfig.accent }}
    >
      <Header
        title="Painel"
        subtitle={`Resumo operacional de ${hoje}`}
        metrics={headerMetrics}
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

      {podeCustomizar && (
        <div className="dashboard-admin-toolbar">
          <button
            className={`btn ${editandoPainel ? 'btn-dark' : 'btn-outline-secondary'}`}
            onClick={() => setEditandoPainel(value => !value)}
          >
            <Settings2 size={16} /> {editandoPainel ? 'Concluir personalização' : 'Personalizar painel'}
          </button>
        </div>
      )}

      {editorPainel}

      {dashboardConfig.order
        .filter(id => dashboardConfig.visible[id])
        .map(id => sections[id])}

      {false && (
      <>
      <section className="industrial-kpi-grid">
        <IndustrialKpi
          icon={<Truck size={21} />}
          label="Veículos ativos"
          value={number(veiculosAtivos)}
          meta="Disponibilidade da frota"
          accent="green"
        >
          <div className="health-track"><span style={{ width: `${Math.min(veiculosAtivos, 100)}%` }} /></div>
        </IndustrialKpi>

        <IndustrialKpi
          icon={<Fuel size={21} />}
          label="Eficiência de combustível"
          value={`${eficiencia.toFixed(2).replace('.', ',')} R$/L`}
          meta="Média móvel"
          accent="teal"
        >
          <Sparkline data={sparkFuel} cor="#10323a" />
        </IndustrialKpi>

        <IndustrialKpi
          icon={<ShieldCheck size={21} />}
          label="Pontuação do operador"
          value={`${operadorScore}%`}
          meta="Comportamento dos condutores"
          accent="orange"
        >
          <MiniBars values={barrasPontuacao} />
        </IndustrialKpi>
      </section>

      <section className="cockpit-chart-grid">
        <article className="panel panel-technical">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">KPIs mensais</p>
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
              <p className="panel-kicker">Histórico de performance</p>
              <h3>Histórico de performance</h3>
            </div>
            <span className="panel-total">{money(totalGastoPeriodo)}</span>
          </div>
          <AreaChart serie={serieGasto} />
        </article>
      </section>

      <section className="maintenance-panel">
        <div className="maintenance-head">
          <div>
            <p className="panel-kicker">Alertas de manutenção preventiva</p>
            <h2>Alertas de manutenção preventiva</h2>
          </div>
          <button className="alert-cta" onClick={() => navigate('/manutencoes')}>
            Abrir manutenções <ChevronRight size={15} />
          </button>
        </div>

        <div className="maintenance-grid">
          <article className="maintenance-stat">
            <Truck size={26} />
            <span>Veículos em urgência</span>
            <strong>{number(avisosCriticos)}</strong>
          </article>
          <article className="maintenance-stat">
            <Wrench size={26} />
            <span>Avisos críticos</span>
            <strong>{number(alertasAtivos.length)}</strong>
          </article>

          <div className="urgent-list">
            {(alertasAtivos.length ? alertasAtivos : [
              { titulo: 'Sistema em condição normal', detalhe: 'Nenhuma manutenção preventiva urgente no momento.', tipo: 'success' },
              { titulo: 'Inspeção programada', detalhe: 'Continue monitorando pneus, fluidos e revisões por quilometragem.', tipo: 'warn' }
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
          <h5>Últimos abastecimentos</h5>
        </div>
        <AbastecimentosTabela items={recentes} />
      </div>
      </>
      )}
    </div>
  );
}
