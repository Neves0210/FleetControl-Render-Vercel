import { useState } from 'react';
import { api } from '../../api/api';
import { litros, money, number } from '../../utils/formatters';
import { temPermissao } from '../../utils/permissions';
import { dataHora } from '../../utils/formatters';

export function AbastecimentosTabela({ items, onEditar }) {
  const podeEditar = temPermissao('Abastecimentos.Editar');
  const [fotoUrl, setFotoUrl] = useState(null);
  const [carregando, setCarregando] = useState(null);

  async function verFoto(id) {
    setCarregando(id);
    try {
      const resp = await api.get(`/abastecimentos/${id}/foto`, { responseType: 'blob' });
      const url = URL.createObjectURL(resp.data);
      setFotoUrl(url);
    } catch {
      alert('Não foi possível carregar a foto da nota.');
    } finally {
      setCarregando(null);
    }
  }

  function fecharFoto() {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFotoUrl(null);
  }

  return (
    <>
      <table className="table table-hover">
        <thead>
          <tr>
            <th>Data</th>
            <th>Veículo</th>
            <th>Motorista</th>
            <th>KM</th>
            <th>Litros</th>
            <th>Valor</th>
            <th>Nota</th>
            {podeEditar && <th>Ações</th>}
          </tr>
        </thead>

        <tbody>
          {items.map(x => (
            <tr key={x.id}>
              <td>{dataHora(x.dataAbastecimento)}</td>
              <td>{x.veiculo?.placa}</td>
              <td>{x.motorista?.nome}</td>
              <td>{number(x.kmAtual)}</td>
              <td>{litros(x.litros)}</td>
              <td>{money(x.valorTotal)}</td>
              <td>
                {x.temFoto && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => verFoto(x.id)}
                    disabled={carregando === x.id}
                  >
                    {carregando === x.id ? '...' : 'Ver'}
                  </button>
                )}
              </td>
              {podeEditar && (
                <td>
                  <button type="button" className="btn btn-warning btn-sm" onClick={() => onEditar?.(x)}>
                    Editar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {fotoUrl && (
        <div className="foto-modal" onClick={fecharFoto}>
          <div className="foto-modal-content" onClick={e => e.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-secondary mb-2" onClick={fecharFoto}>
              Fechar
            </button>
            <img src={fotoUrl} alt="Nota fiscal" />
          </div>
        </div>
      )}
    </>
  );
}