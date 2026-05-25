import { STATIC_BASE_URL } from '../../api/api';
import { litros, money, number } from '../../utils/formatters';
import { temPermissao } from '../../utils/permissions';

export function AbastecimentosTabela({ items, onEditar }) {
  const podeEditar = temPermissao('Abastecimentos.Editar');

  return (
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
            <td>{new Date(x.dataAbastecimento).toLocaleString('pt-BR')}</td>
            <td>{x.veiculo?.placa}</td>
            <td>{x.motorista?.nome}</td>
            <td>{number(x.kmAtual)}</td>
            <td>{litros(x.litros)}</td>
            <td>{money(x.valorTotal)}</td>
            <td>
              {x.fotoNotaFiscalPath && (
                <a href={`${STATIC_BASE_URL}${x.fotoNotaFiscalPath}`} target="_blank" rel="noreferrer">
                  Ver
                </a>
              )}
            </td>
            {podeEditar && (
              <td>
                <button
                  type="button"
                  className="btn btn-warning btn-sm"
                  onClick={() => onEditar?.(x)}
                >
                  Editar
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
