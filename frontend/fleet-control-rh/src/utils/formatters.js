export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const text = String(value)
    .replace('R$', '')
    .replace(/\s/g, '');

  if (text.includes(',') && text.includes('.')) {
    return Number(text.replace(/\./g, '').replace(',', '.'));
  }

  if (text.includes(',')) {
    return Number(text.replace(',', '.'));
  }

  return Number(text);
}

export function money(value) {
  return toNumber(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function number(value) {
  return toNumber(value).toLocaleString('pt-BR');
}

export function litros(value) {
  return toNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}

export function combustivel(value) {
  return ({ 1: 'Gasolina', 2: 'Etanol', 3: 'Diesel', 4: 'Flex' })[value] || value;
}

export function perfil(value) {
  return ({ 1: 'Master', 2: 'RH', 3: 'Tecnico' })[value] || value;
}

export function dataHora(value) {
  if (!value) return '-';

  const text = String(value);
  const localDateTime = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);

  if (localDateTime && !hasTimezone) {
    const [, ano, mes, dia, hora, minuto] = localDateTime;
    return `${dia}/${mes}/${ano}, ${hora}:${minuto}`;
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  });
}
