import { api } from '../api/api';

export const auditoriaService = {
  listar: params => api.get('/auditoria', { params })
};
