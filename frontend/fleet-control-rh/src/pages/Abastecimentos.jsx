import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Fuel, Camera, Link2, ScanLine, Filter, RotateCcw, Search, ClipboardList, Plus, Trash2, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Layout/Header';
import { Input } from '../components/Forms/Input';
import { Select } from '../components/Forms/Select';
import { FiltrosSalvos } from '../components/Forms/FiltrosSalvos';
import { AbastecimentosTabela } from '../components/Abastecimentos/AbastecimentosTabela';
import { abastecimentoService } from '../services/abastecimentoService';
import { veiculoService } from '../services/veiculoService';
import { motoristaService } from '../services/motoristaService';
import { emptyAbastecimento } from '../utils/constants';
import { comprimirImagem } from '../utils/comprimirImagem';
import { dataHora, litros as litrosFmt, money, number } from '../utils/formatters';
import { exportarCsv } from '../utils/exportCsv';
import { dataHoraInputBrasil } from '../utils/dataBrasil';

function numeroBr(value, casas = 3) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '';
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function moedaBr(value) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizarCombustiveis(data) {
  const lista = data.combustiveis || data.dadosExtraidos?.combustiveis || [];
  return Array.isArray(lista)
    ? lista.filter(x => x?.tipo || x?.combustivel)
    : [];
}

function descreverCombustiveis(combustiveis) {
  return combustiveis.map(item => {
    const partes = [
      item.tipo || item.combustivel,
      item.litros ? `${numeroBr(item.litros)} L` : '',
      item.valorTotal ? moedaBr(item.valorTotal) : ''
    ].filter(Boolean);

    return partes.join(' - ');
  }).join('; ');
}

function valorNumerico(value) {
  if (value === null || value === undefined || value === '') return 0;
  return Number(String(value).replace(',', '.')) || 0;
}

function novoCombustivel(base = {}) {
  return {
    descricaoCombustivel: base.descricaoCombustivel || base.tipo || base.combustivel || '',
    litros: base.litros ?? '',
    valorUnitario: base.valorUnitario ?? '',
    valorTotal: base.valorTotal ?? ''
  };
}

export function Abastecimentos() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [urlConsulta, setUrlConsulta] = useState('');
  const [analisandoNota, setAnalisandoNota] = useState(false);
  const [resultadoLeitura, setResultadoLeitura] = useState(null);
  const [combustiveis, setCombustiveis] = useState([novoCombustivel()]);
  const [filtro, setFiltro] = useState({ veiculoId: '', motoristaId: '' });
  const [form, setForm] = useState(emptyAbastecimento());
  const [editandoId, setEditandoId] = useState(null);

  // Sub-telas + filtros de visualização
  const [aba, setAba] = useState('registrar');     // 'registrar' | 'consultar'
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });

  useEffect(() => {
    const veiculoId = searchParams.get('veiculoId') || '';
    const motoristaId = searchParams.get('motoristaId') || '';
    const abaUrl = searchParams.get('aba');

    if (abaUrl === 'consultar' || abaUrl === 'registrar') setAba(abaUrl);
    if (veiculoId || motoristaId) {
      setFiltro(f => ({ ...f, veiculoId: veiculoId || f.veiculoId, motoristaId: motoristaId || f.motoristaId }));
      setForm(f => ({ ...f, veiculoId: veiculoId || f.veiculoId, motoristaId: motoristaId || f.motoristaId }));
    }
  }, [searchParams]);

  async function load(f = filtro) {
    const params = {
      veiculoId: f.veiculoId || undefined,
      motoristaId: f.motoristaId || undefined
    };

    const [abastecimentosRes, veiculosRes, motoristasRes] = await Promise.all([
      abastecimentoService.listar(params),
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
    const combustiveis = normalizarCombustiveis(data);
    const combustiveisTexto = descreverCombustiveis(combustiveis);
    const itens = combustiveis.length > 0
      ? combustiveis.map(novoCombustivel)
      : [novoCombustivel({
          descricaoCombustivel: data.combustivel || '',
          litros: data.litros || '',
          valorTotal: data.valorTotal || ''
        })];

    setUrlConsulta(data.urlConsulta || fallbackUrl || '');
    setCombustiveis(itens);

    setResultadoLeitura({
      metodo: data.metodo || 'URL',
      confianca: data.confianca,
      chaveAcesso: data.chaveAcesso,
      urlConsulta: data.urlConsulta || fallbackUrl || '',
      combustiveis
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
        combustiveisTexto ? `Combustiveis: ${combustiveisTexto}` : '',
        data.combustivel ? `Combustível: ${data.combustivel}` : '',
        data.placa ? `Placa: ${data.placa}` : '',
        data.motorista ? `Motorista: ${data.motorista}` : '',
        data.metodo ? `Método leitura: ${data.metodo}` : '',
        data.confianca !== undefined && data.confianca !== null ? `Confiança: ${Math.round(Number(data.confianca) * 100)}%` : ''
      ].filter(Boolean).join('\n') || f.observacao
    }));

    if (combustiveis.length > 1) {
      toast.info(`${combustiveis.length} tipos de combustivel encontrados na NFC-e.`);
    }
  }

  const totaisCombustiveis = useMemo(() => {
    const litros = combustiveis.reduce((s, item) => s + valorNumerico(item.litros), 0);
    const valorTotal = combustiveis.reduce((s, item) => s + valorNumerico(item.valorTotal), 0);

    return {
      litros: litros.toFixed(3),
      valorTotal: valorTotal.toFixed(2)
    };
  }, [combustiveis]);

  const veiculoSelecionado = useMemo(
    () => veiculos.find(x => String(x.id) === String(form.veiculoId)),
    [veiculos, form.veiculoId]
  );

  const motoristaSelecionado = useMemo(
    () => motoristas.find(x => String(x.id) === String(form.motoristaId)),
    [motoristas, form.motoristaId]
  );

  const custoPorLitro = useMemo(() => {
    const litros = valorNumerico(totaisCombustiveis.litros);
    const valorTotal = valorNumerico(totaisCombustiveis.valorTotal);
    return litros > 0 ? valorTotal / litros : 0;
  }, [totaisCombustiveis]);

  const pendenciasRegistro = useMemo(() => {
    const pendencias = [];

    if (!editandoId && !foto) pendencias.push('foto da nota');
    if (!form.veiculoId) pendencias.push('veiculo');
    if (!form.motoristaId) pendencias.push('motorista');
    if (Number(form.kmAtual) <= 0) pendencias.push('KM atual');
    if (combustiveis.some(item => !item.descricaoCombustivel?.trim())) pendencias.push('tipo de combustivel');
    if (combustiveis.some(item => valorNumerico(item.litros) <= 0)) pendencias.push('litros');
    if (combustiveis.some(item => valorNumerico(item.valorTotal) <= 0)) pendencias.push('valor');
    if (form.dataAbastecimento > dataHoraInputBrasil()) pendencias.push('data valida');

    return pendencias;
  }, [combustiveis, editandoId, form, foto]);

  const registroPronto = pendenciasRegistro.length === 0;

  function atualizarCombustivel(index, campo, valor) {
    setCombustiveis(lista => lista.map((item, i) => {
      if (i !== index) return item;

      const atualizado = { ...item, [campo]: valor };
      if ((campo === 'litros' || campo === 'valorUnitario') && atualizado.litros && atualizado.valorUnitario) {
        atualizado.valorTotal = (valorNumerico(atualizado.litros) * valorNumerico(atualizado.valorUnitario)).toFixed(2);
      }

      if (campo === 'valorTotal' && atualizado.litros && atualizado.valorTotal) {
        atualizado.valorUnitario = (valorNumerico(atualizado.valorTotal) / valorNumerico(atualizado.litros)).toFixed(3);
      }

      return atualizado;
    }));
  }

  function adicionarCombustivel() {
    setCombustiveis(lista => [...lista, novoCombustivel()]);
  }

  function removerCombustivel(index) {
    setCombustiveis(lista => lista.length === 1 ? lista : lista.filter((_, i) => i !== index));
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
    if (!combustiveis.length) return toast.warning('Informe ao menos um combustivel.');
    if (combustiveis.some(item => !item.descricaoCombustivel?.trim())) return toast.warning('Informe o tipo de combustivel.');
    if (combustiveis.some(item => valorNumerico(item.litros) <= 0)) return toast.warning('A quantidade de litros deve ser maior que zero.');
    if (combustiveis.some(item => valorNumerico(item.valorTotal) <= 0)) return toast.warning('O valor do combustivel deve ser maior que zero.');
    if (Number(totaisCombustiveis.litros) <= 0) return toast.warning('A quantidade de litros deve ser maior que zero.');
    if (Number(totaisCombustiveis.valorTotal) <= 0) return toast.warning('O valor total deve ser maior que zero.');
    if (form.dataAbastecimento > dataHoraInputBrasil()) return toast.warning('A data do abastecimento não pode ser futura.');

    const fd = new FormData();
    Object.entries({
      ...form,
      litros: totaisCombustiveis.litros,
      valorTotal: totaisCombustiveis.valorTotal
    }).forEach(([key, value]) => fd.append(key, value));
    combustiveis.forEach((item, index) => {
      fd.append(`Combustiveis[${index}].DescricaoCombustivel`, item.descricaoCombustivel.trim());
      fd.append(`Combustiveis[${index}].Litros`, String(valorNumerico(item.litros)));
      fd.append(`Combustiveis[${index}].ValorUnitario`, item.valorUnitario ? String(valorNumerico(item.valorUnitario)) : '');
      fd.append(`Combustiveis[${index}].ValorTotal`, String(valorNumerico(item.valorTotal)));
      fd.append(`Combustiveis[${index}].Ordem`, String(index + 1));
    });
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
    setCombustiveis(
      Array.isArray(item.combustiveis) && item.combustiveis.length > 0
        ? item.combustiveis.map(x => novoCombustivel({
            descricaoCombustivel: x.descricaoCombustivel,
            litros: x.litros,
            valorUnitario: x.valorUnitario,
            valorTotal: x.valorTotal
          }))
        : [novoCombustivel({ litros: item.litros ?? '', valorTotal: item.valorTotal ?? '' })]
    );

    setAba('registrar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function limparFormulario() {
    setForm(emptyAbastecimento());
    setEditandoId(null);
    setFoto(null);
    setPreview('');
    setUrlConsulta('');
    setResultadoLeitura(null);
    setCombustiveis([novoCombustivel()]);
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

  function aplicarFiltroServidor() {
    setAba('consultar');
    load(filtro).catch(() => toast.error('Erro ao filtrar abastecimentos.'));
  }

  function limparConsulta() {
    const novo = { veiculoId: '', motoristaId: '' };
    setFiltro(novo);
    setBusca('');
    setPeriodo({ de: '', ate: '' });
    load(novo).catch(() => toast.error('Erro ao carregar abastecimentos.'));
  }

  function exportar() {
    exportarCsv('abastecimentos', [
      { label: 'Data', value: x => dataHora(x.dataAbastecimento) },
      { label: 'Veiculo', value: x => `${x.veiculo?.modelo || ''} - ${x.veiculo?.placa || ''}` },
      { label: 'Motorista', value: x => x.motorista?.nome || '' },
      { label: 'Posto', value: x => x.posto || '' },
      { label: 'KM', value: x => number(x.kmAtual) },
      { label: 'Litros', value: x => litrosFmt(x.litros) },
      { label: 'Valor', value: x => money(x.valorTotal) },
      { label: 'Nota', value: x => x.temFoto ? 'Sim' : '' }
    ], itemsFiltrados);
  }

  /* Refino client-side sobre o que já veio do servidor (busca + intervalo de datas). */
  const itemsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return items.filter(x => {
      if (q) {
        const alvo = `${x.veiculo?.placa || ''} ${x.veiculo?.modelo || ''} ${x.motorista?.nome || ''} ${x.posto || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }

      if (periodo.de || periodo.ate) {
        const dia = String(x.dataAbastecimento || '').slice(0, 10); // YYYY-MM-DD (relógio gravado)
        if (!dia) return false;
        if (periodo.de && dia < periodo.de) return false;
        if (periodo.ate && dia > periodo.ate) return false;
      }

      return true;
    });
  }, [items, busca, periodo]);

  return (
    <>
      <Header
        title="Abastecimentos"
        subtitle={
          aba === 'registrar'
            ? (editandoId ? 'Edite os dados do abastecimento selecionado' : 'Registre abastecimentos e anexe a nota fiscal')
            : 'Consulte, filtre e baixe as notas dos abastecimentos'
        }
        actions={editandoId && aba === 'registrar' && (
          <button type="button" className="btn btn-secondary" onClick={limparFormulario}>Cancelar edição</button>
        )}
      />

      <div className="segmented" style={{ marginBottom: 18 }}>
        <button className={`seg ${aba === 'registrar' ? 'active' : ''}`} onClick={() => setAba('registrar')}>
          Registro
        </button>
        <button className={`seg ${aba === 'consultar' ? 'active' : ''}`} onClick={() => setAba('consultar')}>
          Consulta
        </button>
      </div>

      {/* ───────────────── ABA: REGISTRO ───────────────── */}
      {aba === 'registrar' && (
        <form className="card card-soft p-3 mb-4" onSubmit={save}>
          <h5 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Fuel size={17} /> {editandoId ? 'Editar abastecimento' : 'Novo abastecimento'}
          </h5>

          <div className="row">
            <div className="col-md-12 mb-3">
              <div className="nfce-section">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Camera size={15} /> Foto da nota fiscal inteira
                </div>

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
                    <ScanLine size={16} /> {analisandoNota ? 'Processando NFC-e...' : 'Analisar foto da nota'}
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
                    {resultadoLeitura.combustiveis?.length > 0 && (
                      <>
                        <strong>Combustiveis:</strong> {descreverCombustiveis(resultadoLeitura.combustiveis)}<br />
                      </>
                    )}
                    {resultadoLeitura.urlConsulta && (
                      <>
                        <strong>URL:</strong> {resultadoLeitura.urlConsulta}
                      </>
                    )}
                  </div>
                )}

                <label className="mt-3" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={14} /> URL completa da NFC-e
                </label>
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
            </div>

            <Select label="Veículo" required value={form.veiculoId} onChange={v => setForm({ ...form, veiculoId: v })} items={veiculos} text={x => `${x.modelo} - ${x.placa}`} />
            <Select label="Motorista/Técnico" required value={form.motoristaId} onChange={v => setForm({ ...form, motoristaId: v })} items={motoristas} text={x => x.nome} />
            <Input label="Data" required type="datetime-local" value={form.dataAbastecimento} onChange={v => setForm({ ...form, dataAbastecimento: v })} />
            <Input label="KM atual" required type="number" min="1" value={form.kmAtual} onChange={v => setForm({ ...form, kmAtual: v })} />
            <Input label="Litros totais" required type="number" min="0.001" step="0.001" readOnly value={totaisCombustiveis.litros} onChange={() => {}} />
            <Input label="Valor total" required type="number" min="0.01" step="0.01" readOnly value={totaisCombustiveis.valorTotal} onChange={() => {}} />
            <div className="col-md-12 mb-3">
              <div className="nfce-section">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Fuel size={15} /> Combustiveis da nota
                  </span>
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={adicionarCombustivel}>
                    <Plus size={14} /> Adicionar
                  </button>
                </div>

                {combustiveis.map((item, index) => (
                  <div key={index} className="row align-items-end" style={{ marginTop: 8 }}>
                    <div className="col-md-4 mb-2">
                      <label>Tipo</label>
                      <input
                        className="form-control"
                        value={item.descricaoCombustivel}
                        onChange={e => atualizarCombustivel(index, 'descricaoCombustivel', e.target.value)}
                        placeholder="Ex: ETANOL COMUM"
                        required
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label>Litros</label>
                      <input
                        className="form-control"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.litros}
                        onChange={e => atualizarCombustivel(index, 'litros', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label>Valor unit.</label>
                      <input
                        className="form-control"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.valorUnitario}
                        onChange={e => atualizarCombustivel(index, 'valorUnitario', e.target.value)}
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label>Valor</label>
                      <input
                        className="form-control"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.valorTotal}
                        onChange={e => atualizarCombustivel(index, 'valorTotal', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <button
                        type="button"
                        className="btn btn-outline-danger w-100"
                        onClick={() => removerCombustivel(index)}
                        disabled={combustiveis.length === 1}
                      >
                        <Trash2 size={14} /> Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Input label="Posto" value={form.posto} onChange={v => setForm({ ...form, posto: v })} />
          </div>

          <div className={`registro-resumo ${registroPronto ? 'ready' : 'attention'}`}>
            <div className="registro-resumo-head">
              <div>
                <span>Conferencia rapida</span>
                <strong>{registroPronto ? 'Pronto para salvar' : 'Confira os dados antes de salvar'}</strong>
              </div>
              {registroPronto ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            </div>

            <div className="registro-resumo-grid">
              <div>
                <span>Veiculo</span>
                <strong>{veiculoSelecionado ? `${veiculoSelecionado.modelo} - ${veiculoSelecionado.placa}` : 'Pendente'}</strong>
              </div>
              <div>
                <span>Motorista</span>
                <strong>{motoristaSelecionado?.nome || 'Pendente'}</strong>
              </div>
              <div>
                <span>Litros</span>
                <strong>{litrosFmt(totaisCombustiveis.litros)}</strong>
              </div>
              <div>
                <span>Valor total</span>
                <strong>{money(totaisCombustiveis.valorTotal)}</strong>
              </div>
              <div>
                <span>Custo por litro</span>
                <strong>{custoPorLitro ? `${money(custoPorLitro)}/L` : 'Pendente'}</strong>
              </div>
              <div>
                <span>Pendencias</span>
                <strong>{registroPronto ? 'Nenhuma' : pendenciasRegistro.join(', ')}</strong>
              </div>
            </div>
          </div>

          <label>Observação</label>
          <textarea className="form-control mb-3" rows="3" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />

          <div className="d-flex gap-2">
            <button className="btn btn-success" disabled={!registroPronto}>
              {editandoId ? 'Atualizar Abastecimento' : 'Salvar Abastecimento'}
            </button>

            {editandoId && (
              <button type="button" className="btn btn-secondary" onClick={limparFormulario}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      )}

      {/* ───────────────── ABA: CONSULTA ───────────────── */}
      {aba === 'consultar' && (
        <>
          <div className="card card-soft p-3 mb-3">
            <h5 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Filter size={17} /> Filtros
            </h5>

            <div className="row">
              <Select label="Veículo" value={filtro.veiculoId} onChange={v => setFiltro({ ...filtro, veiculoId: v })} items={veiculos} text={x => `${x.modelo} - ${x.placa}`} />
              <Select label="Motorista" value={filtro.motoristaId} onChange={v => setFiltro({ ...filtro, motoristaId: v })} items={motoristas} text={x => x.nome} />
              <Input label="De" type="date" value={periodo.de} onChange={v => setPeriodo({ ...periodo, de: v })} />
              <Input label="Até" type="date" value={periodo.ate} onChange={v => setPeriodo({ ...periodo, ate: v })} />

              <div className="col-md-12 mb-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Buscar</label>
                <input
                  className="form-control"
                  placeholder="Placa, modelo, motorista ou posto"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>

              <FiltrosSalvos
                storageKey="filtros-abastecimentos"
                value={{ busca, filtro, periodo }}
                onApply={v => {
                  setBusca(v.busca || '');
                  setFiltro(v.filtro || { veiculoId: '', motoristaId: '' });
                  setPeriodo(v.periodo || { de: '', ate: '' });
                }}
              />

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-primary w-100" onClick={aplicarFiltroServidor}>
                  <Filter size={16} /> Filtrar
                </button>
              </div>

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-outline-secondary w-100" onClick={limparConsulta}>
                  <RotateCcw size={16} /> Limpar
                </button>
              </div>

              <div className="col-md-3 d-flex align-items-end mb-3">
                <button type="button" className="btn btn-success w-100" onClick={exportar}>
                  <Download size={16} /> Exportar
                </button>
              </div>
            </div>

            <small className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardList size={14} /> Exibindo {itemsFiltrados.length} de {items.length} abastecimento(s).
              Veículo e motorista filtram no servidor; busca e datas refinam a lista carregada.
            </small>
          </div>

          <div className="card card-soft table-card">
            <AbastecimentosTabela
              items={itemsFiltrados}
              onEditar={editarAbastecimento}
            />
          </div>
        </>
      )}
    </>
  );
}
