import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { Select } from '../components/Forms/Select';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { abastecimentoService } from '../services/abastecimentoService';
import { veiculoService } from '../services/veiculoService';
import { motoristaService } from '../services/motoristaService';
import { emptyAbastecimento } from '../utils/constants';
import { comprimirImagem } from '../utils/comprimirImagem';

export function Abastecimentos() {
  const [items, setItems] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [urlConsulta, setUrlConsulta] = useState('');
  const [analisandoNota, setAnalisandoNota] = useState(false);
  const [resultadoLeitura, setResultadoLeitura] = useState(null);
  const [filtro, setFiltro] = useState({ veiculoId: '', motoristaId: '' });
  const [form, setForm] = useState(emptyAbastecimento());
  const [editandoId, setEditandoId] = useState(null);

  async function load() {
    const [abastecimentosRes, veiculosRes, motoristasRes] = await Promise.all([
      abastecimentoService.listar(filtro),
      veiculoService.listar(),
      motoristaService.listar()
    ]);

    setItems(abastecimentosRes.data);
    setVeiculos(veiculosRes.data);
    setMotoristas(motoristasRes.data);
  }

  useEffect(() => {
    load().catch(() => toast.error('Erro ao carregar abastecimentos.'));
  }, []);

  useEffect(() => {
  abastecimentoService.aquecerLeitor().catch(() => {}); // acorda o leitor em background
}, []);

  function aplicarDadosNfce(data, fallbackUrl = '') {
    setUrlConsulta(data.urlConsulta || fallbackUrl || '');

    setResultadoLeitura({
      metodo: data.metodo || 'URL',
      confianca: data.confianca,
      chaveAcesso: data.chaveAcesso,
      urlConsulta: data.urlConsulta || fallbackUrl || ''
    });

    setForm(f => ({
      ...f,
      veiculoId: data.veiculoId || f.veiculoId,
      motoristaId: data.motoristaId || f.motoristaId,
      kmAtual: data.kmAtual || f.kmAtual,
      litros: data.litros || f.litros,
      valorTotal: data.valorTotal || f.valorTotal,
      posto: data.posto || f.posto,
      dataAbastecimento: data.dataAbastecimento ? data.dataAbastecimento.substring(0, 16) : f.dataAbastecimento,
      observacao: [
        data.urlConsulta || fallbackUrl ? `URL NFC-e: ${data.urlConsulta || fallbackUrl}` : '',
        data.chaveAcesso ? `Chave NFC-e: ${data.chaveAcesso}` : '',
        data.combustivel ? `Combustível: ${data.combustivel}` : '',
        data.placa ? `Placa: ${data.placa}` : '',
        data.motorista ? `Motorista: ${data.motorista}` : '',
        data.metodo ? `Método leitura: ${data.metodo}` : '',
        data.confianca !== undefined && data.confianca !== null ? `Confiança: ${Math.round(Number(data.confianca) * 100)}%` : ''
      ].filter(Boolean).join('\n') || f.observacao
    }));
  }

  async function analisarPorUrl(url) {
    if (!url?.trim()) {
      return toast.warning('Informe a URL completa da NFC-e.');
    }

    const fd = new FormData();
    fd.append('urlConsulta', url.trim());

    try {
      const { data } = await abastecimentoService.analisarNota(fd);

      if (!data.sucesso) {
        toast.warning(data.mensagem || 'Não foi possível analisar a NFC-e.');
        return;
      }

      aplicarDadosNfce(data, url);

      toast.success(data.mensagem || 'NFC-e analisada com sucesso.');
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao analisar NFC-e.');
    }
  }

  async function analisarFotoNotaInteira(file = foto) {
    if (!file) {
      return toast.warning('Tire ou selecione a foto da nota fiscal inteira.');
    }

    setAnalisandoNota(true);
    setResultadoLeitura(null);

    const fd = new FormData();
    fd.append('fotoNotaFiscal', file);

    try {
      const { data } = await abastecimentoService.analisarNotaImagemRobusta(fd);

      if (!data.sucesso) {
        toast.warning(data.mensagem || 'Não foi possível ler a NFC-e pela imagem.');
        return;
      }

      aplicarDadosNfce(data);

      toast.success(`NFC-e lida com sucesso via ${data.metodo || 'imagem'}.`);
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao processar a foto da nota.');
    } finally {
      setAnalisandoNota(false);
    }
  }

  async function analisarUrlManual() {
    await analisarPorUrl(urlConsulta);
  }

  async function save(e) {
    e.preventDefault();

    if (!editandoId && !foto) return toast.warning('A foto da nota fiscal é obrigatória.');
    if (!form.veiculoId) return toast.warning('Selecione um veículo.');
    if (!form.motoristaId) return toast.warning('Selecione um motorista/técnico.');
    if (Number(form.kmAtual) <= 0) return toast.warning('O KM atual deve ser maior que zero.');
    if (Number(form.litros) <= 0) return toast.warning('A quantidade de litros deve ser maior que zero.');
    if (Number(form.valorTotal) <= 0) return toast.warning('O valor total deve ser maior que zero.');
    if (new Date(form.dataAbastecimento) > new Date()) return toast.warning('A data do abastecimento não pode ser futura.');

    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => fd.append(key, value));
    if (foto) fd.append('fotoNotaFiscal', foto);

    try {
      if (editandoId) {
        await abastecimentoService.editar(editandoId, fd);
        toast.success('Abastecimento atualizado.');
      } else {
        await abastecimentoService.criar(fd);
        toast.success('Abastecimento salvo.');
      }

      limparFormulario();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar.');
    }
  }

  function editarAbastecimento(item) {
    setEditandoId(item.id);
    setForm({
      veiculoId: item.veiculoId || '',
      motoristaId: item.motoristaId || '',
      dataAbastecimento: item.dataAbastecimento ? item.dataAbastecimento.substring(0, 16) : emptyAbastecimento().dataAbastecimento,
      kmAtual: item.kmAtual ?? '',
      litros: item.litros ?? '',
      valorTotal: item.valorTotal ?? '',
      posto: item.posto ?? '',
      observacao: item.observacao ?? ''
    });

    setFoto(null);
    setPreview('');
    setUrlConsulta('');
    setResultadoLeitura(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function limparFormulario() {
    setForm(emptyAbastecimento());
    setEditandoId(null);
    setFoto(null);
    setPreview('');
    setUrlConsulta('');
    setResultadoLeitura(null);
  }

  async function fileChange(file) {
    if (!file) {
      setFoto(null);
      setPreview('');
      return;
    }

    const comprimida = await comprimirImagem(file);

    setFoto(comprimida);
    setPreview(URL.createObjectURL(comprimida));

    if (!editandoId) {
      analisarFotoNotaInteira(comprimida);
    }
  }

  return (
    <>
      <Header title="Abastecimentos" subtitle={editandoId ? "Edite os dados do abastecimento selecionado" : "Registre abastecimentos e anexe a nota fiscal"} />

      <form className="card card-soft p-3 mb-4" onSubmit={save}>
        <div className="row">
          <div className="col-md-12 mb-3">
            <label>Foto da nota fiscal inteira</label>

            <input
              className="form-control"
              type="file"
              accept="image/*"
              capture="environment"
              required={!editandoId && !foto}
              onChange={e => fileChange(e.target.files[0])}
            />

            <small className="text-muted d-block mt-2">
              Tire a foto da nota inteira. O backend vai localizar o QR Code, tratar a imagem e tentar OCR automaticamente.
            </small>

            {editandoId && (
              <small className="text-muted d-block mt-1">
                Ao editar, envie uma nova foto somente se quiser substituir a nota salva.
              </small>
            )}

            {preview && <img src={preview} className="preview-img" />}

            <div className="mt-2 d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={analisandoNota || !foto}
                onClick={() => analisarFotoNotaInteira()}
              >
                {analisandoNota ? 'Processando NFC-e...' : 'Analisar foto da nota'}
              </button>
            </div>

            {resultadoLeitura && (
              <div className="alert alert-info mt-3">
                <strong>Método:</strong> {resultadoLeitura.metodo || '-'}<br />
                {resultadoLeitura.confianca !== undefined && resultadoLeitura.confianca !== null && (
                  <>
                    <strong>Confiança:</strong> {Math.round(Number(resultadoLeitura.confianca) * 100)}%<br />
                  </>
                )}
                {resultadoLeitura.chaveAcesso && (
                  <>
                    <strong>Chave:</strong> {resultadoLeitura.chaveAcesso}<br />
                  </>
                )}
                {resultadoLeitura.urlConsulta && (
                  <>
                    <strong>URL:</strong> {resultadoLeitura.urlConsulta}
                  </>
                )}
              </div>
            )}

            <label className="mt-3">URL completa da NFC-e</label>
            <div className="input-group">
              <input
                className="form-control"
                placeholder="Emergência: cole a URL completa se a imagem falhar"
                value={urlConsulta}
                onChange={e => setUrlConsulta(e.target.value)}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={analisarUrlManual}>
                Analisar URL
              </button>
            </div>
          </div>

          <Select label="Veículo" required value={form.veiculoId} onChange={v => setForm({ ...form, veiculoId: v })} items={veiculos} text={x => `${x.modelo} - ${x.placa}`} />
          <Select label="Motorista/Técnico" required value={form.motoristaId} onChange={v => setForm({ ...form, motoristaId: v })} items={motoristas} text={x => x.nome} />
          <Input label="Data" required type="datetime-local" value={form.dataAbastecimento} onChange={v => setForm({ ...form, dataAbastecimento: v })} />
          <Input label="KM atual" required type="number" min="1" value={form.kmAtual} onChange={v => setForm({ ...form, kmAtual: v })} />
          <Input label="Litros" required type="number" min="0.001" step="0.001" value={form.litros} onChange={v => setForm({ ...form, litros: v })} />
          <Input label="Valor total" required type="number" min="0.01" step="0.01" value={form.valorTotal} onChange={v => setForm({ ...form, valorTotal: v })} />
          <Input label="Posto" value={form.posto} onChange={v => setForm({ ...form, posto: v })} />
        </div>

        <label>Observação</label>
        <textarea className="form-control mb-3" rows="3" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />

        <div className="d-flex gap-2">
          <button className="btn btn-success">
            {editandoId ? 'Atualizar Abastecimento' : 'Salvar Abastecimento'}
          </button>

          {editandoId && (
            <button type="button" className="btn btn-secondary" onClick={limparFormulario}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <div className="card card-soft p-3 mb-3">
        <div className="row">
          <Select label="Filtrar veículo" value={filtro.veiculoId} onChange={v => setFiltro({ ...filtro, veiculoId: v })} items={veiculos} text={x => `${x.modelo} - ${x.placa}`} />
          <Select label="Filtrar motorista" value={filtro.motoristaId} onChange={v => setFiltro({ ...filtro, motoristaId: v })} items={motoristas} text={x => x.nome} />
          <div className="col-md-2 d-flex align-items-end mb-3"><button type="button" className="btn btn-primary w-100" onClick={load}>Filtrar</button></div>
        </div>
      </div>

      <div className="card card-soft table-card"><AbastecimentosTabela items={items} onEditar={editarAbastecimento} /></div>
    </>
  );
}
