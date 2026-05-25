export function Select({ label, value, onChange, items, text, required = false }) {
  return (
    <div className="col-md-4 mb-3">
      <label>
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      <select
        className="form-select"
        value={value ?? ''}
        required={required}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Selecione</option>
        {items.map(x => <option key={x.id} value={x.id}>{text(x)}</option>)}
      </select>
    </div>
  );
}
