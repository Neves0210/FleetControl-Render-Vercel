import { money } from '../../utils/formatters';

/* ── Sparkline (mini gráfico de linha nos KPIs) ─────────────────────────── */
export function Sparkline({ data = [], cor = '#300840' }) {
  if (!data.length) return null;
  const w = 70, h = 24;
  const max = Math.max(...data), min = Math.min(...data);
  const denom = Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => {
    const x = (i / denom) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="kpi-spark" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Gráfico de área: gasto no período ───────────────────────────────────── */
export function AreaChart({ serie = [] }) {
  if (!serie.length) {
    return <div className="chart-empty">Sem dados no período.</div>;
  }

  const w = 520, h = 220, padL = 48, padR = 16, padT = 18, padB = 28;
  const max = Math.max(...serie.map(s => s.valor)) * 1.15 || 1;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const denom = Math.max(serie.length - 1, 1);
  const x = i => padL + (i / denom) * innerW;
  const y = v => padT + innerH - (v / max) * innerH;

  const linePath = serie.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.valor).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(serie.length - 1).toFixed(1)} ${padT + innerH} L ${x(0).toFixed(1)} ${padT + innerH} Z`;
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="fcrAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const gy = padT + (i / ticks) * innerH;
        const val = max - (i / ticks) * max;
        return (
          <g key={i}>
            <line x1={padL} y1={gy} x2={w - padR} y2={gy} className="grid-line" />
            <text x={padL - 8} y={gy + 3} className="axis-label" textAnchor="end">
              {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#fcrAreaFill)" className="area-grow" />
      <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" className="line-grow" />

      {serie.map((s, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(s.valor)} r="3.5" fill="#fff"
            stroke="var(--color-primary)" strokeWidth="2" className="dot-pop"
            style={{ animationDelay: `${0.5 + i * 0.06}s` }} />
          <text x={x(i)} y={h - 8} className="axis-label" textAnchor="middle">{s.rotulo}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Barras horizontais: gasto por veículo ───────────────────────────────── */
export function BarsVeiculo({ dados = [] }) {
  if (!dados.length) return <div className="chart-empty">Sem dados no período.</div>;
  const max = Math.max(...dados.map(d => d.valor)) || 1;

  return (
    <div className="bars">
      {dados.map((d, i) => (
        <div className="bar-row" key={d.placa + i}>
          <span className="bar-label">{d.placa}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ '--w': `${(d.valor / max) * 100}%`, animationDelay: `${0.15 + i * 0.08}s` }} />
          </div>
          <span className="bar-value">{money(d.valor)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Donut: distribuição de combustível ──────────────────────────────────── */
export function Donut({ dados = [], centerNum = '0', centerLbl = 'litros' }) {
  const r = 52, c = 2 * Math.PI * r;
  const validos = dados.filter(d => d.pct > 0);
  let acc = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut">
        <circle cx="70" cy="70" r={r} className="donut-bg" />
        {validos.map((d, i) => {
          const len = (d.pct / 100) * c;
          const seg = (
            <circle key={d.nome} cx="70" cy="70" r={r} fill="none"
              stroke={d.cor} strokeWidth="16" strokeLinecap="round"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc} className="donut-seg"
              style={{ animationDelay: `${0.2 + i * 0.12}s` }} />
          );
          acc += len;
          return seg;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-center-num">{centerNum}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-center-lbl">{centerLbl}</text>
      </svg>

      <div className="donut-legend">
        {dados.map(d => (
          <div className="legend-item" key={d.nome}>
            <span className="legend-dot" style={{ background: d.cor }} />
            <span className="legend-name">{d.nome}</span>
            <span className="legend-pct">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
