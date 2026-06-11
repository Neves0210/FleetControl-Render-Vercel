import { api } from '../api/api';

export const usoVeiculoService = {
  listar: params => api.get('/usos-veiculos', { params }),
  veiculosDisponiveis: () => api.get('/usos-veiculos/veiculos-disponiveis'),
  iniciar: payload => api.post('/usos-veiculos/iniciar', payload),
  editar: (id, payload) => api.put(`/usos-veiculos/${id}`, payload),
  finalizar: (id, payload) => api.put(`/usos-veiculos/${id}/finalizar`, payload)
};
