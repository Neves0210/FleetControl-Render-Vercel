import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  BarChart3,
  BadgeCheck,
  Calculator,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Eye,
  EyeOff,
  FileBarChart,
  Fuel,
  ListChecks,
  Plus,
  RotateCcw,
  Route,
  Settings2,
  Trash2,
  Table2,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { Header } from '../components/Layout/Header';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { AreaChart, Sparkline } from '../components/Dashboard/Charts';
import { money, number, litros as litrosFmt, toNumber } from '../utils/formatters';
import { getUser, temPermissao } from '../utils/permissions';
import { dataBrasilParaDate, hojeExtensoBrasil, subtrairMesesBrasil } from '../utils/dataBrasil';
import {
  DASHBOARD_VIEW_CHANGE_EVENT,
  dashboardViewPorId,
  lerDashboardView,
  normalizarDashboardView,
  perfilNumero
} from '../utils/dashboardViews';
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

const PERFIS_DASHBOARD = [
  { id: 'self', label: 'Meu painel' },
  { id: '2', label: 'RH', nivel: 2 },
  { id: '3', label: 'Técnico', nivel: 3 },
  { id: '4', label: 'Almoxarifado', nivel: 4 }
];

const DASHBOARD_SHORTCUTS = [
  { id: 'novoAbastecimento', label: 'Novo abastecimento', rota: '/abastecimentos', icon: 'plus', variant: 'btn-primary' },
  { id: 'relatorios', label: 'Relatórios', rota: '/relatorios', icon: 'relatorio', variant: 'btn-outline-secondary' },
  { id: 'veiculos', label: 'Veículos', rota: '/veiculos', icon: 'veiculo', variant: 'btn-outline-secondary' },
  { id: 'motoristas', label: 'Motoristas', rota: '/motoristas', icon: 'motorista', variant: 'btn-outline-secondary' },
  { id: 'usoVeiculos', label: 'Uso de veículos', rota: '/uso-veiculos', icon: 'rota', variant: 'btn-outline-secondary' },
  { id: 'manutencoes', label: 'Manutenções', rota: '/manutencoes', icon: 'manutencao', variant: 'btn-outline-secondary' },
  { id: 'usuarios', label: 'Usuários', rota: '/usuarios', icon: 'usuario', variant: 'btn-outline-secondary' }
];

const SHORTCUT_PERMISSIONS = {
  novoAbastecimento: 'Abastecimentos.Visualizar',
  relatorios: 'Relatorios.Visualizar',
  veiculos: 'Veiculos.Visualizar',
  motoristas: 'Motoristas.Visualizar',
  usoVeiculos: 'UsosVeiculos.Visualizar',
  manutencoes: 'Manutencoes.Visualizar',
  usuarios: 'Usuarios.Visualizar'
};

const PROFILE_SHORTCUT_PERMISSIONS = {
  2: ['Dashboard.Visualizar', 'Veiculos.Visualizar', 'Motoristas.Visualizar', 'Abastecimentos.Visualizar', 'Relatorios.Visualizar'],
  3: ['Dashboard.Visualizar', 'Abastecimentos.Visualizar', 'UsosVeiculos.Visualizar'],
  4: ['Dashboard.Visualizar', 'Veiculos.Visualizar', 'Abastecimentos.Visualizar', 'Manutencoes.Visualizar']
};

const DASHBOARD_SECTIONS = [
  { id: 'kpis', label: 'Indicadores principais' },
  { id: 'operationalRadar', label: 'Radar operacional' },
  { id: 'monthlyCostLine', label: 'Histórico financeiro em linha' },
  { id: 'vehicleRanking', label: 'Ranking por veículo' },
  { id: 'fuelTable', label: 'Tabela de combustível' },
  { id: 'maintenance', label: 'Manutenção preventiva' },
  { id: 'recent', label: 'Últimos abastecimentos' }
];

const DEFAULT_DASHBOARD_CONFIG = {
  order: ['kpis', 'operationalRadar', 'monthlyCostLine', 'vehicleRanking', 'fuelTable', 'maintenance', 'recent'],
  visible: {
    kpis: true,
    operationalRadar: true,
    monthlyCostLine: true,
    vehicleRanking: true,
    fuelTable: false,
    maintenance: true,
    recent: true
  },
  kpiColumns: 3,
  density: 'normal',
  accent: '#f8e000',
  shortcuts: ['novoAbastecimento', 'relatorios']
};

const DASHBOARD_VIEW_CONFIG = {
  general: {
    title: 'Painel geral',
    subtitle: 'Visao ampla da frota, custos e pendencias',
    accent: '#f8e000',
    sections: ['kpis', 'operationalRadar', 'monthlyCostLine', 'vehicleRanking', 'fuelTable', 'maintenance', 'recent'],
    shortcuts: ['novoAbastecimento', 'relatorios']
  },
  finance: {
    title: 'Painel financeiro',
    subtitle: 'Valores, medias, consumo e ranking de gastos',
    accent: '#10c040',
    sections: ['financeOverview', 'monthlyCostLine', 'financeBreakdown', 'vehicleRanking', 'fuelTable', 'recent'],
    shortcuts: ['relatorios', 'veiculos']
  },
  operational: {
    title: 'Painel operacional',
    subtitle: 'Somente dados vinculados ao usuario logado',
    accent: '#30a8d8',
    sections: ['userOperational', 'monthlyCostLine', 'fuelTable', 'recent'],
    shortcuts: ['novoAbastecimento', 'usoVeiculos']
  },
  hr: {
    title: 'Painel RH',
    subtitle: 'Funcionarios, veiculos e uso da frota',
    accent: '#4b1260',
    sections: ['hrOverview', 'hrPeopleVehicles', 'operationalRadar', 'vehicleRanking', 'recent'],
    shortcuts: ['motoristas', 'relatorios']
  },
  user: {
    title: 'Meu painel',
    subtitle: 'Somente informacoes vinculadas ao seu usuario',
    accent: '#f8e000',
    sections: ['kpis', 'monthlyCostLine', 'fuelTable', 'recent'],
    shortcuts: ['novoAbastecimento', 'usoVeiculos']
  }
};

function podePersonalizarDashboard(user) {
  return user?.perfil === 1 ||
    user?.perfil === 2 ||
    user?.perfil === 'Master' ||
    user?.perfil === 'RH' ||
    user?.permissoes?.includes('Dashboard.Personalizar');
}

function dashboardProfileConfigKey(perfilId) {
  return `fleet-dashboard-profile-config-${perfilId}`;
}

function dashboardConfigKey(user, perfilAlvo = 'self') {
  if (perfilAlvo !== 'self') return dashboardProfileConfigKey(perfilAlvo);
  return `fleet-dashboard-config-${user?.id || user?.email || 'local'}`;
}

function perfisConfiguraveis(user) {
  const perfil = perfilNumero(user);
  if (perfil === 1) return PERFIS_DASHBOARD;
  if (perfil === 2) return PERFIS_DASHBOARD.filter(item => item.id === 'self' || item.nivel > 2);
  return PERFIS_DASHBOARD.filter(item => item.id === 'self');
}

function atalhoPermitido(item, perfilAlvo = 'self') {
  const permissao = SHORTCUT_PERMISSIONS[item.id];
  if (!permissao) return true;
  if (perfilAlvo === 'self') return temPermissao(permissao);
  return (PROFILE_SHORTCUT_PERMISSIONS[perfilAlvo] || []).includes(permissao);
}

function normalizarConfig(config) {
  const visible = { ...DEFAULT_DASHBOARD_CONFIG.visible, ...(config?.visible || {}) };
  const savedOrder = Array.isArray(config?.order) ? config.order : DEFAULT_DASHBOARD_CONFIG.order;
  const savedShortcuts = Array.isArray(config?.shortcuts) ? config.shortcuts : DEFAULT_DASHBOARD_CONFIG.shortcuts;
  const order = [
    ...savedOrder.filter(id => DASHBOARD_SECTIONS.some(section => section.id === id)),
    ...DEFAULT_DASHBOARD_CONFIG.order.filter(id => !savedOrder.includes(id))
  ];
  const shortcuts = [...new Set(savedShortcuts)]
    .filter(id => DASHBOARD_SHORTCUTS.some(item => item.id === id))
    .slice(0, 2);

  return {
    ...DEFAULT_DASHBOARD_CONFIG,
    ...config,
    visible,
    order,
    shortcuts,
    kpiColumns: Number(config?.kpiColumns) || DEFAULT_DASHBOARD_CONFIG.kpiColumns
  };
}

function carregarConfigDashboard(user, perfilAlvo = 'self') {
  try {
    const chavePrincipal = dashboardConfigKey(user, perfilAlvo);
    const chavePerfil = dashboardProfileConfigKey(perfilNumero(user));
    const salvo = !podePersonalizarDashboard(user)
      ? localStorage.getItem(chavePerfil) || localStorage.getItem(chavePrincipal)
      : localStorage.getItem(chavePrincipal);
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

function diasDesde(value) {
  const data = parseData(value);
  if (!data) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);

  return Math.floor((hoje.getTime() - data.getTime()) / 86400000);
}

function ultimoAbastecimentoPorVeiculo(lista) {
  const mapa = new Map();

  lista.forEach(item => {
    const id = item.veiculoId || item.veiculo?.id;
    const data = parseData(item.dataAbastecimento);
    if (!id || !data) return;

    const atual = mapa.get(id);
    if (!atual || data > atual.data) {
      mapa.set(id, { item, data });
    }
  });

  return mapa;
}

function statusManutencao(status = '') {
  const s = String(status).toLowerCase();
  if (s.includes('vencida')) return 'danger';
  if (s.includes('pr') || s.includes('proxima')) return 'warn';
  return 'info';
}

function shortcutIcon(icon) {
  const props = { size: 16 };
  if (icon === 'plus') return <Plus {...props} />;
  if (icon === 'relatorio') return <FileBarChart {...props} />;
  if (icon === 'veiculo') return <Truck {...props} />;
  if (icon === 'motorista') return <Users {...props} />;
  if (icon === 'rota') return <Route {...props} />;
  if (icon === 'manutencao') return <Wrench {...props} />;
  if (icon === 'usuario') return <UserCog {...props} />;
  return <ChevronRight {...props} />;
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

function VisualMetricCard({ icon, label, value, meta, tone = 'default' }) {
  return (
    <article className={`visual-metric-card ${tone}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{meta}</p>
      </div>
    </article>
  );
}

function DailyFlow({ navigate }) {
  const steps = [
    { label: 'Iniciar uso', hint: 'Retirada do veículo', rota: '/uso-veiculos?aba=registrar', icon: <Route size={17} /> },
    { label: 'Abastecer', hint: 'Nota fiscal e litros', rota: '/abastecimentos?aba=registrar', icon: <Fuel size={17} /> },
    { label: 'Finalizar uso', hint: 'KM final e retorno', rota: '/uso-veiculos?aba=registrar&somenteAtivos=true', icon: <ListChecks size={17} /> },
    { label: 'Pendências', hint: 'Manutenções e alertas', rota: '/manutencoes?aba=consultar', icon: <Wrench size={17} /> }
  ];

  return (
    <section className="daily-flow">
      <div>
        <p className="panel-kicker">Fluxo operacional</p>
        <h2>Jornada do dia</h2>
      </div>
      <div className="daily-flow-steps">
        {steps.map(step => (
          <button type="button" className="daily-flow-step" key={step.label} onClick={() => navigate(step.rota)}>
            <span>{step.icon}</span>
            <strong>{step.label}</strong>
            <small>{step.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PermittedDailyFlow({ navigate }) {
  const steps = [
    { label: 'Iniciar uso', hint: 'Retirada do veículo', rota: '/uso-veiculos?aba=registrar', icon: <Route size={17} />, permissao: 'UsosVeiculos.Visualizar' },
    { label: 'Abastecer', hint: 'Nota fiscal e litros', rota: '/abastecimentos?aba=registrar', icon: <Fuel size={17} />, permissao: 'Abastecimentos.Visualizar' },
    { label: 'Finalizar uso', hint: 'KM final e retorno', rota: '/uso-veiculos?aba=registrar&somenteAtivos=true', icon: <ListChecks size={17} />, permissao: 'UsosVeiculos.Visualizar' },
    { label: 'Pendências', hint: 'Manutenções e alertas', rota: '/manutencoes?aba=consultar', icon: <Wrench size={17} />, permissao: 'Manutencoes.Visualizar' }
  ].filter(step => temPermissao(step.permissao));

  if (!steps.length) return null;

  return (
    <section className="daily-flow">
      <div>
        <p className="panel-kicker">Fluxo operacional</p>
        <h2>Jornada do dia</h2>
      </div>
      <div className="daily-flow-steps">
        {steps.map(step => (
          <button type="button" className="daily-flow-step" key={step.label} onClick={() => navigate(step.rota)}>
            <span>{step.icon}</span>
            <strong>{step.label}</strong>
            <small>{step.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);
  const [dashboardView, setDashboardView] = useState(() => lerDashboardView(user));
  const podeCustomizar = podePersonalizarDashboard(user);
  const perfisParaConfigurar = useMemo(() => perfisConfiguraveis(user), [user]);
  const [dash, setDash] = useState(null);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [periodo] = useState('12m');
  const [carregando, setCarregando] = useState(true);
  const [editandoPainel, setEditandoPainel] = useState(false);
  const [perfilAlvoConfig, setPerfilAlvoConfig] = useState('self');
  const [dashboardConfig, setDashboardConfig] = useState(() => carregarConfigDashboard(user, 'self'));
  const trocandoPerfilConfig = useRef(false);

  useEffect(() => {
    function atualizarView(event) {
      setDashboardView(normalizarDashboardView(user, event.detail));
    }

    window.addEventListener(DASHBOARD_VIEW_CHANGE_EVENT, atualizarView);
    return () => window.removeEventListener(DASHBOARD_VIEW_CHANGE_EVENT, atualizarView);
  }, [user]);

  useEffect(() => {
    if (!podeCustomizar) return;
    trocandoPerfilConfig.current = true;
    setDashboardConfig(carregarConfigDashboard(user, perfilAlvoConfig));
  }, [perfilAlvoConfig, podeCustomizar, user]);

  useEffect(() => {
    if (!podeCustomizar) return;
    if (trocandoPerfilConfig.current) {
      trocandoPerfilConfig.current = false;
      return;
    }
    localStorage.setItem(dashboardConfigKey(user, perfilAlvoConfig), JSON.stringify(dashboardConfig));
  }, [dashboardConfig, perfilAlvoConfig, podeCustomizar, user]);

  useEffect(() => {
    let cancelled = false;

    async function carregar() {
      try {
        setCarregando(true);
        const painelPessoal = dashboardView === 'user' || dashboardView === 'operational';
        const motoristaId = painelPessoal ? user?.motoristaId : null;

        if (painelPessoal && !motoristaId) {
          if (cancelled) return;
          setDash({ veiculos: 0, motoristas: 0, abastecimentos: 0, totalLitros: 0, totalValor: 0, ultimos: [] });
          setAbastecimentos([]);
          setVeiculos([]);
          setMotoristas([]);
          setAlertas([]);
          return;
        }

        const params = motoristaId ? { motoristaId } : undefined;
        const [dashRes, abastRes, veiculosRes] = await Promise.all([
          api.get('/dashboard', { params }),
          api.get('/abastecimentos', { params }),
          api.get('/veiculos', { params: { incluirInativos: true } })
        ]);

        if (cancelled) return;
        setDash(dashRes.data);
        setAbastecimentos(Array.isArray(abastRes.data) ? abastRes.data : []);
        setVeiculos(Array.isArray(veiculosRes.data) ? veiculosRes.data : []);

        if (dashboardView === 'hr' && temPermissao('Motoristas.Visualizar')) {
          const motoristasRes = await api.get('/motoristas');
          if (!cancelled) setMotoristas(Array.isArray(motoristasRes.data) ? motoristasRes.data : []);
        } else {
          setMotoristas([]);
        }
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
  }, [dashboardView, user]);

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
  const ultimosPorVeiculo = useMemo(() => ultimoAbastecimentoPorVeiculo(abastecimentos), [abastecimentos]);
  const mediaAbastecimentoPeriodo = totalAbastecimentosPeriodo > 0 ? totalGastoPeriodo / totalAbastecimentosPeriodo : 0;
  const painelPessoal = dashboardView === 'user' || dashboardView === 'operational';
  const veiculosDoPainel = useMemo(() => {
    if (!painelPessoal) return veiculos;
    const ids = new Set(abastecimentos.map(item => item.veiculoId || item.veiculo?.id).filter(Boolean));
    return veiculos.filter(item => ids.has(item.id));
  }, [abastecimentos, painelPessoal, veiculos]);
  const maiorAbastecimento = useMemo(
    () => listaFiltrada.reduce((maior, item) => (toNumber(item.valorTotal) > toNumber(maior?.valorTotal) ? item : maior), null),
    [listaFiltrada]
  );
  const ticketMedioPorLitro = totalLitrosPeriodo > 0 ? totalGastoPeriodo / totalLitrosPeriodo : 0;
  const funcionariosAtivos = motoristas.filter(item => item.ativo !== false).length;
  const funcionariosComUso = useMemo(
    () => new Set(listaFiltrada.map(item => item.motoristaId || item.motorista?.id).filter(Boolean)).size,
    [listaFiltrada]
  );
  const veiculosUsados = useMemo(
    () => new Set(listaFiltrada.map(item => item.veiculoId || item.veiculo?.id).filter(Boolean)).size,
    [listaFiltrada]
  );
  const custoPorFuncionario = funcionariosComUso > 0 ? totalGastoPeriodo / funcionariosComUso : 0;
  const funcionariosResumo = useMemo(() => {
    const base = motoristas.length
      ? motoristas.map(item => ({ id: item.id, nome: item.nome, ativo: item.ativo }))
      : [...new Map(listaFiltrada
        .filter(item => item.motoristaId || item.motorista?.id)
        .map(item => [item.motoristaId || item.motorista?.id, {
          id: item.motoristaId || item.motorista?.id,
          nome: item.motorista?.nome || 'Funcionario',
          ativo: true
        }])).values()];

    return base.map(funcionario => {
      const registros = listaFiltrada.filter(item => (item.motoristaId || item.motorista?.id) === funcionario.id);
      const veiculosFuncionario = new Set(registros.map(item => item.veiculoId || item.veiculo?.id).filter(Boolean)).size;
      return {
        ...funcionario,
        registros: registros.length,
        veiculos: veiculosFuncionario,
        valor: registros.reduce((sum, item) => sum + toNumber(item.valorTotal), 0)
      };
    }).sort((a, b) => b.valor - a.valor).slice(0, 6);
  }, [listaFiltrada, motoristas]);

  const radarOperacional = useMemo(() => {
    const veiculosSemAbastecimento = veiculosDoPainel
      .filter(item => item.ativo !== false)
      .filter(item => {
        const ultimo = ultimosPorVeiculo.get(item.id);
        if (!ultimo) return true;
        const dias = diasDesde(ultimo.item.dataAbastecimento);
        return dias !== null && dias >= 30;
      });

    const abastecimentosAcimaMedia = listaFiltrada.filter(item => (
      mediaAbastecimentoPeriodo > 0 && toNumber(item.valorTotal) > mediaAbastecimentoPeriodo * 1.45
    ));

    return [
      {
        tipo: manutencoesVencidas > 0 ? 'danger' : 'success',
        titulo: 'Manutencoes vencidas',
        valor: number(manutencoesVencidas),
        detalhe: manutencoesVencidas > 0 ? 'Regularizar primeiro' : 'Nenhuma pendencia vencida',
        rota: '/manutencoes?aba=consultar&status=Vencida'
      },
      {
        tipo: manutencoesProximas > 0 ? 'warn' : 'success',
        titulo: 'Manutencoes proximas',
        valor: number(manutencoesProximas),
        detalhe: manutencoesProximas > 0 ? 'Agendar preventivas' : 'Sem preventivas urgentes',
        rota: '/manutencoes?aba=consultar&status=Próxima'
      },
      {
        tipo: veiculosSemAbastecimento.length > 0 ? 'info' : 'success',
        titulo: 'Sem abastecimento recente',
        valor: number(veiculosSemAbastecimento.length),
        detalhe: veiculosSemAbastecimento[0]?.placa || 'Frota com movimentacao recente',
        rota: '/veiculos'
      },
      {
        tipo: abastecimentosAcimaMedia.length > 0 ? 'warn' : 'success',
        titulo: 'Gastos acima da media',
        valor: number(abastecimentosAcimaMedia.length),
        detalhe: abastecimentosAcimaMedia[0]?.veiculo?.placa || 'Sem desvio relevante',
        rota: '/abastecimentos?aba=consultar'
      }
    ];
  }, [
    abastecimentos,
    alertas,
    listaFiltrada,
    manutencoesProximas,
    manutencoesVencidas,
    mediaAbastecimentoPeriodo,
    ultimosPorVeiculo,
    veiculosDoPainel
  ]);

  const hoje = useMemo(
    () => hojeExtensoBrasil(),
    []
  );
  const viewConfig = DASHBOARD_VIEW_CONFIG[dashboardView] || DASHBOARD_VIEW_CONFIG.user;
  const viewMeta = dashboardViewPorId(dashboardView);

  if (carregando && !dash) {
    return (
      <>
        <Header title={viewConfig.title || viewMeta.label} subtitle="Carregando indicadores..." />
        <div className="panel"><p className="text-muted m-0">Carregando...</p></div>
      </>
    );
  }

  const headerMetricsByView = {
    general: [
      { label: 'Manutencao', value: manutencoesVencidas ? `${manutencoesVencidas} vencida(s)` : 'Em controle' },
      { label: 'Litros', value: litrosFmt(dash?.totalLitros ?? 0) },
      { label: 'Gasto total', value: money(dash?.totalValor ?? 0) }
    ],
    finance: [
      { label: 'Gasto no periodo', value: money(totalGastoPeriodo) },
      { label: 'Custo por litro', value: `${eficiencia.toFixed(2).replace('.', ',')} R$/L` },
      { label: 'Maior lancamento', value: money(toNumber(maiorAbastecimento?.valorTotal)) }
    ],
    operational: [
      { label: 'Meus registros', value: number(totalAbastecimentosPeriodo) },
      { label: 'Meus veiculos', value: number(veiculosUsados) },
      { label: 'Meu custo', value: money(totalGastoPeriodo) }
    ],
    hr: [
      { label: 'Funcionarios ativos', value: number(funcionariosAtivos || dash?.motoristas || 0) },
      { label: 'Veiculos usados', value: number(veiculosUsados) },
      { label: 'Custo por funcionario', value: money(custoPorFuncionario) }
    ],
    user: [
      { label: 'Meus abastecimentos', value: number(totalAbastecimentosPeriodo) },
      { label: 'Meus litros', value: litrosFmt(totalLitrosPeriodo) },
      { label: 'Meu gasto total', value: money(totalGastoPeriodo) }
    ]
  };
  const headerMetrics = headerMetricsByView[dashboardView] || headerMetricsByView.user;

  const atalhosPermitidos = DASHBOARD_SHORTCUTS.filter(item => atalhoPermitido(item, perfilAlvoConfig));
  const atalhosBase = dashboardView === 'general'
    ? (dashboardConfig.shortcuts?.length ? dashboardConfig.shortcuts : viewConfig.shortcuts)
    : viewConfig.shortcuts;
  const atalhosSelecionados = atalhosBase
    .map(id => DASHBOARD_SHORTCUTS.find(item => item.id === id))
    .filter(item => item && atalhoPermitido(item, perfilAlvoConfig));
  const atalhosDisponiveis = atalhosPermitidos.filter(item => !dashboardConfig.shortcuts.includes(item.id));

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

  function adicionarAtalho(id) {
    setDashboardConfig(config => {
      const shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts : [];
      const visiveis = shortcuts.filter(shortcutId => {
        const item = DASHBOARD_SHORTCUTS.find(x => x.id === shortcutId);
        return item && atalhoPermitido(item, perfilAlvoConfig);
      });

      if (visiveis.includes(id) || visiveis.length >= 2) return config;
      return normalizarConfig({ ...config, shortcuts: [...visiveis, id] });
    });
  }

  function removerAtalho(id) {
    setDashboardConfig(config => normalizarConfig({
      ...config,
      shortcuts: (config.shortcuts || []).filter(item => item !== id)
    }));
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
        {perfisParaConfigurar.length > 1 && (
          <label className="profile-target-select">
            <span>Perfil editado</span>
            <select value={perfilAlvoConfig} onChange={e => setPerfilAlvoConfig(e.target.value)}>
              {perfisParaConfigurar.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        )}
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

        <div className="customizer-group customizer-group-wide">
          <label>Atalhos da tela inicial</label>
          <div className="shortcut-limit-note">
            {atalhosSelecionados.length}/2 atalhos ativos
          </div>

          <div className="shortcut-builder-list">
            {atalhosSelecionados.map(item => (
              <div className="shortcut-builder-item" key={item.id}>
                <span>{shortcutIcon(item.icon)}</span>
                <strong>{item.label}</strong>
                <button type="button" className="icon-toggle" onClick={() => removerAtalho(item.id)} title="Remover atalho">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {atalhosSelecionados.length === 0 && (
              <div className="shortcut-empty">Nenhum atalho selecionado.</div>
            )}
          </div>

          <div className="shortcut-picker">
            {atalhosDisponiveis.map(item => (
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={atalhosSelecionados.length >= 2}
                key={item.id}
                onClick={() => adicionarAtalho(item.id)}
                type="button"
              >
                {shortcutIcon(item.icon)} {item.label}
              </button>
            ))}
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
              { label: 'Amarelo Ágil', value: '#f8e000' },
              { label: 'Roxo Ágil', value: '#300840' },
              { label: 'Atendimento', value: '#10c040' },
              { label: 'Online', value: '#30a8d8' },
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
    financeOverview: (
      <section className="dashboard-visual-band finance-band" key="financeOverview">
        <VisualMetricCard
          icon={<CircleDollarSign size={24} />}
          label="Gasto no periodo"
          value={money(totalGastoPeriodo)}
          meta={`${number(totalAbastecimentosPeriodo)} abastecimento(s) analisado(s)`}
          tone="money"
        />
        <VisualMetricCard
          icon={<Calculator size={24} />}
          label="Media por abastecimento"
          value={money(mediaAbastecimentoPeriodo)}
          meta={`Maior lancamento: ${money(toNumber(maiorAbastecimento?.valorTotal))}`}
          tone="average"
        />
        <VisualMetricCard
          icon={<Fuel size={24} />}
          label="Custo por litro"
          value={`${ticketMedioPorLitro.toFixed(2).replace('.', ',')} R$/L`}
          meta={`${litrosFmt(totalLitrosPeriodo)} consumidos`}
          tone="fuel"
        />
        <VisualMetricCard
          icon={<TrendingUp size={24} />}
          label="Veiculo com maior gasto"
          value={porVeiculo[0]?.nome || 'Sem dados'}
          meta={porVeiculo[0] ? money(porVeiculo[0].valor) : 'Nenhum valor registrado'}
          tone="rank"
        />
      </section>
    ),
    financeBreakdown: (
      <article className="panel dashboard-visual-panel" key="financeBreakdown">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Detalhamento financeiro</p>
            <h3>Valores por combustivel</h3>
          </div>
          <span className="panel-total">{money(totalGastoPeriodo)}</span>
        </div>
        <div className="finance-split-list">
          {porCombustivel.length ? porCombustivel.map(item => (
            <div className="finance-split-row" key={item.nome}>
              <div>
                <strong>{item.nome}</strong>
                <span>{litrosFmt(item.litros)} em {number(item.count)} registro(s)</span>
              </div>
              <b>{money(item.valor)}</b>
              <i style={{ width: `${Math.max((item.valor / Math.max(totalGastoPeriodo, 1)) * 100, 5)}%` }} />
            </div>
          )) : <div className="chart-empty">Sem valores no periodo.</div>}
        </div>
      </article>
    ),
    hrOverview: (
      <section className="dashboard-visual-band hr-band" key="hrOverview">
        <VisualMetricCard
          icon={<Users size={24} />}
          label="Funcionarios ativos"
          value={number(funcionariosAtivos || dash?.motoristas || 0)}
          meta={`${number(funcionariosComUso)} com abastecimento no periodo`}
          tone="people"
        />
        <VisualMetricCard
          icon={<Truck size={24} />}
          label="Veiculos usados"
          value={number(veiculosUsados)}
          meta={`${number(veiculosAtivos)} veiculo(s) ativos no painel`}
          tone="fleet"
        />
        <VisualMetricCard
          icon={<BadgeCheck size={24} />}
          label="Media por funcionario"
          value={money(custoPorFuncionario)}
          meta="Baseada nos funcionarios com uso"
          tone="average"
        />
        <VisualMetricCard
          icon={<ClipboardList size={24} />}
          label="Registros RH"
          value={number(totalAbastecimentosPeriodo)}
          meta={`${litrosFmt(totalLitrosPeriodo)} acompanhados`}
          tone="rank"
        />
      </section>
    ),
    hrPeopleVehicles: (
      <article className="panel dashboard-visual-panel dashboard-wide-panel" key="hrPeopleVehicles">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Funcionarios e veiculos</p>
            <h3>Uso por funcionario</h3>
          </div>
          <Users size={20} />
        </div>
        <DataTable
          data={funcionariosResumo}
          empty="Sem funcionarios com dados no periodo."
          columns={[
            { key: 'nome', label: 'Funcionario', render: item => item.nome },
            { key: 'status', label: 'Status', render: item => item.ativo === false ? 'Inativo' : 'Ativo' },
            { key: 'veiculos', label: 'Veiculos', render: item => number(item.veiculos) },
            { key: 'registros', label: 'Registros', render: item => number(item.registros) },
            { key: 'valor', label: 'Gasto', render: item => money(item.valor) }
          ]}
        />
      </article>
    ),
    userOperational: (
      <section className="dashboard-visual-band operational-user-band" key="userOperational">
        <VisualMetricCard
          icon={<UserCog size={24} />}
          label="Usuario"
          value={user?.motorista || user?.nome || 'Meu painel'}
          meta="Dados vinculados ao login"
          tone="people"
        />
        <VisualMetricCard
          icon={<Truck size={24} />}
          label="Veiculos usados"
          value={number(veiculosUsados)}
          meta={porVeiculo[0]?.nome || 'Nenhum veiculo no periodo'}
          tone="fleet"
        />
        <VisualMetricCard
          icon={<Fuel size={24} />}
          label="Meus litros"
          value={litrosFmt(totalLitrosPeriodo)}
          meta={`${number(totalAbastecimentosPeriodo)} abastecimento(s)`}
          tone="fuel"
        />
        <VisualMetricCard
          icon={<CircleDollarSign size={24} />}
          label="Meu custo"
          value={money(totalGastoPeriodo)}
          meta={`Media: ${money(mediaAbastecimentoPeriodo)}`}
          tone="money"
        />
      </section>
    ),
    kpis: (
      <section className="industrial-kpi-grid" style={{ '--kpi-columns': dashboardConfig.kpiColumns }} key="kpis">
        <IndustrialKpi icon={<Truck size={21} />} label="Veículos ativos" value={number(veiculosAtivos)} meta="Cadastro da frota" accent="green">
          <div className="health-track"><span style={{ width: `${Math.min(veiculosAtivos, 100)}%` }} /></div>
        </IndustrialKpi>
        <IndustrialKpi icon={<Fuel size={21} />} label="Custo por litro" value={`${eficiencia.toFixed(2).replace('.', ',')} R$/L`} meta="Abastecimentos do período" accent="teal">
          <Sparkline data={sparkLitros} cor="#300840" />
        </IndustrialKpi>
        <IndustrialKpi icon={<ListChecks size={21} />} label="Abastecimentos" value={number(totalAbastecimentosPeriodo)} meta="Registros filtrados" accent="orange">
          <MiniBars values={sparkAbastecimentos} />
        </IndustrialKpi>
      </section>
    ),
    operationalRadar: (
      <section className="operational-radar" key="operationalRadar">
        <div className="radar-head">
          <div>
            <p className="panel-kicker">Prioridades do dia</p>
            <h2>Radar operacional</h2>
          </div>
          <button className="alert-cta" onClick={() => navigate('/relatorios')}>
            Ver relatorios <ChevronRight size={15} />
          </button>
        </div>

        <div className="radar-grid">
          {radarOperacional.map(item => (
            <button className={`radar-card ${item.tipo}`} key={item.titulo} onClick={() => navigate(item.rota)} type="button">
              <span>{item.titulo}</span>
              <strong>{item.valor}</strong>
              <small>{item.detalhe}</small>
            </button>
          ))}
        </div>
      </section>
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

  const orderedIds = dashboardView === 'general'
    ? dashboardConfig.order.filter(id => dashboardConfig.visible[id])
    : viewConfig.sections;

  const orderedSections = orderedIds
    .map(id => sections[id])
    .filter(Boolean);

  return (
    <div className={`dashboard-workspace density-${dashboardConfig.density}`} style={{ '--dashboard-accent': viewConfig.accent || dashboardConfig.accent }}>
      <Header
        title={viewConfig.title || viewMeta.label}
        subtitle={`${viewConfig.subtitle} - ${hoje}`}
        metrics={headerMetrics}
        actions={
          <>
            {atalhosSelecionados.map(item => (
              <button className={`btn ${item.variant}`} key={item.id} onClick={() => navigate(item.rota)}>
                {shortcutIcon(item.icon)} {item.label}
              </button>
            ))}
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

      <PermittedDailyFlow navigate={navigate} />

      <div className="dashboard-widget-grid">
        {orderedSections}
      </div>
    </div>
  );
}
