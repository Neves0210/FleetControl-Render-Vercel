import { Check } from 'lucide-react';
import './permissoes.css';

// Nome amigável de cada módulo (a partir do prefixo "Modulo.Acao")
const MODULOS = {
  Dashboard: 'Dashboard',
  Veiculos: 'Veículos',
  Motoristas: 'Motoristas',
  Abastecimentos: 'Abastecimentos',
  UsosVeiculos: 'Uso de Veículos',
  Manutencoes: 'Manutenções',
  Relatorios: 'Relatórios',
  Usuarios: 'Usuários'
};

export function PermissoesSelect({ todas = [], value = [], onChange }) {
  const selecionadas = new Set(value);

  // Agrupa preservando a ordem de TODAS_PERMISSOES
  const grupos = {};
  todas.forEach(p => {
    const [mod, acao] = p.split('.');
    (grupos[mod] = grupos[mod] || []).push({ perm: p, acao: acao || p });
  });

  function toggle(perm) {
    const novo = new Set(value);
    if (novo.has(perm)) novo.delete(perm);
    else novo.add(perm);
    onChange?.([...novo]);
  }

  function toggleGrupo(perms) {
    const todosOn = perms.every(p => selecionadas.has(p.perm));
    const novo = new Set(value);
    perms.forEach(p => (todosOn ? novo.delete(p.perm) : novo.add(p.perm)));
    onChange?.([...novo]);
  }

  return (
    <div className="perm-groups">
      {Object.entries(grupos).map(([mod, perms]) => {
        const qtd = perms.filter(p => selecionadas.has(p.perm)).length;
        const todosOn = qtd === perms.length;

        return (
          <div className="perm-group" key={mod}>
            <div className="perm-group-head">
              <span className="perm-group-title">{MODULOS[mod] || mod}</span>
              <div className="perm-group-right">
                <span className="perm-group-count">{qtd}/{perms.length}</span>
                <button type="button" className="perm-all" onClick={() => toggleGrupo(perms)}>
                  {todosOn ? 'Limpar' : 'Todos'}
                </button>
              </div>
            </div>

            <div className="perm-chips">
              {perms.map(({ perm, acao }) => {
                const on = selecionadas.has(perm);
                return (
                  <button
                    type="button"
                    key={perm}
                    className={`perm-chip ${on ? 'on' : ''}`}
                    onClick={() => toggle(perm)}
                    title={perm}
                  >
                    {on && <span className="pchk"><Check size={13} /></span>}
                    {acao}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
