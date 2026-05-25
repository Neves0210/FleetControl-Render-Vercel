import { api } from '../api/api';

export const relatorioService = {
  abastecimentos: params => api.get('/relatorios/abastecimentos', { params })
};
