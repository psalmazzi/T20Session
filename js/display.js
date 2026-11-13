/* T20Session — tela dos jogadores (só leitura). Recebe o estado da tela do mestre:
 * BroadcastChannel (mesmo navegador), evento storage (fallback) e Supabase Realtime (outro aparelho). */
(function () {
  'use strict';
  const R = window.T20R, S = window.T20S, CFG = window.T20_CONFIG || {};
  const raiz = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sinal = n => (n >= 0 ? '+' : '') + n;
  const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString('pt-BR');

  const params = new URLSearchParams(location.search);
  // ?c=<codigo>: link público do mestre (celular dos jogadores). Nunca pede login; só lê.
  const codigo = (params.get('c') || '').trim() || null;
  let mesaId = codigo ? null : (params.get('mesa') || S.LS.get('t20s.mesaAtiva'));
  let estado = mesaId ? S.LS.get('t20s.mesa.' + mesaId) : null;
  let recebeu = !!estado;
  let linkInvalido = false;
  const inicio = Date.now();

  function receber(novo, id) {
    if (!novo) return;
    if (codigo && id) return; // no link público só vale o que vem do canal pub-<codigo>
    if (id && id !== mesaId) { mesaId = id; estado = null; assinarRemoto(); }
    if (estado && novo.origem === estado.origem && (novo.rev || 0) < (estado.rev || 0)) return; // chegou atrasado
    estado = novo; recebeu = true; render();
  }

  if (S.CANAL) {
    S.CANAL.addEventListener('message', ev => { const d = ev.data || {}; if (d.tipo === 'estado') receber(d.estado, d.mesaId); });
    S.CANAL.postMessage({ tipo: 'pedir', mesaId });
  }
  window.addEventListener('storage', ev => {
    if (mesaId && ev.key === 't20s.mesa.' + mesaId && ev.newValue) { try { receber(JSON.parse(ev.newValue)); } catch (e) { /* ignora */ } }
  });

  // ---------- Supabase (outro aparelho) ----------
  function carregarSupabase() {
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || window.supabase) return Promise.resolve();
    return new Promise(ok => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'; s.onload = ok; s.onerror = ok; document.head.appendChild(s); });
  }
  async function assinarRemoto() {
    if (!S.Sync.online() || !S.Sync.usuario || !mesaId) return;
    try { const e = await S.Sync.carregar(mesaId); if (e && (!estado || (e.rev || 0) > (estado.rev || 0) || e.origem !== estado.origem)) receber(e); } catch (e) { /* offline: fica no cache */ }
    S.Sync.assinar(mesaId, e => receber(e));
  }
  async function iniciarPublica() {
    if (!S.Sync.online()) { linkInvalido = 'offline'; render(); return; }
    S.Sync.assinarPublica(codigo, e => { if (!estado || (e.rev || 0) >= (estado.rev || 0) || e.origem !== estado.origem) { estado = e; recebeu = true; render(); } });
    try {
      const r = await S.Sync.carregarPublica(codigo);
      if (r && r.estado) { if (!estado) { estado = r.estado; recebeu = true; } }
      else if (!estado) linkInvalido = true;
    } catch (e) { if (!estado) linkInvalido = 'rede'; }
    render();
  }
  (async function () {
    await carregarSupabase();
    await S.Sync.iniciar();
    if (codigo) { iniciarPublica(); return; }
    if (S.Sync.online() && S.Sync.usuario) {
      if (!mesaId) { try { const m = await S.Sync.listarMesas(); if (m[0]) mesaId = m[0].id; } catch (e) { /* sem rede */ } }
      assinarRemoto();
    } else if (S.Sync.online()) {
      setTimeout(() => { if (!recebeu) login(); }, 1500);
    }
    render();
  })();

  // Aparelho sem sessão (TV, outro PC): entra uma vez com a conta do mestre.
  function login(msg) {
    raiz.innerHTML = `<div class="centro"><form class="caixa" id="f">
      <h1>T20Session</h1><div class="sub">Tela dos jogadores · entre com a conta do mestre</div>
      <input type="email" name="email" placeholder="E-mail" required><input type="password" name="senha" placeholder="Senha" required>
      <div class="erro">${esc(msg || '')}</div><button class="btn pri">Entrar</button></form></div>`;
    const f = document.getElementById('f');
    f.onsubmit = async ev => {
      ev.preventDefault();
      try { await S.Sync.entrar(f.email.value.trim(), f.senha.value); if (!mesaId) { const m = await S.Sync.listarMesas(); if (m[0]) mesaId = m[0].id; } await assinarRemoto(); render(); }
      catch (e) { login('Não foi possível entrar: ' + (e.message || e)); }
    };
  }

  // ---------- Render ----------
  const ESPADAS = '\u2694\uFE0E';
  // ◔ (U+25D4) em SVG: o glifo falta em várias fontes do sistema.
  const RACAO = '<svg class="ic-racao" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 10V3.5A6.5 6.5 0 0 1 16.5 10Z" class="cheio"/></svg>';
  function barra(tipo, r, extra) {
    const pct = r.max > 0 ? Math.max(0, Math.min(100, r.atual / r.max * 100)) : 0;
    return `<div class="d-barra ${tipo} ${extra || ''}"><span class="rot">${tipo.toUpperCase()}</span>
      <span class="trilho"><i style="width:${pct}%"></i></span><span class="num">${r.atual} / ${r.max}</span></div>`;
  }
  function conds(c) {
    const l = c.condicoes || [];
    if (!l.length) return '';
    return `<div class="d-conds">${l.map(x => {
      const d = x.dur || {};
      const dur = d.tipo === 'rodadas' ? ` <i>${d.rest}r</i>` : '';
      const txt = R.curtoCondicao(x);
      return `<span class="d-cond ${R.perigoCondicao(x) ? 'perigo' : ''}"><b>${esc(R.nomeCondicao(x))}</b>${dur}${txt ? `<small>${esc(txt)}</small>` : ''}</span>`;
    }).join('')}</div>`;
  }
  /** Rótulo de jogador caído/morto (#FFB4B4, sem ícone). */
  function rotuloGrave(j) {
    if (R.estaMorto(j)) return `<span class="d-grave">Morto${j.morto === 'fome' ? ' (fome)' : ''}</span>`;
    if (R.estadoPV(j.pv.atual, j.pv.max) === 'caido') return `<span class="d-grave">Caído · faltam ${j.pv.atual - R.limiarMorte(j.pv.max)}</span>`;
    return '';
  }
  function classePV(j) { const e = R.estadoPV(j.pv.atual, j.pv.max); return e === 'critico' ? 'critico' : (e === 'caido' || e === 'morto') ? 'zerado' : ''; }

  const MONITOR = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 17h6M10 13.5V17"/></svg>';
  function render() {
    if (!raiz) return;
    if (!estado) {
      let msg;
      if (codigo && linkInvalido) {
        msg = `<div class="d-espera"><b>T20Session · Tela dos jogadores</b>
          <p>${linkInvalido === true ? 'Este link não está mais ativo. Peça ao mestre o link novo.' : linkInvalido === 'offline' ? 'Este link precisa de internet para funcionar.' : 'Sem conexão com o servidor. Tentando de novo ao recarregar a página.'}</p></div>`;
      } else if (Date.now() - inicio < 5000) {
        msg = '<div class="d-msg">Aguardando a tela do mestre…</div>';
      } else {
        msg = `<div class="d-espera"><b>T20Session · Tela dos jogadores</b>
          <p>Esta tela mostra aos jogadores o grupo e a ordem do combate.</p>
          <p>Na tela do mestre, abra a mesa e clique em <span class="d-ic">${MONITOR}</span> Tela dos jogadores.</p>
          <p class="d-nota">Arraste esta janela para a TV · duplo clique = tela cheia</p></div>`;
      }
      raiz.innerHTML = `<div class="d-raiz">${msg}</div>`;
      return;
    }
    const s = S.normalizar(estado), cb = s.combate;
    const emCombate = cb.ativo;
    document.title = s.nome + ' · Jogadores';
    raiz.innerHTML = `<div class="d-raiz">
      <header class="d-topo"><h1>${esc(s.nome)}</h1>
        <div class="d-info">${emCombate ? `<span class="gl">${ESPADAS}</span> Rodada ${cb.rodada}` : ''}</div></header>
      <div class="d-corpo">${emCombate ? htmlCombate(s) : htmlGrupo(s)}</div></div>`;
    ajustarDensidade();
  }
  /** Se a lista não couber, compacta (sem rolagem na TV). */
  function ajustarDensidade() {
    const o = raiz.querySelector('.d-ordem, .d-grade'); if (!o) return;
    const corpo = raiz.querySelector('.d-corpo');
    ['denso', 'muito-denso'].forEach(c => { if (corpo.scrollHeight > corpo.clientHeight + 1) o.classList.add(c); });
  }

  function htmlGrupo(s) {
    if (!s.jogadores.length) return '<div class="d-msg">O grupo ainda não tem personagens.</div>';
    return `<div class="d-grade">${s.jogadores.map(j => {
      const e = R.estadoPV(j.pv.atual, j.pv.max);
      const cd = R.cdFome(j.diasSemComer);
      return `<div class="d-card ${R.estaMorto(j) ? 'morto' : e === 'caido' ? 'caido' : ''}">
        <div class="d-nome"><b>${esc(j.nome)}</b><span>Nv ${j.nivel}${j.jogador ? ' · ' + esc(j.jogador) : ''}</span></div>
        ${rotuloGrave(j)}
        ${barra('pv', j.pv, classePV(j))}${barra('pm', j.pm)}
        <div class="d-stats"><span>DEF <b>${j.defesa}</b></span><span>INI <b>${sinal(j.iniciativa)}</b></span>
          <span>T$ <b>${fmtNum(j.dinheiro)}</b></span><span><span class="d-racao" title="Rações">${RACAO}</span> <b>${j.racoes}</b></span></div>
        ${j.diasSemComer ? `<div class="d-aviso">${j.diasSemComer} dia(s) sem comer${cd ? ` · Fortitude CD ${cd}` : ''}</div>` : ''}
        ${conds(j)}
      </div>`;
    }).join('')}</div>`;
  }

  function htmlCombate(s) {
    const cb = s.combate;
    const todos = s.jogadores.concat(cb.inimigos || []);
    const mapa = Object.fromEntries(todos.map(c => [c.id, c]));
    // ocultos: ids de inimigos ocultos que o link público não traz (a vez deles vira "???")
    const ocultos = new Set(cb.ocultos || []);
    const ordem = (cb.ordem || []).filter(id => mapa[id] || ocultos.has(id));
    const vezId = ordem[cb.turno];
    const visivel = c => c.tipo !== 'inimigo' || c.visivel;
    const visiveis = ordem.map(id => mapa[id]).filter(c => c && visivel(c));   // oculto: nem placeholder
    const vez = mapa[vezId];
    const vezVisivel = vez && visivel(vez);
    // próximo visível que vai agir
    let prox = null;
    for (let k = 1; k <= ordem.length; k++) {
      const c = mapa[ordem[(cb.turno + k) % ordem.length]];
      if (c && c.id !== vezId && visivel(c) && !(c.tipo === 'inimigo' && c.pv.atual <= 0)) { prox = c; break; }
    }
    const linhas = visiveis.map(c => {
      const ini = (cb.inis || {})[c.id];
      const derrotado = c.tipo === 'inimigo' && c.pv.atual <= 0;
      const e = R.estadoPV(c.pv.atual, c.pv.max);
      const caido = c.tipo === 'jogador' && (e === 'caido' || R.estaMorto(c));
      let recs;
      if (c.tipo === 'jogador') recs = barra('pv', c.pv, classePV(c)) + (c.pm.max > 0 ? barra('pm', c.pm) : '');
      else if (derrotado) recs = '<div class="d-estado derrotado">Derrotado</div>';
      else if (cb.mostrarPVInimigos) recs = barra('pv', c.pv, e === 'critico' ? 'critico' : '');
      else {
        const d = R.descricaoInimigo(c.pv.atual, c.pv.max);
        const cls = { Ileso: 'ileso', Ferido: 'ferido', 'Muito ferido': 'muito', 'Quase caindo': 'quase' }[d];
        recs = `<div class="d-estado ${cls}">${d}</div>`;
      }
      return `<div class="d-linha ${c.tipo} ${c.id === vezId ? 'vez' : ''} ${derrotado ? 'derrotado' : ''} ${caido ? 'caido' : ''}">
        <div class="d-ini">${ini ? ini.total : '–'}</div>
        <div class="d-n"><b>${esc(c.nome)}</b><small>${c.tipo === 'jogador' ? 'DEF ' + c.defesa : 'Inimigo'}</small>${c.tipo === 'jogador' ? rotuloGrave(c) : ''}</div>
        <div class="d-recs">${recs}</div>
        <div class="d-cs">${conds(c)}</div></div>`;
    }).join('');
    return `<div class="d-vez"><span class="rot">Vez de</span><span class="quem">${vezVisivel ? esc(vez.nome) : '???'}</span>
        ${prox ? `<span class="prox">Depois: <b>${esc(prox.nome)}</b></span>` : ''}</div>
      <div class="d-ordem">${linhas}</div>`;
  }
  window.addEventListener('resize', () => render());
  setTimeout(() => { if (!estado) render(); }, 5100); // troca a espera pela explicação (sem mesa há 5 s)

  // Tela cheia com duplo clique; mantém a tela acesa
  document.addEventListener('dblclick', () => { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); else if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); });
  let trava = null;
  async function manterAcesa() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') trava = await navigator.wakeLock.request('screen'); } catch (e) { /* sem suporte */ } }
  document.addEventListener('visibilitychange', manterAcesa); manterAcesa();
  render();
})();
