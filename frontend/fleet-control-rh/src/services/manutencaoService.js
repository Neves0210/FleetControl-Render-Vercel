import { api } from '../api/api';

export const manutencaoService = {
  listar: params => api.get('/manutencoes', { params }),
  alertas: () => api.get('/manutencoes/alertas'),
  criar: payload => api.post('/manutencoes', payload),
  atualizar: (id, payload) => api.put(`/manutencoes/${id}`, payload),
  remover: id => api.delete(`/manutencoes/${id}`)
};
