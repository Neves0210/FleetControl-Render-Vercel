import { api } from '../api/api';

export const usuarioService = {
  listar: () => api.get('/usuarios'),
  criar: payload => api.post('/usuarios', payload),
  atualizar: (id, payload) => api.put(`/usuarios/${id}`, payload)
};
