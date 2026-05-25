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
import { useQrScanner } from '../hooks/useQrScanner';

export function Abastecimentos() {
  const [items, setItems] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [urlConsulta, setUrlConsulta] = useState('');
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [filtro, setFiltro] = useState({ veiculoId: '', motoristaId: '' });
  const [form, setForm] = useState(emptyAbastecimento());

  const { scannerAberto, abrirScanner, fecharScanner, cameraErro, readerElementId } = useQrScanner({
    onResult: async url => {
      setUrlConsulta(url);
      toast.success('QR Code lido! Analisando NFC-e...');
      await analisarPorUrl(url);
    }
  });

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

  async function abrirLeitorQrCode() {
    try {
      await abrirScanner();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível abrir a câmera. Verifique se o navegador tem permissão e se o site está em HTTPS.');
    }
  }

  async function analisarPorUrl(url) {
    if (!url?.trim()) {
      return toast.warning('Leia o QR Code ou informe o link da NFC-e.');
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

  async function analisar() {
    await analisarPorUrl(urlConsulta);
  }

  async function analisarPorChave(chave) {
    if (!chave || chave.length !== 44) {
      return toast.warning('Informe uma chave de acesso válida com 44 números.');
    }

    const url = `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${chave}|2|1|1`;
    setUrlConsulta(url);
    await analisarPorUrl(url);
  }

  async function save(e) {
    e.preventDefault();

    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => fd.append(key, value));
    if (foto) fd.append('fotoNotaFiscal', foto);

    try {
      await abastecimentoService.criar(fd);
      toast.success('Abastecimento salvo.');
      setForm(emptyAbastecimento());
      setFoto(null);
      setPreview('');
      setUrlConsulta('');
      setChaveAcesso('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar.');
    }
  }

  function fileChange(file) {
    setFoto(file);
    setPreview(file ? URL.createObjectURL(file) : '');
  }

  return (
    <>
      <Header title="Abastecimentos" subtitle="Registre abastecimentos e anexe a nota fiscal" />

      <form className="card card-soft p-3 mb-4" onSubmit={save}>
        <div className="row">
          <div className="col-md-12 mb-3">
            <label>Foto da nota fiscal para armazenamento</label>
            <input className="form-control" type="file" accept="image/*" onChange={e => fileChange(e.target.files[0])} />
            {preview && <img src={preview} className="preview-img" />}

            <label className="mt-3">
              Leitura do QR Code da NFC-e
              <span className="badge bg-primary ms-2" style={{ fontSize: 11 }}>html5-qrcode</span>
            </label>

            <div className="input-group">
              <input className="form-control" placeholder="O link será preenchido automaticamente pelo leitor de QR Code" value={urlConsulta} readOnly />
              <button type="button" className="btn btn-outline-dark" onClick={abrirLeitorQrCode}>Ler QR Code</button>
            </div>

            <small className="text-muted">
              O leitor usa html5-qrcode com a câmera traseira. Em celular, mantenha a nota bem iluminada e permita o acesso à câmera.
            </small>

            <br />

            <button type="button" className="btn btn-outline-primary mt-2" onClick={analisar}>Analisar NFC-e manualmente</button>

            {scannerAberto && (
              <div className="card p-3 mt-3">
                <h5>Leitor de QR Code</h5>
                <div id={readerElementId} style={{ width: '100%', maxWidth: 420 }} />
                {cameraErro && <small className="text-danger mt-2">{cameraErro}</small>}
                <small className="text-muted mt-2">Aponte a câmera para o QR Code da nota fiscal.</small>
                <button type="button" className="btn btn-secondary mt-3" onClick={fecharScanner}>Fechar leitor</button>
              </div>
            )}

            <label className="mt-3">Chave de acesso da NFC-e</label>
            <div className="input-group">
              <input className="form-control" placeholder="Digite os 44 números da chave de acesso" value={chaveAcesso} maxLength={44} onChange={e => setChaveAcesso(e.target.value.replace(/\D/g, ''))} />
              <button type="button" className="btn btn-outline-primary" onClick={() => analisarPorChave(chaveAcesso)}>Analisar pela chave</button>
            </div>
          </div>

          <Select label="Veículo" value={form.veiculoId} onChange={v => setForm({ ...form, veiculoId: v })} items={veiculos} text={x => `${x.modelo} - ${x.placa}`} />
          <Select label="Motorista/Técnico" value={form.motoristaId} onChange={v => setForm({ ...form, motoristaId: v })} items={motoristas} text={x => x.nome} />
          <Input label="Data" type="datetime-local" value={form.dataAbastecimento} onChange={v => setForm({ ...form, dataAbastecimento: v })} />
          <Input label="KM atual" type="number" value={form.kmAtual} onChange={v => setForm({ ...form, kmAtual: v })} />
          <Input label="Litros" value={form.litros} onChange={v => setForm({ ...form, litros: v })} />
          <Input label="Valor total" value={form.valorTotal} onChange={v => setForm({ ...form, valorTotal: v })} />
          <Input label="Posto" value={form.posto} onChange={v => setForm({ ...form, posto: v })} />
        </div>

        <label>Observação</label>
        <textarea className="form-control mb-3" rows="3" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
        <button className="btn btn-success">Salvar Abastecimento</button>
      </form>

      <div className="card card-soft p-3 mb-3">
        <div className="row">
          <Select label="Filtrar veículo" value={filtro.veiculoId} onChange={v => setFiltro({ ...filtro, veiculoId: v })} items={veiculos} text={x => `${x.modelo} - ${x.placa}`} />
          <Select label="Filtrar motorista" value={filtro.motoristaId} onChange={v => setFiltro({ ...filtro, motoristaId: v })} items={motoristas} text={x => x.nome} />
          <div className="col-md-2 d-flex align-items-end mb-3"><button type="button" className="btn btn-primary w-100" onClick={load}>Filtrar</button></div>
        </div>
      </div>

      <div className="card card-soft table-card"><AbastecimentosTabela items={items} /></div>
    </>
  );
}
