import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Eye,
  EyeOff,
  FileBarChart,
  Fuel,
  ListChecks,
  Plus,
  RotateCcw,
  Settings2,
  Table2,
  Truck,
  Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { Header } from '../components/Layout/Header';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { AreaChart, Sparkline } from '../components/Dashboard/Charts';
import { money, number, litros as litrosFmt, toNumber } from '../utils/formatters';
import { getUser } from '../utils/permissions';
import { dataBrasilParaDate, hojeExtensoBrasil, subtrairMesesBrasil } from '../utils/dataBrasil';
import '../components/Dashboard/dashboard.css';

const PERIODOS = [
  { id: '6m', label: '6 meses', meses: 6 },
  { id: '12m', label: '12 meses', meses: 12 },
  { id: 'all', label: 'Tudo', meses: null }
];

const COMBUSTIVEIS = {
  1: 'Gasolina',
  2: 'Etanol',
  3: 'Diesel',
  4: 'Flex'
};

const DASHBOARD_SECTIONS = [
  { id: 'kpis', label: 'Indicadores principais' },
  { id: 'monthlyCostBars', label: 'Gasto mensal em colunas' },
  { id: 'monthlyCostLine', label: 'Histórico financeiro em linha' },
  { id: 'monthlyLiters', label: 'Litros por mês' },
  { id: 'vehicleRanking', label: 'Ranking por veículo' },
  { id: 'fuelTable', label: 'Tabela de combustível' },
  { id: 'maintenance', label: 'Manutenção preventiva' },
  { id: 'recent', label: 'Últimos abastecimentos' }
];

const DEFAULT_DASHBOARD_CONFIG = {
  order: ['kpis', 'monthlyCostBars', 'monthlyCostLine', 'monthlyLiters', 'vehicleRanking', 'fuelTable', 'maintenance', 'recent'],
  visible: {
    kpis: true,
    monthlyCostBars: true,
    monthlyCostLine: true,
    monthlyLiters: false,
    vehicleRanking: true,
    fuelTable: false,
    maintenance: true,
    recent: true
  },
  kpiColumns: 3,
  density: 'normal',
  accent: '#f36b21'
};

function podePersonalizarDashboard(user) {
  return user?.perfil === 1 ||
    user?.perfil === 'Master' ||
    user?.permissoes?.includes('Dashboard.Personalizar');
}

function dashboardConfigKey(user) {
  return `fleet-dashboard-config-${user?.id || user?.email || 'local'}`;
}

function normalizarConfig(config) {
  const visible = { ...DEFAULT_DASHBOARD_CONFIG.visible, ...(config?.visible || {}) };
  const savedOrder = Array.isArray(config?.order) ? config.order : DEFAULT_DASHBOARD_CONFIG.order;
  const order = [
    ...savedOrder.filter(id => DASHBOARD_SECTIONS.some(section => section.id === id)),
    ...DEFAULT_DASHBOARD_CONFIG.order.filter(id => !savedOrder.includes(id))
  ];

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

function parseData(value) {
  const data = dataBrasilParaDate(value);
  return !data || Number.isNaN(data.getTime()) ? null : data;
}

function dentroDoPeriodo(data, meses) {
  if (meses == null) return true;
  const limite = subtrairMesesBrasil(meses);
  return data >= limite;
}

function rotuloMes(data) {
  const label = data.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1, 3);
}

function agruparPorMes(lista) {
  const mapa = new Map();

  lista.forEach(item => {
    const data = parseData(item.dataAbastecimento);
    if (!data) return;
    const key = `${data.getFullYear()}-${String(data.getMonth()).padStart(2, '0')}`;
    const atual = mapa.get(key) || { key, data, valor: 0, litros: 0, count: 0 };
    atual.valor += toNumber(item.valorTotal);
    atual.litros += toNumber(item.litros);
    atual.count += 1;
    mapa.set(key, atual);
  });

  return [...mapa.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map(item => ({ ...item, rotulo: rotuloMes(item.data) }));
}

function agruparPorVeiculo(lista) {
  const mapa = new Map();

  lista.forEach(item => {
    const nome = item.veiculo?.placa || item.veiculo?.modelo || 'Sem veículo';
    const atual = mapa.get(nome) || { nome, valor: 0, litros: 0, count: 0 };
    atual.valor += toNumber(item.valorTotal);
    atual.litros += toNumber(item.litros);
    atual.count += 1;
    mapa.set(nome, atual);
  });

  return [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
}

function agruparCombustivel(lista) {
  const mapa = new Map();

  lista.forEach(item => {
    const tipo = item.veiculo?.tipoCombustivel ?? 0;
    const nome = COMBUSTIVEIS[tipo] || 'Outros';
    const atual = mapa.get(nome) || { nome, valor: 0, litros: 0, count: 0 };
    atual.valor += toNumber(item.valorTotal);
    atual.litros += toNumber(item.litros);
    atual.count += 1;
    mapa.set(nome, atual);
  });

  return [...mapa.values()].sort((a, b) => b.litros - a.litros);
}

function statusManutencao(status = '') {
  const s = String(status).toLowerCase();
  if (s.includes('vencida')) return 'danger';
  if (s.includes('pr') || s.includes('proxima')) return 'warn';
  return 'info';
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

function ColumnChart({ data = [], valueKey = 'valor', empty = 'Sem dados no período.' }) {
  if (!data.length) return <div className="chart-empty">{empty}</div>;
  const max = Math.max(...data.map(item => item[valueKey]), 1);

  return (
    <div className="column-chart">
      {data.map(item => (
        <div className="column-item" key={item.key || item.nome}>
          <div className="column-track">
            <span style={{ height: `${Math.max((item[valueKey] / max) * 100, 8)}%` }} />
          </div>
          <small>{item.rotulo || item.nome}</small>
        </div>
      ))}
    </div>
  );
}

function RankingBars({ data = [], valueKey = 'valor', format = money }) {
  if (!data.length) return <div className="chart-empty">Sem dados no período.</div>;
  const max = Math.max(...data.map(item => item[valueKey]), 1);

  return (
    <div className="ranking-bars">
      {data.map(item => (
        <div className="ranking-row" key={item.nome}>
          <span>{item.nome}</span>
          <div><strong style={{ width: `${Math.max((item[valueKey] / max) * 100, 5)}%` }} /></div>
          <b>{format(item[valueKey])}</b>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, data, empty = 'Sem dados no período.' }) {
  if (!data.length) return <div className="chart-empty">{empty}</div>;

  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-mini-table">
        <thead>
          <tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={item.nome || item.key || index}>
              {columns.map(column => <td key={column.key}>{column.render(item)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
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
        const [dashRes, abastRes, veiculosRes] = await Promise.all([
          api.get('/dashboard'),
          api.get('/abastecimentos'),
          api.get('/veiculos', { params: { incluirInativos: true } })
        ]);

        if (cancelled) return;
        setDash(dashRes.data);
        setAbastecimentos(Array.isArray(abastRes.data) ? abastRes.data : []);
        setVeiculos(Array.isArray(veiculosRes.data) ? veiculosRes.data : []);
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

  const meses = PERIODOS.find(item => item.id === periodo)?.meses ?? null;

  const listaFiltrada = useMemo(() => (
    abastecimentos.filter(item => {
      const data = parseData(item.dataAbastecimento);
      return data && dentroDoPeriodo(data, meses);
    })
  ), [abastecimentos, meses]);

  const mensal = useMemo(() => agruparPorMes(listaFiltrada).slice(-6), [listaFiltrada]);
  const serieGasto = useMemo(() => mensal.map(item => ({ rotulo: item.rotulo, valor: item.valor })), [mensal]);
  const sparkLitros = useMemo(() => mensal.map(item => item.litros), [mensal]);
  const sparkAbastecimentos = useMemo(() => mensal.map(item => item.count), [mensal]);
  const porVeiculo = useMemo(() => agruparPorVeiculo(listaFiltrada), [listaFiltrada]);
  const porCombustivel = useMemo(() => agruparCombustivel(listaFiltrada), [listaFiltrada]);
  const recentes = useMemo(() => abastecimentos.slice(0, 5), [abastecimentos]);

  const totalGastoPeriodo = useMemo(
    () => listaFiltrada.reduce((sum, item) => sum + toNumber(item.valorTotal), 0),
    [listaFiltrada]
  );
  const totalLitrosPeriodo = useMemo(
    () => listaFiltrada.reduce((sum, item) => sum + toNumber(item.litros), 0),
    [listaFiltrada]
  );

  const veiculosAtivos = dash?.veiculos ?? veiculos.filter(item => item.ativo !== false).length;
  const eficiencia = totalLitrosPeriodo > 0 ? totalGastoPeriodo / totalLitrosPeriodo : 0;
  const manutencoesVencidas = alertas.filter(item => statusManutencao(item.status) === 'danger').length;
  const manutencoesProximas = alertas.filter(item => statusManutencao(item.status) === 'warn').length;
  const totalAbastecimentosPeriodo = listaFiltrada.length;

  const hoje = useMemo(
    () => hojeExtensoBrasil(),
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
    { label: 'Manutenção', value: manutencoesVencidas ? `${manutencoesVencidas} vencida(s)` : 'Em controle' },
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
        <div className="customizer-group customizer-group-wide">
          <label>Blocos, gráficos e tabelas</label>
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
      <section className="industrial-kpi-grid" style={{ '--kpi-columns': dashboardConfig.kpiColumns }} key="kpis">
        <IndustrialKpi icon={<Truck size={21} />} label="Veículos ativos" value={number(veiculosAtivos)} meta="Cadastro da frota" accent="green">
          <div className="health-track"><span style={{ width: `${Math.min(veiculosAtivos, 100)}%` }} /></div>
        </IndustrialKpi>
        <IndustrialKpi icon={<Fuel size={21} />} label="Custo por litro" value={`${eficiencia.toFixed(2).replace('.', ',')} R$/L`} meta="Abastecimentos do período" accent="teal">
          <Sparkline data={sparkLitros} cor="#10323a" />
        </IndustrialKpi>
        <IndustrialKpi icon={<ListChecks size={21} />} label="Abastecimentos" value={number(totalAbastecimentosPeriodo)} meta="Registros filtrados" accent="orange">
          <MiniBars values={sparkAbastecimentos} />
        </IndustrialKpi>
      </section>
    ),
    monthlyCostBars: (
      <article className="panel panel-technical" key="monthlyCostBars">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Gráfico de colunas</p>
            <h3>Gasto mensal</h3>
          </div>
          <div className="segmented">
            {PERIODOS.map(item => (
              <button key={item.id} type="button" className={`seg ${periodo === item.id ? 'active' : ''}`} onClick={() => setPeriodo(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <ColumnChart data={mensal} valueKey="valor" />
      </article>
    ),
    monthlyCostLine: (
      <article className="panel panel-technical" key="monthlyCostLine">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Gráfico de linha</p>
            <h3>Histórico financeiro</h3>
          </div>
          <span className="panel-total">{money(totalGastoPeriodo)}</span>
        </div>
        <AreaChart serie={serieGasto} />
      </article>
    ),
    monthlyLiters: (
      <article className="panel panel-technical" key="monthlyLiters">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Volume abastecido</p>
            <h3>Litros por mês</h3>
          </div>
          <span className="panel-total">{litrosFmt(totalLitrosPeriodo)}</span>
        </div>
        <ColumnChart data={mensal} valueKey="litros" />
      </article>
    ),
    vehicleRanking: (
      <article className="panel panel-technical" key="vehicleRanking">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Ranking</p>
            <h3>Gasto por veículo</h3>
          </div>
          <BarChart3 size={20} />
        </div>
        <RankingBars data={porVeiculo} valueKey="valor" />
      </article>
    ),
    fuelTable: (
      <article className="panel panel-technical" key="fuelTable">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Tabela</p>
            <h3>Combustível por tipo</h3>
          </div>
          <Table2 size={20} />
        </div>
        <DataTable
          data={porCombustivel}
          columns={[
            { key: 'nome', label: 'Tipo', render: item => item.nome },
            { key: 'litros', label: 'Litros', render: item => litrosFmt(item.litros) },
            { key: 'valor', label: 'Valor', render: item => money(item.valor) },
            { key: 'count', label: 'Registros', render: item => number(item.count) }
          ]}
        />
      </article>
    ),
    maintenance: (
      <section className="maintenance-panel" key="maintenance">
        <div className="maintenance-head">
          <div>
            <p className="panel-kicker">Somente manutenções cadastradas</p>
            <h2>Alertas de manutenção preventiva</h2>
          </div>
          <button className="alert-cta" onClick={() => navigate('/manutencoes')}>
            Abrir manutenções <ChevronRight size={15} />
          </button>
        </div>

        <div className="maintenance-grid">
          <article className="maintenance-stat">
            <Truck size={26} />
            <span>Manutenções vencidas</span>
            <strong>{number(manutencoesVencidas)}</strong>
          </article>
          <article className="maintenance-stat">
            <Wrench size={26} />
            <span>Próximas manutenções</span>
            <strong>{number(manutencoesProximas)}</strong>
          </article>

          <div className="urgent-list">
            {(alertas.length ? alertas : [
              { tipo: 'Sistema', detalhe: 'Nenhuma manutenção preventiva urgente no momento.', status: 'Em dia' }
            ]).slice(0, 5).map((alerta, index) => (
              <div className="urgent-row" key={`${alerta.manutencaoId || alerta.tipo}-${index}`}>
                <AlertTriangle size={18} />
                <div>
                  <strong>{alerta.status || 'Manutenção'}</strong>
                  <span>
                    {[alerta.veiculo, alerta.placa, alerta.tipo].filter(Boolean).join(' - ') || alerta.detalhe}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
    recent: (
      <div className="card card-soft table-card" key="recent">
        <div className="card-body"><h5>Últimos abastecimentos</h5></div>
        <AbastecimentosTabela items={recentes} />
      </div>
    )
  };

  const orderedSections = dashboardConfig.order
    .filter(id => dashboardConfig.visible[id])
    .map(id => sections[id])
    .filter(Boolean);

  return (
    <div className={`dashboard-workspace density-${dashboardConfig.density}`} style={{ '--dashboard-accent': dashboardConfig.accent }}>
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

      <div className="dashboard-widget-grid">
        {orderedSections}
      </div>
    </div>
  );
}
