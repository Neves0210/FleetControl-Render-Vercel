const TIME_ZONE_BRASIL = 'America/Sao_Paulo';

function partesBrasil(date = new Date()) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE_BRASIL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
}

export function dataInputBrasil(date = new Date()) {
  const partes = partesBrasil(date);
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function dataHoraInputBrasil(date = new Date()) {
  const partes = partesBrasil(date);
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

export function dataBrasil(value) {
  if (!value) return '-';

  const texto = String(value);
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, ano, mes, dia] = match;
    return `${dia}/${mes}/${ano}`;
  }

  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return '-';

  return data.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE_BRASIL });
}

export function dataBrasilParaDate(value) {
  if (!value) return null;

  const texto = String(value);
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);

  if (match) {
    const [, ano, mes, dia, hora = '00', minuto = '00'] = match;
    return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto));
  }

  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function hojeExtensoBrasil() {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: TIME_ZONE_BRASIL,
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

export function subtrairMesesBrasil(meses) {
  const [ano, mes, dia] = dataInputBrasil().split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  data.setMonth(data.getMonth() - meses);
  return data;
}
