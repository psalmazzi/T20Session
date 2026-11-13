/* Supabase falso (só para tests/compartilhar_e2e.py): tabela mesas no localStorage,
 * rpc mesa_publica com o mesmo recorte de supabase/002_compartilhar.sql (via T20S.estadoPublico)
 * e Broadcast via BroadcastChannel. Imita só a parte do supabase-js v2 que o app usa. */
(function () {
  const K = 'fake.mesas';
  const ler = () => JSON.parse(localStorage.getItem(K) || '[]');
  const gravar = l => localStorage.setItem(K, JSON.stringify(l));
  const pronto = v => Promise.resolve(v);
  function consulta(tabela) {
    const q = { op: 'select', filtros: [], unico: false, valores: null, cols: '*' };
    const exec = () => {
      let l = ler();
      const ok = r => q.filtros.every(([c, v]) => r[c] === v);
      if (q.op === 'insert') { const r = Object.assign({ id: 'm' + Math.random().toString(36).slice(2, 8), atualizado: new Date().toISOString(), codigo: null }, q.valores); l.push(r); gravar(l); return { data: q.unico ? r : [r], error: null }; }
      if (q.op === 'update') { l.forEach(r => { if (ok(r)) Object.assign(r, q.valores); }); gravar(l); return { data: null, error: null }; }
      if (q.op === 'delete') { gravar(l.filter(r => !ok(r))); return { data: null, error: null }; }
      const res = l.filter(ok);
      return q.unico ? (res[0] ? { data: res[0], error: null } : { data: null, error: { message: 'not found' } }) : { data: res, error: null };
    };
    const b = {
      select(c) { if (q.op === 'select') q.cols = c; return b; },
      insert(v) { q.op = 'insert'; q.valores = v; return b; },
      update(v) { q.op = 'update'; q.valores = v; return b; },
      delete() { q.op = 'delete'; return b; },
      eq(c, v) { q.filtros.push([c, v]); return b; },
      order() { return b; },
      single() { q.unico = true; return b; },
      then(a, r) { return pronto(exec()).then(a, r); }
    };
    return b;
  }
  window.__enviados = 0;
  function canal(nome) {
    const bc = new BroadcastChannel('fake-rt-' + nome);
    const ouvintes = [];
    bc.onmessage = ev => ouvintes.forEach(o => { if (o.event === ev.data.event) o.cb({ type: 'broadcast', event: ev.data.event, payload: ev.data.payload }); });
    const ch = {
      on(tipo, filtro, cb) { if (tipo === 'broadcast') ouvintes.push({ event: filtro.event, cb }); return ch; },
      subscribe(cb) { setTimeout(() => cb && cb('SUBSCRIBED'), 20); return ch; },
      send(m) { window.__enviados++; window.__ultimoEnvio = m.payload; bc.postMessage({ event: m.event, payload: m.payload }); return pronto('ok'); },
      _fechar() { bc.close(); }
    };
    return ch;
  }
  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession: () => pronto({ data: { session: (window.__semSessao && !/access_token/.test(location.hash)) ? null : { user: { id: 'u1', email: 'mestre@teste' } } } }),
          signOut: () => pronto({}), signInWithPassword: () => pronto({ data: { user: { id: 'u1' } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          resetPasswordForEmail: (email, op) => { window.__reset = { email, op }; return pronto({ data: {}, error: null }); },
          updateUser: (u) => { window.__novaSenha = u.password; window.__semSessao = false; return pronto({ data: { user: { id: 'u1', email: 'mestre@teste' } }, error: null }); }
        },
        from: consulta,
        channel: canal,
        removeChannel(c) { if (c && c._fechar) c._fechar(); },
        rpc(fn, args) {
          const m = ler().find(r => r.codigo && r.codigo === args.p_codigo);
          return pronto({ data: m ? { id: m.id, nome: m.nome, estado: window.T20S.estadoPublico(m.estado) } : null, error: null });
        }
      };
    }
  };
})();
