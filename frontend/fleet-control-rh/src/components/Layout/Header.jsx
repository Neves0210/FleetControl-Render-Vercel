export function Header({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2>{title}</h2>
      <p className="text-muted mb-0">{subtitle}</p>
    </div>
  );
}
