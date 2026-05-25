import { api } from '../api/api';

export const abastecimentoService = {
  listar: params => api.get('/abastecimentos', { params }),
  criar: formData => api.post('/abastecimentos', formData),
  editar: (id, formData) => api.put(`/abastecimentos/${id}`, formData),
  analisarNota: formData => api.post('/abastecimentos/analisar-nota', formData),
  lerQrCodeImagem: formData => api.post('/abastecimentos/ler-qrcode-imagem', formData)
};
