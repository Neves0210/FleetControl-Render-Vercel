import { Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export function FiltrosSalvos({ storageKey, value, onApply }) {
  const [nome, setNome] = useState('');
  const [selecionado, setSelecionado] = useState('');
  const [itens, setItens] = useState([]);

  useEffect(() => {
    const salvos = JSON.parse(localStorage.getItem(storageKey) || '[]');
    setItens(Array.isArray(salvos) ? salvos : []);
  }, [storageKey]);

  const nomes = useMemo(() => itens.map(x => x.nome), [itens]);

  function persistir(lista) {
    localStorage.setItem(storageKey, JSON.stringify(lista));
    setItens(lista);
  }

  function salvar() {
    const nomeFiltro = nome.trim() || `Filtro ${itens.length + 1}`;
    const lista = [
      ...itens.filter(x => x.nome !== nomeFiltro),
      { nome: nomeFiltro, value }
    ];
    persistir(lista);
    setNome('');
    setSelecionado(nomeFiltro);
  }

  function aplicar(v) {
    setSelecionado(v);
    const item = itens.find(x => x.nome === v);
    if (item) onApply(item.value);
  }

  function remover() {
    if (!selecionado) return;
    persistir(itens.filter(x => x.nome !== selecionado));
    setSelecionado('');
  }

  return (
    <div className="col-md-12 mb-3">
      <label>Filtros salvos</label>
      <div className="row">
        <div className="col-md-4 mb-2">
          <input
            className="form-control"
            placeholder="Nome do filtro"
            value={nome}
            onChange={e => setNome(e.target.value)}
          />
        </div>
        <div className="col-md-4 mb-2">
          <select className="form-select" value={selecionado} onChange={e => aplicar(e.target.value)}>
            <option value="">Selecionar filtro</option>
            {nomes.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="col-md-2 mb-2">
          <button type="button" className="btn btn-outline-primary w-100" onClick={salvar}>
            <Save size={16} /> Salvar
          </button>
        </div>
        <div className="col-md-2 mb-2">
          <button type="button" className="btn btn-outline-danger w-100" onClick={remover} disabled={!selecionado}>
            <Trash2 size={16} /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
