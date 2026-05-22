import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BarChart3, Car, Fuel, LayoutDashboard, LogOut, Users, UserCog } from 'lucide-react';
import './style.css';
import { BrowserQRCodeReader } from '@zxing/browser';


const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const STATIC_BASE_URL = API_BASE_URL.replace('/api', '');

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

const emptyAbastecimento = () => ({
  veiculoId: '',
  motoristaId: '',
  dataAbastecimento: new Date().toISOString().slice(0, 16),
  kmAtual: '',
  litros: '',
  valorTotal: '',
  posto: '',
  observacao: ''
});

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const text = String(value)
    .replace('R$', '')
    .replace(/\s/g, '');

  if (text.includes(',') && text.includes('.')) {
    return Number(text.replace(/\./g, '').replace(',', '.'));
  }

  if (text.includes(',')) {
    return Number(text.replace(',', '.'));
  }

  return Number(text);
}

function money(value) {
  return toNumber(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function number(value) {
  return toNumber(value).toLocaleString('pt-BR');
}

function litros(value) {
  return toNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getPermissoes() {
  const user = getUser();
  return user?.permissoes || [];
}

function temPermissao(permissao) {
  return getPermissoes().includes(permissao);
}

function podeVerTela(permissao) {
  return temPermissao(permissao);
}

function Layout({ children }) {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">FleetControlRH</div>

        {podeVerTela('Dashboard.Visualizar') && (
          <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
        )}

        {podeVerTela('Veiculos.Visualizar') && (
          <NavItem to="/veiculos" icon={<Car size={18} />} label="Veículos" />
        )}

        {podeVerTela('Motoristas.Visualizar') && (
          <NavItem to="/motoristas" icon={<Users size={18} />} label="Motoristas" />
        )}

        {podeVerTela('Abastecimentos.Visualizar') && (
          <NavItem to="/abastecimentos" icon={<Fuel size={18} />} label="Abastecimentos" />
        )}

        {podeVerTela('Relatorios.Visualizar') && (
          <NavItem to="/relatorios" icon={<BarChart3 size={18} />} label="Relatórios" />
        )}

        {podeVerTela('Usuarios.Visualizar') && (
          <NavItem to="/usuarios" icon={<UserCog size={18} />} label="Usuários" />
        )}

        {podeVerTela('Usuarios.Visualizar') && user?.perfil === 1 && (
          <NavItem to="/usuarios" icon={<UserCog size={18} />} label="Usuários" />
        )}
      </aside>

      <section className="content">
        <div className="topbar">
          <div>
            <strong>{user?.nome}</strong>
            <div className="text-muted small">{user?.email}</div>
          </div>

          <button className="btn btn-outline-danger btn-sm" onClick={logout}>
            <LogOut size={16} /> Sair
          </button>
        </div>

        {children}
      </section>

      <ToastContainer position="top-right" autoClose={2500} />
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink to={to} end>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function PermissionRoute({ permissao, children }) {
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" />;
  }

  if (!temPermissao(permissao)) {
    return (
      <Layout>
        <div className="alert alert-danger">
          Você não tem permissão para acessar esta tela.
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}

function PrivateRoute({ children }) {
  return localStorage.getItem('token')
    ? <Layout>{children}</Layout>
    : <Navigate to="/login" />;
}

function Login() {
  const [email, setEmail] = useState('admin@fleet.local');
  const [senha, setSenha] = useState('123456');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, senha });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));

      navigate('/');
    } catch {
      toast.error('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card p-4 login-card" onSubmit={submit}>
        <h3 className="mb-1">FleetControlRH</h3>
        <p className="text-muted">Controle de abastecimentos</p>

        <label>E-mail</label>
        <input
          className="form-control mb-3"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <label>Senha</label>
        <input
          className="form-control mb-3"
          type="password"
          value={senha}
          onChange={e => setSenha(e.target.value)}
        />

        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <small className="text-muted mt-3">
          Admin padrão: admin@fleet.local / 123456
        </small>

        <ToastContainer position="top-right" autoClose={2500} />
      </form>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [abastecimentos, setAbastecimentos] = useState([]);

  useEffect(() => {
    let cancelled = false;

    api.get('/dashboard')
      .then(r => {
        if (!cancelled) setData(r.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar dashboard.');
      });

    api.get('/abastecimentos')
      .then(r => {
        if (!cancelled) setAbastecimentos(r.data.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar abastecimentos.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <p>Carregando...</p>;

  return (
    <>
      <h2 className="mb-3">Dashboard RH</h2>

      <div className="row g-3 mb-4">
        <Metric title="Veículos ativos" value={data.veiculos} />
        <Metric title="Motoristas ativos" value={data.motoristas} />
        <Metric title="Abastecimentos" value={data.abastecimentos} />
        <Metric title="Litros totais" value={number(data.totalLitros)} />
        <Metric title="Gasto total" value={money(data.totalValor)} />
      </div>

      <div className="card card-soft table-card">
        <div className="card-body">
          <h5>Últimos abastecimentos</h5>
        </div>

        <AbastecimentosTabela items={abastecimentos} />
      </div>
    </>
  );
}

function Metric({ title, value }) {
  return (
    <div className="col-md-3">
      <div className="card-soft metric">
        <small>{title}</small>
        <h3>{value}</h3>
      </div>
    </div>
  );
}

function Veiculos() {
  const [items, setItems] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState({
    modelo: '',
    placa: '',
    kmAtual: 0,
    tipoCombustivel: 2,
    ativo: true
  });
  const [edit, setEdit] = useState(null);

  const filtered = useMemo(() => {
    return items.filter(x =>
      `${x.modelo}${x.placa}`.toLowerCase().includes(busca.toLowerCase())
    );
  }, [items, busca]);

  async function load() {
    const r = await api.get('/veiculos');
    setItems(r.data);
  }

  useEffect(() => {
    let cancelled = false;

    api.get('/veiculos')
      .then(r => {
        if (!cancelled) setItems(r.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar veículos.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e) {
    e.preventDefault();

    try {
      if (edit) {
        await api.put(`/veiculos/${edit}`, form);
      } else {
        await api.post('/veiculos', form);
      }

      toast.success('Veículo salvo.');

      setForm({
        modelo: '',
        placa: '',
        kmAtual: 0,
        tipoCombustivel: 2,
        ativo: true
      });

      setEdit(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar.');
    }
  }

  async function del(id) {
    if (!confirm('Remover veículo?')) return;

    try {
      await api.delete(`/veiculos/${id}`);
      toast.success('Veículo removido.');
      await load();
    } catch {
      toast.error('Erro ao remover veículo.');
    }
  }

  return (
    <>
      <Header title="Veículos" subtitle="Cadastro e manutenção da frota" />

      <FormVeiculo form={form} setForm={setForm} save={save} edit={edit} />

      <Search value={busca} setValue={setBusca} />

      <div className="card card-soft table-card">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Placa</th>
              <th>KM atual</th>
              <th>Combustível</th>
              <th width="180"></th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(x => (
              <tr key={x.id}>
                <td>{x.modelo}</td>
                <td><span className="badge-soft">{x.placa}</span></td>
                <td>{number(x.kmAtual)}</td>
                <td>{combustivel(x.tipoCombustivel)}</td>
                <td>
                  <button
                    className="btn btn-sm btn-warning me-2"
                    onClick={() => {
                      setEdit(x.id);
                      setForm(x);
                    }}
                  >
                    Editar
                  </button>

                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => del(x.id)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function combustivel(v) {
  return ({ 1: 'Gasolina', 2: 'Etanol', 3: 'Diesel', 4: 'Flex' })[v] || v;
}

function FormVeiculo({ form, setForm, save, edit }) {
  return (
    <form className="card card-soft p-3 mb-3" onSubmit={save}>
      <div className="row">
        <Input label="Modelo" value={form.modelo} onChange={v => setForm({ ...form, modelo: v })} />
        <Input label="Placa" value={form.placa} onChange={v => setForm({ ...form, placa: v })} />
        <Input label="KM" type="number" value={form.kmAtual} onChange={v => setForm({ ...form, kmAtual: +v })} />

        <div className="col-md-2 mb-3">
          <label>Combustível</label>
          <select
            className="form-select"
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
          <button className="btn btn-success w-100">
            {edit ? 'Atualizar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Motoristas() {
  const [items, setItems] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState({
    nome: '',
    documento: '',
    telefone: '',
    cargo: 'Técnico',
    ativo: true
  });
  const [edit, setEdit] = useState(null);

  const filtered = items.filter(x =>
    `${x.nome}${x.cargo}`.toLowerCase().includes(busca.toLowerCase())
  );

  async function load() {
    const r = await api.get('/motoristas');
    setItems(r.data);
  }

  useEffect(() => {
    let cancelled = false;

    api.get('/motoristas')
      .then(r => {
        if (!cancelled) setItems(r.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar motoristas.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e) {
    e.preventDefault();

    try {
      if (edit) {
        await api.put(`/motoristas/${edit}`, form);
      } else {
        await api.post('/motoristas', form);
      }

      toast.success('Motorista salvo.');

      setForm({
        nome: '',
        documento: '',
        telefone: '',
        cargo: 'Técnico',
        ativo: true
      });

      setEdit(null);
      await load();
    } catch {
      toast.error('Erro ao salvar.');
    }
  }

  async function del(id) {
    if (!confirm('Remover motorista?')) return;

    try {
      await api.delete(`/motoristas/${id}`);
      toast.success('Motorista removido.');
      await load();
    } catch {
      toast.error('Erro ao remover motorista.');
    }
  }

  return (
    <>
      <Header title="Motoristas/Técnicos" subtitle="Equipe vinculada aos abastecimentos" />

      <form className="card card-soft p-3 mb-3" onSubmit={save}>
        <div className="row">
          <Input label="Nome" value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
          <Input label="Documento" value={form.documento || ''} onChange={v => setForm({ ...form, documento: v })} />
          <Input label="Telefone" value={form.telefone || ''} onChange={v => setForm({ ...form, telefone: v })} />
          <Input label="Cargo" value={form.cargo || ''} onChange={v => setForm({ ...form, cargo: v })} />

          <div className="col-md-2 mb-3 d-flex align-items-end">
            <button className="btn btn-success w-100">Salvar</button>
          </div>
        </div>
      </form>

      <Search value={busca} setValue={setBusca} />

      <div className="card card-soft table-card">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Documento</th>
              <th>Telefone</th>
              <th>Cargo</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(x => (
              <tr key={x.id}>
                <td>{x.nome}</td>
                <td>{x.documento}</td>
                <td>{x.telefone}</td>
                <td>{x.cargo}</td>
                <td>
                  <button
                    className="btn btn-sm btn-warning me-2"
                    onClick={() => {
                      setEdit(x.id);
                      setForm(x);
                    }}
                  >
                    Editar
                  </button>

                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => del(x.id)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Abastecimentos() {
  const [items, setItems] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [urlConsulta, setUrlConsulta] = useState('');
  const [scannerAberto, setScannerAberto] = useState(false);
  const [qrReader, setQrReader] = useState(null);
  const [qrControls, setQrControls] = useState(null);
  const [filtro, setFiltro] = useState({
    veiculoId: '',
    motoristaId: ''
  });
  const [form, setForm] = useState(emptyAbastecimento());

  async function load() {
    const [abastecimentosRes, veiculosRes, motoristasRes] = await Promise.all([
      api.get('/abastecimentos', { params: filtro }),
      api.get('/veiculos'),
      api.get('/motoristas')
    ]);

    setItems(abastecimentosRes.data);
    setVeiculos(veiculosRes.data);
    setMotoristas(motoristasRes.data);
  }

  async function abrirLeitorQrCode() {
    setScannerAberto(true);

    setTimeout(async () => {
      try {
        const videoElement = document.getElementById('qr-video');

        if (!videoElement) {
          toast.error('Elemento de vídeo não encontrado.');
          setScannerAberto(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });

        videoElement.srcObject = stream;
        videoElement.setAttribute('playsinline', true);
        await videoElement.play();

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: ['qr_code']
          });

          const intervalId = setInterval(async () => {
            try {
              const codes = await detector.detect(videoElement);

              if (codes.length > 0) {
                const link = codes[0].rawValue;

                clearInterval(intervalId);
                stream.getTracks().forEach(track => track.stop());

                setUrlConsulta(link);
                setQrControls(null);
                setScannerAberto(false);

                toast.success('QR Code lido com sucesso.');

                await analisarPorUrl(link);
              }
            } catch {
              // Continua tentando ler.
            }
          }, 300);

          setQrControls({
            stop: () => {
              clearInterval(intervalId);
              stream.getTracks().forEach(track => track.stop());
            }
          });

          return;
        }

        const reader = new BrowserQRCodeReader();

        const controls = await reader.decodeFromVideoDevice(
          null,
          videoElement,
          async (result) => {
            if (result) {
              const link = result.getText();

              controls.stop();

              setUrlConsulta(link);
              setQrControls(null);
              setScannerAberto(false);

              toast.success('QR Code lido com sucesso.');

              await analisarPorUrl(link);
            }
          }
        );

        setQrControls(controls);
      } catch (error) {
        console.error(error);

        toast.error(
          'Não foi possível abrir a câmera. Verifique a permissão do navegador e se está usando HTTPS.'
        );

        setScannerAberto(false);
      }
    }, 500);
  }

function fecharLeitorQrCode() {
  if (qrControls) {
    qrControls.stop();
  }

  setQrControls(null);
  setScannerAberto(false);
}
  
  async function analisarPorUrl(url) {
    if (!url?.trim()) {
      return toast.warning('Link da NFC-e não encontrado.');
    }

    const fd = new FormData();
    fd.append('urlConsulta', url.trim());

    try {
      const { data } = await api.post('/abastecimentos/analisar-nota', fd);

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
        dataAbastecimento: data.dataAbastecimento
          ? data.dataAbastecimento.substring(0, 16)
          : f.dataAbastecimento,
        observacao: [
          `URL NFC-e: ${data.urlConsulta || url}`,
          data.combustivel ? `Combustível: ${data.combustivel}` : '',
          data.placa ? `Placa: ${data.placa}` : '',
          data.motorista ? `Motorista: ${data.motorista}` : ''
        ].filter(Boolean).join('\n')
      }));

      toast.success(data.mensagem || 'NFC-e analisada com sucesso.');
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao analisar NFC-e.');
    }
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get('/abastecimentos', { params: filtro }),
      api.get('/veiculos'),
      api.get('/motoristas')
    ])
      .then(([abastecimentosRes, veiculosRes, motoristasRes]) => {
        if (!cancelled) {
          setItems(abastecimentosRes.data);
          setVeiculos(veiculosRes.data);
          setMotoristas(motoristasRes.data);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar abastecimentos.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function analisarPorUrl(url) {
    if (!url?.trim()) {
      return toast.warning('Leia o QR Code ou informe o link da NFC-e.');
    }

    const fd = new FormData();
    fd.append('urlConsulta', url.trim());

    try {
      const { data } = await api.post('/abastecimentos/analisar-nota', fd);

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
        dataAbastecimento: data.dataAbastecimento
          ? data.dataAbastecimento.substring(0, 16)
          : f.dataAbastecimento,
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

  async function save(e) {
    e.preventDefault();

    const fd = new FormData();

    Object.entries(form).forEach(([k, v]) => fd.append(k, v));

    if (foto) fd.append('fotoNotaFiscal', foto);

    try {
      await api.post('/abastecimentos', fd);

      toast.success('Abastecimento salvo.');

      setForm(emptyAbastecimento());
      setFoto(null);
      setPreview('');

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
              <input
                className="form-control"
                type="file"
                accept="image/*"
                onChange={e => fileChange(e.target.files[0])}
              />

              {preview && <img src={preview} className="preview-img" />}

              <label className="mt-3">Leitura do QR Code da NFC-e</label>

              <div className="input-group">
                <input
                  className="form-control"
                  placeholder="O link será preenchido automaticamente pelo leitor de QR Code"
                  value={urlConsulta}
                  readOnly
                />

                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={abrirLeitorQrCode}
                >
                  Ler QR Code
                </button>
              </div>

              <small className="text-muted">
                A foto será apenas salva como comprovante. A análise será feita pelo link lido do QR Code da NFC-e.
              </small>

              <br />

              <button
                type="button"
                className="btn btn-outline-primary mt-2"
                onClick={analisar}
              >
                Analisar NFC-e
              </button>

              {scannerAberto && (
                <div className="card p-3 mt-3">
                  <h5>Leitor de QR Code</h5>

                  <video
                    id="qr-video"
                    style={{
                      width: '100%',
                      maxWidth: '420px',
                      borderRadius: '12px',
                      border: '2px solid #333'
                    }}
                  />

                  <small className="text-muted mt-2">
                    Aponte a câmera para o QR Code da nota fiscal.
                  </small>

                  <button
                    type="button"
                    className="btn btn-secondary mt-3"
                    onClick={fecharLeitorQrCode}
                  >
                    Fechar leitor
                  </button>
                </div>
              )}

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

        <textarea
          className="form-control mb-3"
          rows="3"
          value={form.observacao}
          onChange={e => setForm({ ...form, observacao: e.target.value })}
        />

        <button className="btn btn-success">Salvar Abastecimento</button>
      </form>

      <div className="card card-soft p-3 mb-3">
        <div className="row">
          <Select label="Filtrar veículo" value={filtro.veiculoId} onChange={v => setFiltro({ ...filtro, veiculoId: v })} items={veiculos} text={x => `${x.modelo} - ${x.placa}`} />
          <Select label="Filtrar motorista" value={filtro.motoristaId} onChange={v => setFiltro({ ...filtro, motoristaId: v })} items={motoristas} text={x => x.nome} />

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button className="btn btn-primary w-100" onClick={load}>
              Filtrar
            </button>
          </div>
        </div>
      </div>

      <div className="card card-soft table-card">
        <AbastecimentosTabela items={items} />
      </div>
    </>
  );
}

function AbastecimentosTabela({ items }) {

  const podeEditar =
    temPermissao('Abastecimentos.Editar');

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

          {podeEditar &&
            <th>Ações</th>
          }

        </tr>

      </thead>

      <tbody>

        {items.map(x => (

          <tr key={x.id}>

            <td>
              {new Date(
                x.dataAbastecimento
              ).toLocaleString('pt-BR')}
            </td>

            <td>
              {x.veiculo?.placa}
            </td>

            <td>
              {x.motorista?.nome}
            </td>

            <td>
              {number(x.kmAtual)}
            </td>

            <td>
              {litros(x.litros)}
            </td>

            <td>
              {money(x.valorTotal)}
            </td>

            <td>

              {x.fotoNotaFiscalPath &&
                <a
                  href={`${STATIC_BASE_URL}${x.fotoNotaFiscalPath}`}
                  target="_blank"
                >
                  Ver
                </a>
              }

            </td>

            {podeEditar &&

              <td>

                <button
                  className="btn btn-warning btn-sm"
                >
                  Editar
                </button>

              </td>

            }

          </tr>

        ))}

      </tbody>

    </table>
  );
}

const TODAS_PERMISSOES = [
  'Dashboard.Visualizar',
  'Veiculos.Visualizar',
  'Motoristas.Visualizar',
  'Abastecimentos.Visualizar',
  'Abastecimentos.Criar',
  'Abastecimentos.Editar',
  'Relatorios.Visualizar',
  'Relatorios.Exportar',
  'Usuarios.Visualizar',
  'Usuarios.Gerenciar'
];

function Usuarios() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '123456',
    perfil: 3,
    motoristaId: '',
    ativo: true,
    permissoes: []
  });

  const [edit, setEdit] = useState(null);

  async function load() {
    const r = await api.get('/usuarios');
    setItems(r.data);
  }

  useEffect(() => {
    let cancelled = false;

    api.get('/usuarios')
      .then(r => {
        if (!cancelled) setItems(r.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Você não tem permissão para acessar usuários.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e) {
    e.preventDefault();

    const payload = {
      ...form,
      motoristaId: form.motoristaId ? Number(form.motoristaId) : null,
      perfil: Number(form.perfil),
      permissoes: form.permissoes || []
    };

    try {
      if (edit) {
        await api.put(`/usuarios/${edit}`, payload);
      } else {
        await api.post('/usuarios', payload);
      }

      toast.success('Usuário salvo.');

      setForm({
        nome: '',
        email: '',
        senha: '123456',
        perfil: 3,
        motoristaId: '',
        ativo: true,
        permissoes: []
      });

      setEdit(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.mensagem || 'Erro ao salvar usuário.');
    }
  }

  function togglePermissao(permissao, checked) {
    const permissoes = checked
      ? [...form.permissoes, permissao]
      : form.permissoes.filter(x => x !== permissao);

    setForm({
      ...form,
      permissoes
    });
  }

  function aplicarPermissoesPadrao(perfilSelecionado) {
    const perfilNumero = Number(perfilSelecionado);

    let permissoesPadrao = [];

    if (perfilNumero === 1) {
      permissoesPadrao = TODAS_PERMISSOES;
    }

    if (perfilNumero === 2) {
      permissoesPadrao = [
        'Dashboard.Visualizar',
        'Veiculos.Visualizar',
        'Motoristas.Visualizar',
        'Abastecimentos.Visualizar',
        'Abastecimentos.Criar',
        'Abastecimentos.Editar',
        'Relatorios.Visualizar',
        'Relatorios.Exportar'
      ];
    }

    if (perfilNumero === 3) {
      permissoesPadrao = [
        'Dashboard.Visualizar',
        'Abastecimentos.Visualizar',
        'Abastecimentos.Criar'
      ];
    }

    setForm({
      ...form,
      perfil: perfilNumero,
      permissoes: permissoesPadrao
    });
  }

  return (
    <>
      <Header title="Usuários" subtitle="Controle de acesso, perfis e permissões" />

      <form className="card card-soft p-3 mb-3" onSubmit={save}>
        <div className="row">
          <Input
            label="Nome"
            value={form.nome}
            onChange={v => setForm({ ...form, nome: v })}
          />

          <Input
            label="E-mail"
            value={form.email}
            onChange={v => setForm({ ...form, email: v })}
          />

          <Input
            label="Senha"
            value={form.senha || ''}
            onChange={v => setForm({ ...form, senha: v })}
          />

          <div className="col-md-2 mb-3">
            <label>Perfil</label>
            <select
              className="form-select"
              value={form.perfil}
              onChange={e => aplicarPermissoesPadrao(e.target.value)}
            >
              <option value="1">Master</option>
              <option value="2">RH</option>
              <option value="3">Técnico</option>
            </select>
          </div>

          <Input
            label="MotoristaId"
            type="number"
            value={form.motoristaId}
            onChange={v => setForm({ ...form, motoristaId: v })}
          />

          <div className="col-md-12 mb-3">
            <label className="fw-bold">Permissões de acesso</label>

            <div className="row mt-2">
              {TODAS_PERMISSOES.map(p => (
                <div className="col-md-4 mb-2" key={p}>
                  <label className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={form.permissoes.includes(p)}
                      onChange={e => togglePermissao(p, e.target.checked)}
                    />

                    <span className="form-check-label">{p}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="col-md-2 mb-3">
            <label>Status</label>
            <select
              className="form-select"
              value={form.ativo ? 'true' : 'false'}
              onChange={e => setForm({ ...form, ativo: e.target.value === 'true' })}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>

          <div className="col-md-2 d-flex align-items-end mb-3">
            <button className="btn btn-success w-100">
              {edit ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>

      <div className="card card-soft table-card">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>MotoristaId</th>
              <th>Status</th>
              <th>Permissões</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {items.map(x => (
              <tr key={x.id}>
                <td>{x.nome}</td>
                <td>{x.email}</td>
                <td>{perfil(x.perfil)}</td>
                <td>{x.motoristaId || '-'}</td>
                <td>{x.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>{x.permissoes?.length || 0}</td>
                <td>
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => {
                      setEdit(x.id);

                      setForm({
                        nome: x.nome || '',
                        email: x.email || '',
                        senha: '',
                        perfil: x.perfil,
                        motoristaId: x.motoristaId || '',
                        ativo: x.ativo,
                        permissoes: x.permissoes || []
                      });
                    }}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function perfil(p) {
  return ({ 1: 'Master', 2: 'RH', 3: 'Técnico' })[p] || p;
}

function Relatorios() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    api.get('/abastecimentos')
      .then(r => {
        if (!cancelled) setItems(r.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar relatórios.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const porVeiculo = Object.values(
    items.reduce((acc, x) => {
      const k = x.veiculo?.placa || 'Sem placa';

      acc[k] ??= {
        nome: k,
        litros: 0,
        valor: 0,
        qtd: 0
      };

      acc[k].litros += toNumber(x.litros);
      acc[k].valor += toNumber(x.valorTotal);
      acc[k].qtd++;

      return acc;
    }, {})
  );

  return (
    <>
      <Header title="Relatórios RH" subtitle="Consolidação por veículo" />

      <div className="card card-soft table-card">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Qtd.</th>
              <th>Litros</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            {porVeiculo.map(x => (
              <tr key={x.nome}>
                <td>{x.nome}</td>
                <td>{x.qtd}</td>
                <td>{litros(x.litros)}</td>
                <td>{money(x.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Header({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2>{title}</h2>
      <p className="text-muted mb-0">{subtitle}</p>
    </div>
  );
}

function Search({ value, setValue }) {
  return (
    <input
      className="form-control mb-3"
      placeholder="Pesquisar..."
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div className="col-md-2 mb-3">
      <label>{label}</label>

      <input
        type={type}
        className="form-control"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function Select({ label, value, onChange, items, text }) {
  return (
    <div className="col-md-4 mb-3">
      <label>{label}</label>

      <select
        className="form-select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Selecione</option>

        {items.map(x => (
          <option key={x.id} value={x.id}>
            {text(x)}
          </option>
        ))}
      </select>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

    <Route path="/login" element={<Login />} />

    <Route
      path="/"
      element={
        <PermissionRoute permissao="Dashboard.Visualizar">
          <Dashboard />
        </PermissionRoute>
      }
    />

    <Route
      path="/veiculos"
      element={
        <PermissionRoute permissao="Veiculos.Visualizar">
          <Veiculos />
        </PermissionRoute>
      }
    />

    <Route
      path="/motoristas"
      element={
        <PermissionRoute permissao="Motoristas.Visualizar">
          <Motoristas />
        </PermissionRoute>
      }
    />

    <Route
      path="/abastecimentos"
      element={
        <PermissionRoute permissao="Abastecimentos.Visualizar">
          <Abastecimentos />
        </PermissionRoute>
      }
    />

    <Route
      path="/usuarios"
      element={
        <PermissionRoute permissao="Usuarios.Visualizar">
          <Usuarios />
        </PermissionRoute>
      }
    />

    <Route
      path="/relatorios"
      element={
        <PermissionRoute permissao="Relatorios.Visualizar">
          <Relatorios />
        </PermissionRoute>
      }
    />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
