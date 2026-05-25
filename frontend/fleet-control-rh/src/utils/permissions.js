export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

export function getPermissoes() {
  const user = getUser();
  return user?.permissoes || [];
}

export function temPermissao(permissao) {
  return getPermissoes().includes(permissao);
}

export function podeVerTela(permissao) {
  return temPermissao(permissao);
}
