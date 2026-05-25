export function Input({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  min,
  max,
  step,
  maxLength,
  minLength,
  placeholder,
  readOnly = false
}) {
  return (
    <div className="col-md-2 mb-3">
      <label>
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      <input
        type={type}
        className="form-control"
        value={value ?? ''}
        required={required}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        minLength={minLength}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
