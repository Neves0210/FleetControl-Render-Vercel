import { Inbox } from 'lucide-react';

export function EmptyState({
  icon,
  title = 'Nenhum registro encontrado',
  description = 'Ajuste os filtros ou cadastre um novo item para continuar.'
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{icon || <Inbox size={22} />}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}
