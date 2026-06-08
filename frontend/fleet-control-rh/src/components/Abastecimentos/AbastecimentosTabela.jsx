import { useState } from 'react';
import { Eye, Download, ExternalLink, X, Image as ImageIcon, Pencil } from 'lucide-react';
import { api } from '../../api/api';
import { dataHora, litros, money, number } from '../../utils/formatters';
import { temPermissao } from '../../utils/permissions';

function extDoTipo(tipo) {
  if (!tipo) return 'jpg';
  if (tipo.includes('png')) return 'png';
  if (tipo.includes('webp')) return 'webp';
  return 'jpg';
}

export function AbastecimentosTabela({ items, onEditar }) {
  const podeEditar = temPermissao('Abastecimentos.Editar');
  const [foto, setFoto] = useState(null); // { url, tipo, id }
  const [carregando, setCarregando] = useState(null);
  const [zoom, setZoom] = useState(false);

  async function verFoto(id) {
    setCarregando(id);
    try {
      const resp = await api.get(`/abastecimentos/${id}/foto`, { responseType: 'blob' });
      const url = URL.createObjectURL(resp.data);
      setFoto({ url, tipo: resp.data.type, id });
      setZoom(false);
    } catch {
      alert('Não foi possível carregar a foto da nota.');
    } finally {
      setCarregando(null);
    }
  }

  function fecharFoto() {
    if (foto?.url) URL.revokeObjectURL(foto.url);
    setFoto(null);
    setZoom(false);
  }

  function baixarFoto() {
    if (!foto?.url) return;
    const a = document.createElement('a');
    a.href = foto.url;
    a.download = `nota-fiscal-${foto.id}.${extDoTipo(foto.tipo)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function abrirNovaAba() {
    if (foto?.url) window.open(foto.url, '_blank', 'noopener');
  }

  const temItens = Array.isArray(items) && items.length > 0;

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
          {temItens ? (
            items.map(x => (
              <tr key={x.id}>
                <td>{dataHora(x.dataAbastecimento)}</td>
                <td>{x.veiculo?.placa}</td>
                <td>{x.motorista?.nome}</td>
                <td>{number(x.kmAtual)}</td>
                <td>{litros(x.litros)}</td>
                <td>{money(x.valorTotal)}</td>
                <td>
                  {x.temFoto ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => verFoto(x.id)}
                      disabled={carregando === x.id}
                    >
                      {carregando === x.id ? '...' : (<><Eye size={14} /> Ver</>)}
                    </button>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                {podeEditar && (
                  <td>
                    <button type="button" className="btn btn-warning btn-sm" onClick={() => onEditar?.(x)}>
                      <Pencil size={14} /> Editar
                    </button>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={podeEditar ? 8 : 7} className="text-muted" style={{ textAlign: 'center', padding: '28px 12px' }}>
                Nenhum abastecimento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {foto && (
        <div className="foto-modal" onClick={fecharFoto}>
          <div
            className="foto-modal-content"
            onClick={e => e.stopPropagation()}
            style={{ alignItems: 'stretch', gap: 10, width: zoom ? '90vw' : 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14 }}>
                <ImageIcon size={16} /> Nota fiscal #{foto.id}
              </strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={abrirNovaAba}>
                  <ExternalLink size={14} /> Abrir
                </button>
                <button type="button" className="btn btn-sm btn-success" onClick={baixarFoto}>
                  <Download size={14} /> Baixar
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={fecharFoto}>
                  <X size={14} /> Fechar
                </button>
              </div>
            </div>

            <div style={{ overflow: 'auto', maxHeight: '80vh', display: 'flex', justifyContent: 'center' }}>
              <img
                src={foto.url}
                alt={`Nota fiscal ${foto.id}`}
                onClick={() => setZoom(z => !z)}
                style={
                  zoom
                    ? { maxWidth: 'none', width: 'auto', cursor: 'zoom-out' }
                    : { maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', cursor: 'zoom-in' }
                }
              />
            </div>

            <small className="text-muted">Clique na imagem para {zoom ? 'reduzir' : 'ampliar'}.</small>
          </div>
        </div>
      )}
    </>
  );
}
