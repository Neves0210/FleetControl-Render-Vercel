import { api } from '../api/api';

export const motoristaService = {
  listar: params => api.get('/motoristas', { params }),
  criar: payload => api.post('/motoristas', payload),
  atualizar: (id, payload) => api.put(`/motoristas/${id}`, payload),
  remover: id => api.delete(`/motoristas/${id}`)
};
