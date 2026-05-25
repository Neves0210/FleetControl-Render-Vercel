export function Search({ value, setValue }) {
  return <input className="form-control mb-3" placeholder="Pesquisar..." value={value} onChange={e => setValue(e.target.value)} />;
}
