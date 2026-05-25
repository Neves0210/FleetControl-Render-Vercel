import { api } from '../api/api';

export const motoristaService = {
  listar: () => api.get('/motoristas'),
  criar: payload => api.post('/motoristas', payload),
  atualizar: (id, payload) => api.put(`/motoristas/${id}`, payload),
  remover: id => api.delete(`/motoristas/${id}`)
};
