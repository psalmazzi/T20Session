/* T20Session — tela dos jogadores (só leitura). Recebe o estado da tela do mestre:
 * BroadcastChannel (mesmo navegador), evento storage (fallback) e Supabase Realtime (outro aparelho). */
(function () {
  'use strict';
  const R = window.T20R, S = window.T20S, CFG = window.T20_CONFIG || {};
  const raiz = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sinal = n => (n >= 0 ? '+' : '') + n;
  const fmtT = n => 'T$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR');

  let mesaId = new URLSearchParams(location.search).get('mesa') || S.LS.get('t20s.mesaAtiva');
  let estado = mesaId ? S.LS.get('t20s.mesa.' + mesaId) : null;
  let recebeu = !!estado;

  function receber(novo, id) {
    if (!novo) return;
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
  (async function () {
    await carregarSupabase();
    await S.Sync.iniciar();
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
      <div class="erro">${esc(msg || '')}</div><button class="btn primario">Entrar</button></form></div>`;
    const f = document.getElementById('f');
    f.onsubmit = async ev => {
      ev.preventDefault();
      try { await S.Sync.entrar(f.email.value.trim(), f.senha.value); if (!mesaId) { const m = await S.Sync.listarMesas(); if (m[0]) mesaId = m[0].id; } await assinarRemoto(); render(); }
      catch (e) { login('Não foi possível entrar: ' + (e.message || e)); }
    };
  }

  // ---------- Render ----------
  function barra(tipo, r, txt, extra) {
    const pct = r.max > 0 ? Math.max(0, Math.min(100, r.atual / r.max * 100)) : 0;
    return `<div class="d-barra ${tipo} ${extra || ''}"><span class="rot">${tipo.toUpperCase()}</span>
      <div class="trilho"><i style="width:${pct}%"></i><span>${txt == null ? r.atual + ' / ' + r.max : txt}</span></div></div>`;
  }
  function conds(c, curto) {
    const l = c.condicoes || [];
    if (!l.length) return '';
    return `<div class="d-conds">${l.map(x => {
      const d = x.dur || {};
      const dur = d.tipo === 'rodadas' ? ` · ${d.rest} rod.` : '';
      const txt = R.curtoCondicao(x);
      return `<span class="d-cond ${R.perigoCondicao(x) ? 'perigo' : ''}"><b>${esc(R.nomeCondicao(x))}</b>${dur}${curto && txt ? `<small>${esc(txt)}</small>` : ''}</span>`;
    }).join('')}</div>`;
  }
  function avisoPV(j) {
    const e = R.estadoPV(j.pv.atual, j.pv.max);
    if (e === 'morto') return '<div class="d-aviso forte">☠ No limiar da morte</div>';
    if (e === 'caido') return `<div class="d-aviso forte">🩸 Caído · morre em ${R.limiarMorte(j.pv.max)}</div>`;
    return '';
  }

  function render() {
    if (!raiz) return;
    if (!estado) {
      raiz.innerHTML = `<div class="d-raiz"><div class="d-msg">${mesaId ? 'Aguardando a tela do mestre…' : 'Abra uma mesa na tela do mestre e clique em “Tela dos jogadores”.'}</div></div>`;
      return;
    }
    const s = estado, cb = s.combate || {};
    const emCombate = cb.ativo;
    document.title = s.nome + ' · Jogadores';
    raiz.innerHTML = `<div class="d-raiz">
      <div class="d-topo"><h1>${esc(s.nome)}</h1>
        <div class="d-info">${emCombate ? `⚔ Rodada <b>${cb.rodada}</b>` : `Dia <b>${s.dia || 1}</b>`}</div></div>
      <div class="d-corpo">${emCombate ? htmlCombate(s) : htmlGrupo(s)}</div></div>`;
  }

  function htmlGrupo(s) {
    if (!s.jogadores.length) return '<div class="d-msg">O grupo ainda não tem personagens.</div>';
    return `<div class="d-grade">${s.jogadores.map(j => {
      const e = R.estadoPV(j.pv.atual, j.pv.max);
      const cd = R.cdFome(j.diasSemComer);
      return `<div class="d-card ${e === 'caido' ? 'caido' : e === 'morto' ? 'morto' : ''}">
        <div class="d-nome"><b>${esc(j.nome)}</b><span>Nv ${j.nivel}${j.jogador ? ' · ' + esc(j.jogador) : ''}</span></div>
        ${barra('pv', j.pv, null, e)}${barra('pm', j.pm)}
        ${avisoPV(j)}
        <div class="d-stats"><span class="d-stat">DEF <b>${j.defesa}</b></span><span class="d-stat">INI <b>${sinal(j.iniciativa)}</b></span>
          <span class="d-stat">💰 <b>${fmtT(j.dinheiro)}</b></span><span class="d-stat">🍞 <b>${j.racoes}</b></span></div>
        ${j.diasSemComer ? `<div class="d-aviso">${j.diasSemComer} dia(s) sem comer${cd ? ` · Fortitude CD ${cd}` : ''}</div>` : ''}
        ${conds(j, true)}
      </div>`;
    }).join('')}</div>`;
  }

  function htmlCombate(s) {
    const cb = s.combate;
    const todos = s.jogadores.concat(cb.inimigos || []);
    const mapa = Object.fromEntries(todos.map(c => [c.id, c]));
    const ordem = (cb.ordem || []).filter(id => mapa[id]);
    const vezId = ordem[cb.turno];
    const visiveis = ordem.map(id => mapa[id]).filter(c => c.tipo !== 'inimigo' || c.visivel);
    const vez = mapa[vezId];
    const vezVisivel = vez && (vez.tipo !== 'inimigo' || vez.visivel);
    // próximo visível e de pé
    let prox = null;
    for (let k = 1; k <= ordem.length; k++) {
      const c = mapa[ordem[(cb.turno + k) % ordem.length]];
      if (c && c.id !== vezId && (c.tipo !== 'inimigo' || (c.visivel && c.pv.atual > 0))) { prox = c; break; }
    }
    const denso = visiveis.length > 7;
    const linhas = visiveis.map(c => {
      const ini = (cb.inis || {})[c.id];
      const derrotado = c.tipo === 'inimigo' && c.pv.atual <= 0;
      const e = R.estadoPV(c.pv.atual, c.pv.max);
      let recs;
      if (c.tipo === 'jogador') recs = barra('pv', c.pv, null, e) + (c.pm.max > 0 ? barra('pm', c.pm) : '');
      else if (cb.mostrarPVInimigos) recs = barra('pv', c.pv, null, e);
      else {
        const d = R.descricaoInimigo(c.pv.atual, c.pv.max);
        const cls = { Ileso: 'ileso', Ferido: 'ferido', 'Muito ferido': 'muito', 'Quase caindo': 'quase', Derrotado: 'derrotado' }[d];
        recs = `<div class="d-estado ${cls}">${d}</div>`;
      }
      return `<div class="d-linha ${c.tipo} ${c.id === vezId ? 'vez' : ''} ${derrotado ? 'derrotado' : ''} ${c.tipo === 'jogador' && e === 'caido' ? 'caido' : ''}">
        <div class="d-ini">${ini ? ini.total : '–'}</div>
        <div class="d-n"><b>${esc(c.nome)}</b><small>${c.tipo === 'jogador' ? 'DEF ' + c.defesa : 'Inimigo'}</small>${c.tipo === 'jogador' ? avisoPV(c) : ''}</div>
        <div class="d-recs">${recs}</div>
        <div>${conds(c, !denso)}</div></div>`;
    }).join('');
    return `<div class="d-vez"><span class="rot">Vez de</span><span class="quem">${vezVisivel ? esc(vez.nome) : '???'}</span>
        ${prox ? `<span class="prox">Depois: <b>${esc(prox.nome)}</b></span>` : ''}</div>
      <div class="d-ordem ${denso ? 'denso' : ''}">${linhas}</div>`;
  }

  // Tela cheia com duplo clique; mantém a tela acesa
  document.addEventListener('dblclick', () => { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); else if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); });
  let trava = null;
  async function manterAcesa() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') trava = await navigator.wakeLock.request('screen'); } catch (e) { /* sem suporte */ } }
  document.addEventListener('visibilitychange', manterAcesa); manterAcesa();
  render();
})();
