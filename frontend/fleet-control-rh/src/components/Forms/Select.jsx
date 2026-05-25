export function Select({ label, value, onChange, items, text }) {
  return (
    <div className="col-md-4 mb-3">
      <label>{label}</label>
      <select className="form-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">Selecione</option>
        {items.map(x => <option key={x.id} value={x.id}>{text(x)}</option>)}
      </select>
    </div>
  );
}
