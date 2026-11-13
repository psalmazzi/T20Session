/* T20Session — estado da mesa, ações, desfazer, persistência e sincronização.
 * Persistência: Supabase (se js/config.js tiver URL e chave) ou só localStorage (modo local).
 * Sincronização com a tela dos jogadores: BroadcastChannel (mesmo navegador, instantâneo)
 * + Supabase Realtime (outros aparelhos). Só a tela do mestre grava. */
(function (raiz) {
  'use strict';
  const R = raiz.T20R;
  const CFG = raiz.T20_CONFIG || {};
  const ORIGEM = Math.random().toString(36).slice(2, 10);
  const CANAL = (typeof window !== 'undefined' && 'BroadcastChannel' in raiz) ? new BroadcastChannel('t20session') : null;
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* sem storage */ } }
  };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = o => JSON.parse(JSON.stringify(o));

  function estadoInicial(nome) {
    return {
      v: 1, rev: 0, nome: nome || 'Nova mesa', modo: 'grupo', dia: 1,
      jogadores: [],
      combate: {
        ativo: false, rodada: 0, turno: 0, ordem: [], inis: {}, inimigos: [],
        rerrolarCadaRodada: true, inimigosEmGrupo: false, mostrarPVInimigos: false
      },
      recentes: [], // inimigos usados antes, para adicionar rápido
      log: []
    };
  }

  function novoJogador(d) {
    d = d || {};
    const n = (k, p) => (d[k] === undefined || d[k] === '' || isNaN(+d[k])) ? p : Math.floor(+d[k]);
    const pvMax = n('pvMax', 10), pmMax = n('pmMax', 4);
    return {
      id: d.id || uid(), tipo: 'jogador', nome: (d.nome || 'Personagem').slice(0, 40), jogador: (d.jogador || '').slice(0, 40),
      nivel: Math.max(1, Math.min(20, n('nivel', 1))),
      pv: { atual: n('pvAtual', pvMax), max: pvMax }, pm: { atual: n('pmAtual', pmMax), max: pmMax },
      defesa: n('defesa', 10), iniciativa: n('iniciativa', 0),
      dinheiro: (d.dinheiro === undefined || d.dinheiro === '' || isNaN(+d.dinheiro)) ? 0 : Math.round(+d.dinheiro * 100) / 100, racoes: n('racoes', 0), diasSemComer: n('diasSemComer', 0),
      condicoes: d.condicoes || []
    };
  }

  function novoInimigo(d, i) {
    const n = (k, p) => (d[k] === undefined || d[k] === '' || isNaN(+d[k])) ? p : Math.floor(+d[k]);
    const pvMax = n('pv', 10), pmMax = n('pm', 0);
    return {
      id: uid(), tipo: 'inimigo', nome: (d.nome || 'Inimigo').slice(0, 40) + (i ? ' ' + i : ''),
      pv: { atual: pvMax, max: pvMax }, pm: { atual: pmMax, max: pmMax },
      defesa: n('defesa', 10), iniciativa: n('iniciativa', 0), visivel: d.visivel !== false, condicoes: []
    };
  }

  // ---------- consultas ----------
  function combatentes(s) { return s.jogadores.concat(s.combate.inimigos); }
  function achar(s, id) { return combatentes(s).find(c => c.id === id); }
  function foraDeCombate(c) { return c.tipo === 'inimigo' && c.pv.atual <= 0; }
  function ordemValida(s) {
    const ids = new Set(combatentes(s).map(c => c.id));
    return s.combate.ordem.filter(id => ids.has(id));
  }
  function daVez(s) {
    if (!s.combate.ativo) return null;
    const o = ordemValida(s);
    return o[s.combate.turno] || null;
  }
  function log(s, txt) { s.log = [{ t: Date.now(), txt }].concat(s.log || []).slice(0, 40); }

  // ---------- ações (mutam uma cópia; o Store guarda o snapshot anterior para desfazer) ----------
  function rolarTodos(s, rng) {
    const cs = combatentes(s);
    s.combate.inis = R.rolarIniciativa(cs, { inimigosEmGrupo: s.combate.inimigosEmGrupo }, rng);
    s.combate.ordem = R.ordenarIniciativa(cs, s.combate.inis);
    s.combate.turno = primeiroValido(s, 0);
  }
  function primeiroValido(s, desde) {
    const o = ordemValida(s);
    for (let i = desde; i < o.length; i++) { const c = achar(s, o[i]); if (c && !foraDeCombate(c)) return i; }
    return -1;
  }
  function novaRodada(s, rng) {
    s.combate.rodada += 1;
    const expiradas = [];
    combatentes(s).forEach(c => {
      const r = R.passarRodada(c.condicoes);
      c.condicoes = r.lista;
      r.expiradas.forEach(x => expiradas.push(c.nome + ': ' + R.nomeCondicao(x)));
    });
    s.combate.ordem = ordemValida(s);
    if (s.combate.rerrolarCadaRodada) rolarTodos(s, rng);
    else s.combate.turno = primeiroValido(s, 0);
    if (s.combate.turno < 0) s.combate.turno = 0;
    log(s, 'Rodada ' + s.combate.rodada + (expiradas.length ? ' · terminou: ' + expiradas.join(', ') : ''));
    return expiradas;
  }

  const ACOES = {
    renomearMesa(s, p) { s.nome = String(p.nome || '').slice(0, 60) || s.nome; },
    salvarJogador(s, p) {
      const i = s.jogadores.findIndex(j => j.id === p.id);
      if (i < 0) { const j = novoJogador(p); s.jogadores.push(j); log(s, j.nome + ' entrou no grupo'); return; }
      const velho = s.jogadores[i];
      const j = novoJogador(Object.assign({}, p, { condicoes: velho.condicoes }));
      s.jogadores[i] = j;
    },
    removerJogador(s, p) {
      s.jogadores = s.jogadores.filter(j => j.id !== p.id);
      s.combate.ordem = ordemValida(s);
    },
    moverJogador(s, p) {
      const i = s.jogadores.findIndex(j => j.id === p.id), k = i + p.dir;
      if (i < 0 || k < 0 || k >= s.jogadores.length) return;
      const t = s.jogadores[i]; s.jogadores[i] = s.jogadores[k]; s.jogadores[k] = t;
    },
    /** p: {id, n, tipo:'dano'|'cura'} */
    vida(s, p) {
      const c = achar(s, p.id); if (!c || !p.n) return;
      const antes = c.pv.atual;
      c.pv = p.tipo === 'cura' ? R.aplicarCura(c.pv, p.n) : R.aplicarDano(c.pv, p.n);
      if (c.tipo === 'jogador' && antes <= 0 && c.pv.atual >= 1)
        c.condicoes = c.condicoes.filter(x => x.cond !== 'inconsciente' && x.cond !== 'sangrando'); // p. 237
      log(s, c.nome + (p.tipo === 'cura' ? ' curou ' : ' sofreu ') + p.n + ' (PV ' + c.pv.atual + '/' + c.pv.max + ')');
    },
    /** p: {id, n, tipo:'gastar'|'recuperar'} */
    mana(s, p) {
      const c = achar(s, p.id); if (!c || !p.n) return;
      c.pm = p.tipo === 'recuperar' ? R.aplicarCura(c.pm, p.n) : R.gastarPM(c.pm, p.n);
      log(s, c.nome + (p.tipo === 'recuperar' ? ' recuperou ' : ' gastou ') + p.n + ' PM (' + c.pm.atual + '/' + c.pm.max + ')');
    },
    /** p: {id, campo:'dinheiro'|'racoes', delta} */
    recurso(s, p) {
      const j = s.jogadores.find(x => x.id === p.id); if (!j) return;
      if (p.campo === 'dinheiro') j.dinheiro = Math.round((j.dinheiro + (+p.delta || 0)) * 100) / 100;
      if (p.campo === 'racoes') j.racoes = Math.max(0, j.racoes + (p.delta | 0));
    },
    addCondicao(s, p) {
      const c = achar(s, p.id); if (!c) return;
      const r = R.aplicarCondicao(c.condicoes, p.cond, p.dur, uid);
      c.condicoes = r.lista;
      if (r.nota) log(s, c.nome + ': ' + r.nota);
      return r.nota;
    },
    rmCondicao(s, p) { const c = achar(s, p.id); if (c) c.condicoes = c.condicoes.filter(x => x.id !== p.uid); },

    /** p: {tipo, cuidados:{id:true}, sopa, tormenta, comer} */
    descanso(s, p) {
      const linhas = [];
      s.jogadores = s.jogadores.map(j => {
        let r = R.aplicarDescanso(j, p.tipo, { cuidados: p.cuidados && p.cuidados[j.id], sopa: p.sopa, tormenta: p.tormenta });
        let jj = r.jogador;
        if (p.comer) jj = R.alimentar(jj).jogador;
        linhas.push(j.nome + ' +' + r.ganhoPV + ' PV +' + r.ganhoPM + ' PM');
        return jj;
      });
      s.dia = (s.dia || 1) + 1;
      log(s, 'Descanso ' + R.DESCANSO[p.tipo].nome.toLowerCase() + ' · ' + linhas.join(' · '));
    },
    /** p: {ids?} — sem ids, alimenta todos */
    alimentar(s, p) {
      const ids = p && p.ids ? new Set(p.ids) : null;
      const sem = [];
      s.jogadores = s.jogadores.map(j => {
        if (ids && !ids.has(j.id)) return j;
        const r = R.alimentar(j);
        if (!r.comeu) sem.push(j.nome);
        return r.jogador;
      });
      log(s, 'Grupo comeu' + (sem.length ? ' · sem ração: ' + sem.join(', ') : ''));
      return sem;
    },
    limparCondicoesGrupo(s) { s.jogadores.forEach(j => { j.condicoes = R.fimDeCena(j.condicoes); }); log(s, 'Condições de cena removidas'); },

    // ----- combate -----
    iniciarCombate(s, p, rng) {
      s.modo = 'combate';
      s.combate.ativo = true; s.combate.rodada = 1;
      rolarTodos(s, rng);
      if (s.combate.turno < 0) s.combate.turno = 0;
      log(s, 'Combate iniciado');
    },
    /** p: {nome, pv, pm, defesa, iniciativa, qtd, visivel} */
    addInimigo(s, p, rng) {
      const qtd = Math.max(1, Math.min(20, p.qtd | 0 || 1));
      const ja = s.combate.inimigos.filter(i => i.nome.indexOf(p.nome) === 0).length;
      const novos = [];
      for (let i = 1; i <= qtd; i++) novos.push(novoInimigo(p, qtd > 1 || ja ? ja + i : 0));
      s.combate.inimigos = s.combate.inimigos.concat(novos);
      // guarda nos recentes (sem duplicar pelo nome)
      const rec = { nome: p.nome, pv: +p.pv || 10, pm: +p.pm || 0, defesa: +p.defesa || 10, iniciativa: +p.iniciativa || 0 };
      s.recentes = [rec].concat((s.recentes || []).filter(r => r.nome !== rec.nome)).slice(0, 12);
      if (s.combate.ativo) {
        const vez = daVez(s);
        const inis = R.rolarIniciativa(novos, {}, rng);
        if (s.combate.inimigosEmGrupo) {
          const outro = s.combate.inimigos.find(i => s.combate.inis[i.id] && novos.indexOf(i) < 0);
          if (outro) novos.forEach(n => { inis[n.id] = Object.assign({}, s.combate.inis[outro.id], { desempate: Math.random() }); });
        }
        Object.assign(s.combate.inis, inis);
        s.combate.ordem = R.ordenarIniciativa(combatentes(s), s.combate.inis);
        const k = s.combate.ordem.indexOf(vez); if (k >= 0) s.combate.turno = k;
      }
      log(s, 'Entrou: ' + novos.map(n => n.nome).join(', '));
    },
    salvarInimigo(s, p) {
      const c = s.combate.inimigos.find(i => i.id === p.id); if (!c) return;
      const n = (v, d) => (v === '' || v === undefined || isNaN(+v)) ? d : Math.floor(+v);
      c.nome = (p.nome || c.nome).slice(0, 40);
      c.pv = { max: n(p.pvMax, c.pv.max), atual: n(p.pvAtual, c.pv.atual) };
      c.pm = { max: n(p.pmMax, c.pm.max), atual: n(p.pmAtual, c.pm.atual) };
      c.defesa = n(p.defesa, c.defesa); c.iniciativa = n(p.iniciativa, c.iniciativa);
    },
    removerInimigo(s, p) {
      const vez = daVez(s);
      s.combate.inimigos = s.combate.inimigos.filter(i => i.id !== p.id);
      s.combate.ordem = ordemValida(s);
      const k = s.combate.ordem.indexOf(vez);
      s.combate.turno = k >= 0 ? k : Math.min(s.combate.turno, Math.max(0, s.combate.ordem.length - 1));
    },
    visibilidade(s, p) { const c = s.combate.inimigos.find(i => i.id === p.id); if (c) c.visivel = !c.visivel; },
    rolarIniciativa(s, p, rng) { rolarTodos(s, rng); if (s.combate.turno < 0) s.combate.turno = 0; log(s, 'Iniciativa rolada'); },
    /** Valor digitado (o jogador rolou o próprio d20 na mesa). */
    setIniciativa(s, p) {
      const vez = daVez(s);
      const c = achar(s, p.id); if (!c) return;
      const total = Math.floor(+p.total);
      if (isNaN(total)) return;
      s.combate.inis[p.id] = { d20: total - (c.iniciativa | 0), total, desempate: (s.combate.inis[p.id] || {}).desempate || Math.random(), manual: true };
      s.combate.ordem = R.ordenarIniciativa(combatentes(s), s.combate.inis);
      const k = s.combate.ordem.indexOf(vez); if (k >= 0) s.combate.turno = k;
    },
    proximoTurno(s, p, rng) {
      const o = ordemValida(s);
      s.combate.ordem = o;
      const prox = primeiroValido(s, s.combate.turno + 1);
      if (prox < 0) return { novaRodada: novaRodada(s, rng) };
      s.combate.turno = prox;
    },
    turnoAnterior(s) {
      const o = ordemValida(s);
      for (let i = s.combate.turno - 1; i >= 0; i--) { const c = achar(s, o[i]); if (c && !foraDeCombate(c)) { s.combate.turno = i; return; } }
    },
    irPara(s, p) { const k = ordemValida(s).indexOf(p.id); if (k >= 0) { s.combate.ordem = ordemValida(s); s.combate.turno = k; } },
    novaRodada(s, p, rng) { return { novaRodada: novaRodada(s, rng) }; },
    opcaoCombate(s, p) { if (p.chave in s.combate) s.combate[p.chave] = !!p.valor; },
    /** Fim do combate = fim da cena: condições terminam (p. 394). */
    encerrarCombate(s, p) {
      const derrotados = s.combate.inimigos.filter(i => i.pv.atual <= 0).length;
      s.modo = 'grupo';
      s.combate.ativo = false; s.combate.rodada = 0; s.combate.turno = 0; s.combate.ordem = []; s.combate.inis = {};
      if (!p || p.manterInimigos !== true) s.combate.inimigos = [];
      s.jogadores.forEach(j => { j.condicoes = R.fimDeCena(j.condicoes); });
      log(s, 'Fim do combate' + (derrotados ? ' · ' + derrotados + ' inimigo(s) derrotado(s)' : ''));
    },
    modo(s, p) { s.modo = p.modo === 'combate' ? 'combate' : 'grupo'; }
  };

  // ---------- Sincronização / persistência ----------
  const Sync = {
    sb: null, usuario: null, modo: 'local', canalRT: null,
    async iniciar() {
      if (CFG.supabaseUrl && CFG.supabaseAnonKey && raiz.supabase && raiz.supabase.createClient) {
        this.sb = raiz.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, storageKey: 't20s.auth' } });
        this.modo = 'supabase';
        const { data } = await this.sb.auth.getSession();
        this.usuario = data && data.session ? data.session.user : null;
      }
      return this;
    },
    online() { return this.modo === 'supabase'; },
    async entrar(email, senha) {
      const r = await this.sb.auth.signInWithPassword({ email, password: senha });
      if (r.error) throw r.error; this.usuario = r.data.user; return r.data.user;
    },
    async cadastrar(email, senha) {
      const r = await this.sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.href.split('?')[0] } });
      if (r.error) throw r.error;
      this.usuario = r.data.session ? r.data.user : null;
      return { confirmar: !r.data.session };
    },
    async sair() { if (this.sb) await this.sb.auth.signOut(); this.usuario = null; },
    async listarMesas() {
      if (!this.online()) return (LS.get('t20s.mesas') || []);
      const r = await this.sb.from('mesas').select('id,nome,atualizado').order('atualizado', { ascending: false });
      if (r.error) throw r.error; return r.data;
    },
    async criarMesa(nome) {
      const estado = estadoInicial(nome);
      if (!this.online()) {
        const id = 'local-' + uid();
        LS.set('t20s.mesas', [{ id, nome: estado.nome, atualizado: new Date().toISOString() }].concat(LS.get('t20s.mesas') || []));
        LS.set('t20s.mesa.' + id, estado); return id;
      }
      const r = await this.sb.from('mesas').insert({ nome: estado.nome, estado }).select('id').single();
      if (r.error) throw r.error; return r.data.id;
    },
    async excluirMesa(id) {
      LS.del('t20s.mesa.' + id);
      if (!this.online()) { LS.set('t20s.mesas', (LS.get('t20s.mesas') || []).filter(m => m.id !== id)); return; }
      const r = await this.sb.from('mesas').delete().eq('id', id); if (r.error) throw r.error;
    },
    async carregar(id) {
      const cache = LS.get('t20s.mesa.' + id);
      if (!this.online()) { if (!cache) throw new Error('Mesa não encontrada'); return cache; }
      const r = await this.sb.from('mesas').select('estado').eq('id', id).single();
      if (r.error) { if (cache) return cache; throw r.error; }
      return r.data.estado;
    },
    async salvar(id, estado) {
      LS.set('t20s.mesa.' + id, estado);
      if (!this.online()) {
        LS.set('t20s.mesas', (LS.get('t20s.mesas') || []).map(m => m.id === id ? { id, nome: estado.nome, atualizado: new Date().toISOString() } : m));
        return;
      }
      const r = await this.sb.from('mesas').update({ nome: estado.nome, estado, atualizado: new Date().toISOString() }).eq('id', id);
      if (r.error) throw r.error;
    },
    /** Escuta mudanças de outras abas/aparelhos. cb(estado) */
    assinar(id, cb) {
      this.desassinar();
      if (this.online()) {
        this.canalRT = this.sb.channel('mesa-' + id)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mesas', filter: 'id=eq.' + id },
            pl => { if (pl.new && pl.new.estado && pl.new.estado.origem !== ORIGEM) cb(pl.new.estado); })
          .subscribe();
      }
    },
    desassinar() { if (this.canalRT && this.sb) { this.sb.removeChannel(this.canalRT); this.canalRT = null; } }
  };

  // ---------- Store da tela do mestre ----------
  function criarStore() {
    let estado = null, mesaId = null, pilha = [], refazer = [], timer = null, salvando = false, pendente = false;
    const subs = new Set();
    const st = {
      erroSalvar: null,
      get estado() { return estado; }, get mesaId() { return mesaId; },
      podeDesfazer: () => pilha.length > 0, podeRefazer: () => refazer.length > 0,
      sub(fn) { subs.add(fn); return () => subs.delete(fn); },
      async abrir(id) {
        const e = await Sync.carregar(id);
        estado = Object.assign(estadoInicial(), e || {});
        estado.combate = Object.assign(estadoInicial().combate, estado.combate || {});
        mesaId = id; pilha = []; refazer = [];
        LS.set('t20s.mesaAtiva', id);
        Sync.assinar(id, remoto => { estado = remoto; emitir(false); });
        anunciar(); emitir(false);
      },
      fechar() { Sync.desassinar(); estado = null; mesaId = null; emitir(false); },
      /** Executa uma ação. Devolve o retorno da ação (notas, avisos). */
      acao(nome, p, rng) {
        if (!estado) return;
        const antes = clone(estado);
        const novo = clone(estado);
        const ret = ACOES[nome](novo, p || {}, rng);
        if (JSON.stringify(novo) === JSON.stringify(antes)) return ret;
        pilha.push(antes); if (pilha.length > 50) pilha.shift(); refazer = [];
        estado = novo; emitir(true);
        return ret;
      },
      desfazer() { if (!pilha.length) return; refazer.push(estado); estado = pilha.pop(); emitir(true); },
      refazer() { if (!refazer.length) return; pilha.push(estado); estado = refazer.pop(); emitir(true); },
      salvarAgora() { clearTimeout(timer); return gravar(); }
    };
    function anunciar() { if (CANAL && estado) CANAL.postMessage({ tipo: 'estado', mesaId, estado }); }
    function emitir(mudou) {
      if (mudou && estado) {
        estado.rev = (estado.rev || 0) + 1; estado.origem = ORIGEM;
        anunciar();
        LS.set('t20s.mesa.' + mesaId, estado);
        clearTimeout(timer); timer = setTimeout(gravar, 500);
      }
      subs.forEach(fn => fn(estado));
    }
    async function gravar() {
      if (!estado || !mesaId) return;
      if (salvando) { pendente = true; return; }
      salvando = true;
      try { await Sync.salvar(mesaId, estado); st.erroSalvar = null; }
      catch (e) { st.erroSalvar = e.message || String(e); }
      salvando = false;
      subs.forEach(fn => fn(estado));
      if (pendente) { pendente = false; gravar(); }
    }
    if (CANAL) CANAL.onmessage = ev => { if (ev.data && ev.data.tipo === 'pedir' && (!ev.data.mesaId || ev.data.mesaId === mesaId)) anunciar(); };
    raiz.addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); gravar(); } });
    return st;
  }

  const T20S = { ORIGEM, CANAL, LS, uid, estadoInicial, novoJogador, ACOES, Sync, criarStore, combatentes, achar, daVez, ordemValida, foraDeCombate };
  if (typeof module !== 'undefined' && module.exports) module.exports = T20S;
  else raiz.T20S = T20S;
})(typeof window !== 'undefined' ? window : globalThis);
