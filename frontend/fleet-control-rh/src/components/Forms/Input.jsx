export function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div className="col-md-2 mb-3">
      <label>{label}</label>
      <input type={type} className="form-control" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
