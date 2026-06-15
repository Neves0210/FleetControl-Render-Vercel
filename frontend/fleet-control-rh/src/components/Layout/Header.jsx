import { Search } from 'lucide-react';

export function Header({ title, subtitle, metrics = [], actions }) {
  return (
    <header className="cockpit-header">
      <div className="cockpit-search">
        <Search size={17} />
        <input type="search" placeholder="Pesquisar frota, placa ou operador" aria-label="Pesquisar" />
      </div>

      <div className="cockpit-title-row">
        <div>
          <p className="eyebrow">Fleet operations</p>
          <h1>{title}</h1>
          {subtitle && <span className="cockpit-subtitle">{subtitle}</span>}
        </div>

        {metrics.length > 0 && (
          <div className="cockpit-summary" aria-label="Resumo de performance">
            {metrics.map(metric => (
              <div className="summary-pill" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        )}

        {actions && <div className="cockpit-actions">{actions}</div>}
      </div>
    </header>
  );
}
