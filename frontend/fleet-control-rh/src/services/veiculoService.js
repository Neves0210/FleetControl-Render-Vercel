import { api } from '../api/api';

export const veiculoService = {
  listar: () => api.get('/veiculos'),
  criar: payload => api.post('/veiculos', payload),
  atualizar: (id, payload) => api.put(`/veiculos/${id}`, payload),
  remover: id => api.delete(`/veiculos/${id}`)
};
