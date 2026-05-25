export function Metric({ title, value }) {
  return (
    <div className="col-md-3">
      <div className="card-soft metric">
        <small>{title}</small>
        <h3>{value}</h3>
      </div>
    </div>
  );
}
