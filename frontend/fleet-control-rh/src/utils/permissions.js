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
  const user = getUser();
  const perfil = String(user?.perfil || '').toLowerCase();

  if (perfil === '1' || perfil === 'master') return true;

  return getPermissoes().includes(permissao);
}

export function podeVerTela(permissao) {
  return temPermissao(permissao);
}
