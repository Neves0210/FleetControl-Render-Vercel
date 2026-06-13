import { api } from '../api/api';

export const veiculoService = {
  listar: params => api.get('/veiculos', { params }),
  historico: id => api.get(`/veiculos/${id}/historico`),
  criar: payload => api.post('/veiculos', payload),
  atualizar: (id, payload) => api.put(`/veiculos/${id}`, payload),
  remover: id => api.delete(`/veiculos/${id}`)
};
