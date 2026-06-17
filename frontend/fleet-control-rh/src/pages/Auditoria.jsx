import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Download, Filter, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { auditoriaService } from '../services/auditoriaService';
import { usuarioService } from '../services/usuarioService';
import { dataHora } from '../utils/formatters';
import { dataInputBrasil } from '../utils/dataBrasil';

const hoje = dataInputBrasil();

function csvEscape(value) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function baixarCsv(nome, linhas) {
  const conteudo = linhas.map(row => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = nome;
  a.click();

  URL.revokeObjectURL(url);
}

export function Auditoria() {
  const [dados, setDados] = useState({ itens: [], entidades: [], total: 0, limite: 500 });
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState({
    dataInicio: '',
    dataFim: hoje,
    entidade: '',
    usuarioId: '',
    busca: ''
  });
  const [carregando, setCarregando] = useState(true);

  const eventos = dados.itens || [];

  const metricas = useMemo(() => {
    const usuariosUnicos = new Set(eventos.map(x => x.usuarioId || x.usuarioNome).filter(Boolean)).size;
    const entidadesUnicas = new Set(eventos.map(x => x.entidade).filter(Boolean)).size;

    return [
      { label: 'Eventos', value: eventos.length },
      { label: 'Usuários', value: usuariosUnicos },
      { label: 'Entidades', value: entidadesUnicas }
    ];
  }, [eventos]);

  async function carregar(filtros = filtro) {
    const params = {
      dataInicio: filtros.dataInicio || undefined,
      dataFim: filtros.dataFim || undefined,
      entidade: filtros.entidade || undefined,
      usuarioId: filtros.usuarioId || undefined,
      busca: filtros.busca || undefined
    };

    const res = await auditoriaService.listar(params);
    setDados(res.data);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      auditoriaService.listar({ dataFim: hoje }),
      usuarioService.listar()
    ])
      .then(([auditoriaRes, usuariosRes]) => {
        if (cancelled) return;
        if (auditoriaRes.status === 'fulfilled') {
          setDados(auditoriaRes.value.data);
        } else {
          toast.error('Erro ao carregar auditoria.');
        }

        if (usuariosRes.status === 'fulfilled') {
          setUsuarios(usuariosRes.value.data);
        }
      })
      .finally(() => {
        if (!cancelled) setCarregando(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function filtrar(e) {
    e.preventDefault();
    setCarregando(true);

    try {
      await carregar();
    } catch {
      toast.error('Erro ao filtrar auditoria.');
    } finally {
      setCarregando(false);
    }
  }

  async function limparFiltros() {
    const novoFiltro = {
      dataInicio: '',
      dataFim: '',
      entidade: '',
      usuarioId: '',
      busca: ''
    };

    setFiltro(novoFiltro);
    setCarregando(true);

    try {
      await carregar(novoFiltro);
    } catch {
      toast.error('Erro ao carregar auditoria completa.');
    } finally {
      setCarregando(false);
    }
  }

  function exportarCsv() {
    if (!eventos.length) {
      toast.warning('Nenhum evento para exportar.');
      return;
    }

    baixarCsv(`auditoria-fleetcontrol-${dataInputBrasil()}.csv`, [
      ['Quando', 'Quem alterou', 'Ação', 'Entidade', 'ID afetado', 'Resumo'],
      ...eventos.map(x => [
        dataHora(x.criadoEm),
        x.usuarioNome || `Usuario ${x.usuarioId || '-'}`,
        x.acao,
        x.entidade,
        x.entidadeId,
        x.resumo || ''
      ])
    ]);
  }

  return (
    <>
      <Header title="Auditoria" subtitle="Rastreie alterações feitas no sistema" metrics={metricas} />

      <form className="card card-soft p-3 mb-3" onSubmit={filtrar}>
        <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Filter size={17} /> Filtros
        </h5>

        <div className="row">
          <Input
            label="Data inicial"
            type="date"
            value={filtro.dataInicio}
            onChange={v => setFiltro({ ...filtro, dataInicio: v })}
          />

          <Input
            label="Data final"
            type="date"
            value={filtro.dataFim}
            onChange={v => setFiltro({ ...filtro, dataFim: v })}
          />

          <div className="col-md-3 mb-3">
            <label className="form-label">Entidade afetada</label>
            <select className="form-select" value={filtro.entidade} onChange={e => setFiltro({ ...filtro, entidade: e.target.value })}>
              <option value="">Todas</option>
              {(dados.entidades || []).map(entidade => (
                <option key={entidade} value={entidade}>{entidade}</option>
              ))}
            </select>
          </div>

          <div className="col-md-3 mb-3">
            <label className="form-label">Quem alterou</label>
            <select className="form-select" value={filtro.usuarioId} onChange={e => setFiltro({ ...filtro, usuarioId: e.target.value })}>
              <option value="">Todos</option>
              {usuarios.map(usuario => (
                <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
              ))}
            </select>
          </div>

          <div className="col-md-4 mb-3">
            <label className="form-label">Buscar</label>
            <div className="input-group">
              <span className="input-group-text"><Search size={16} /></span>
              <input
                className="form-control"
                placeholder="Ação, usuário, entidade ou resumo"
                value={filtro.busca}
                onChange={e => setFiltro({ ...filtro, busca: e.target.value })}
              />
            </div>
          </div>

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button className="btn btn-primary w-100" disabled={carregando}>
              <Filter size={16} /> Filtrar
            </button>
          </div>

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button type="button" className="btn btn-outline-secondary w-100" onClick={limparFiltros} disabled={carregando}>
              <RotateCcw size={16} /> Todos
            </button>
          </div>

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button type="button" className="btn btn-success w-100" onClick={exportarCsv}>
              <Download size={16} /> CSV
            </button>
          </div>
        </div>
      </form>

      <div className="card card-soft table-card">
        <div className="card-body d-flex justify-content-between align-items-center">
          <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <ShieldCheck size={18} /> Eventos registrados
          </h5>
          <span className="text-muted">
            {eventos.length === dados.limite ? `Exibindo os ${dados.limite} mais recentes` : `${eventos.length} evento(s)`}
          </span>
        </div>

        <table className="table table-hover">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem alterou</th>
              <th>O que foi alterado</th>
              <th>Entidade afetada</th>
              <th>Resumo</th>
            </tr>
          </thead>

          <tbody>
            {eventos.map(evento => (
              <tr key={evento.id}>
                <td>{dataHora(evento.criadoEm)}</td>
                <td>{evento.usuarioNome || `Usuario ${evento.usuarioId || '-'}`}</td>
                <td>{evento.acao}</td>
                <td>
                  <span className="chip chip-info">{evento.entidade}</span>
                  <span className="text-muted ms-2">#{evento.entidadeId}</span>
                </td>
                <td>{evento.resumo || '-'}</td>
              </tr>
            ))}

            {!carregando && eventos.length === 0 && (
              <tr>
                <td colSpan="5" className="text-muted">Nenhum evento de auditoria encontrado.</td>
              </tr>
            )}

            {carregando && (
              <tr>
                <td colSpan="5" className="text-muted">Carregando auditoria...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
