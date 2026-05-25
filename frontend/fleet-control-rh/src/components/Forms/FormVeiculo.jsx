import { Input } from './Input';

export function FormVeiculo({ form, setForm, save, edit }) {
  return (
    <form className="card card-soft p-3 mb-3" onSubmit={save}>
      <div className="row">
        <Input label="Modelo" required value={form.modelo} onChange={v => setForm({ ...form, modelo: v })} />
        <Input label="Placa" required maxLength={8} value={form.placa} onChange={v => setForm({ ...form, placa: v.toUpperCase() })} />
        <Input label="KM" required type="number" min="0" value={form.kmAtual} onChange={v => setForm({ ...form, kmAtual: +v })} />

        <div className="col-md-2 mb-3">
          <label>
            Combustível
            <span className="text-danger ms-1">*</span>
          </label>
          <select
            className="form-select"
            required
            value={form.tipoCombustivel}
            onChange={e => setForm({ ...form, tipoCombustivel: +e.target.value })}
          >
            <option value="1">Gasolina</option>
            <option value="2">Etanol</option>
            <option value="3">Diesel</option>
            <option value="4">Flex</option>
          </select>
        </div>

        <div className="col-md-2 mb-3 d-flex align-items-end">
          <button className="btn btn-success w-100">{edit ? 'Atualizar' : 'Cadastrar'}</button>
        </div>
      </div>
    </form>
  );
}
