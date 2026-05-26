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

export function Abastecimentos() {
  const [items, setItems] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [qrImagem, setQrImagem] = useState(null);
  const [qrPreview, setQrPreview] = useState('');
  const [urlConsulta, setUrlConsulta] = useState('');
  const [analisandoQr, setAnalisandoQr] = useState(false);
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

  async function analisarPorUrl(url) {
    if (!url?.trim()) {
      return toast.warning('Envie a foto do QR Code ou informe a URL completa da NFC-e.');
    }

    const fd = new FormData();
    fd.append('urlConsulta', url.trim());

    try {
      const { data } = await abastecimentoService.analisarNota(fd);

      if (!data.sucesso) {
        toast.warning(data.mensagem || 'Não foi possível analisar a NFC-e.');
        return;
      }

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
          `URL NFC-e: ${data.urlConsulta || url}`,
          data.combustivel ? `Combustível: ${data.combustivel}` : '',
          data.placa ? `Placa: ${data.placa}` : '',
          data.motorista ? `Motorista: ${data.motorista}` : ''
        ].filter(Boolean).join('\n') || f.observacao
      }));

      toast.success(data.mensagem || 'NFC-e analisada com sucesso.');
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao analisar NFC-e.');
    }
  }

  async function analisarImagemQrCode(file = qrImagem) {
    if (!file) {
      return toast.warning('Selecione uma foto aproximada somente do QR Code.');
    }

    setAnalisandoQr(true);

    const fd = new FormData();
    fd.append('imagemQrCode', file);

    try {
      const { data } = await abastecimentoService.lerQrCodeImagem(fd);

      if (!data.sucesso || !data.url) {
        toast.warning(data.mensagem || 'Não foi possível ler o QR Code da imagem.');
        return;
      }

      setUrlConsulta(data.url);

      toast.success('QR Code lido pela imagem. Analisando NFC-e...');

      await analisarPorUrl(data.url);
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao ler QR Code da imagem.');
    } finally {
      setAnalisandoQr(false);
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
    setQrImagem(null);
    setQrPreview('');
    setUrlConsulta('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function limparFormulario() {
    setForm(emptyAbastecimento());
    setEditandoId(null);
    setFoto(null);
    setPreview('');
    setQrImagem(null);
    setQrPreview('');
    setUrlConsulta('');
  }

  function fileChange(file) {
    setFoto(file);
    setPreview(file ? URL.createObjectURL(file) : '');
  }

  function qrFileChange(file) {
    setQrImagem(file);
    setQrPreview(file ? URL.createObjectURL(file) : '');

    if (file) {
      analisarImagemQrCode(file);
    }
  }

  return (
    <>
      <Header title="Abastecimentos" subtitle={editandoId ? "Edite os dados do abastecimento selecionado" : "Registre abastecimentos e anexe a nota fiscal"} />

      <form className="card card-soft p-3 mb-4" onSubmit={save}>
        <div className="row">
          <div className="col-md-12 mb-3">
            <label>Foto da nota fiscal para armazenamento</label>
            <input className="form-control" type="file" accept="image/*" required={!editandoId && !foto} onChange={e => fileChange(e.target.files[0])} />
            {editandoId && <small className="text-muted d-block mt-1">Ao editar, envie uma nova foto somente se quiser substituir a nota salva.</small>}
            {preview && <img src={preview} className="preview-img" />}

            <hr className="my-4" />

            <label>Foto aproximada do QR Code da NFC-e</label>
            <input
              className="form-control"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => qrFileChange(e.target.files[0])}
            />

            <small className="text-muted d-block mt-2">
              Tire uma foto focada somente no QR Code. Este será o método principal de leitura.
            </small>

            {qrPreview && <img src={qrPreview} className="preview-img" />}

            <button
              type="button"
              className="btn btn-outline-primary mt-2"
              disabled={analisandoQr || !qrImagem}
              onClick={() => analisarImagemQrCode()}
            >
              {analisandoQr ? 'Lendo QR Code...' : 'Ler QR Code da imagem'}
            </button>

            <label className="mt-3">URL completa da NFC-e</label>
            <div className="input-group">
              <input
                className="form-control"
                placeholder="Campo de emergência: cole a URL completa se a imagem do QR Code falhar"
                value={urlConsulta}
                onChange={e => setUrlConsulta(e.target.value)}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={analisarUrlManual}>
                Analisar URL
              </button>
            </div>

            <small className="text-muted">
              A chave de acesso foi removida porque não substitui a URL completa da NFC-e quando falta o hash de segurança.
            </small>
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
