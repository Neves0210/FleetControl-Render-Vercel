function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\r?\n/g, ' ').trim();
  if (/[",;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function exportarCsv(nomeArquivo, colunas, linhas) {
  const header = colunas.map(col => csvEscape(col.label)).join(';');
  const body = linhas.map(item => (
    colunas.map(col => csvEscape(typeof col.value === 'function' ? col.value(item) : item[col.value])).join(';')
  ));

  const conteudo = ['\uFEFF' + header, ...body].join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
