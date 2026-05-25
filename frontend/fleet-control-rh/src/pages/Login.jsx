import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { api } from '../api/api';

export function Login() {
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
        <input className="form-control mb-3" value={email} onChange={e => setEmail(e.target.value)} />

        <label>Senha</label>
        <input className="form-control mb-3" type="password" value={senha} onChange={e => setSenha(e.target.value)} />

        <button className="btn btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>

        <small className="text-muted mt-3">Admin padrão: admin@fleet.local / 123456</small>
        <ToastContainer position="top-right" autoClose={2500} />
      </form>
    </div>
  );
}
