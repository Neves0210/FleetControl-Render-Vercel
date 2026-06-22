import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { LogIn, Truck } from 'lucide-react';
import { api } from '../api/api';
import { rotaInicialPorUsuario } from '../utils/flowRoutes';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, senha });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      navigate(rotaInicialPorUsuario(data), { replace: true });
    } catch {
      toast.error('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card p-4 login-card" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{
            width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#300840,#4b1260)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Truck size={22} />
          </span>
          <div>
            <h3 className="mb-0">FleetControlRH</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Controle de abastecimentos</p>
          </div>
        </div>

        <label className="mt-3">E-mail</label>
        <input className="form-control mb-3" value={email} onChange={e => setEmail(e.target.value)} />

        <label>Senha</label>
        <input className="form-control mb-3" type="password" value={senha} onChange={e => setSenha(e.target.value)} />

        <button className="btn btn-primary" disabled={loading}>
          <LogIn size={16} /> {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <ToastContainer position="top-right" autoClose={2500} />
      </form>
    </div>
  );
}
