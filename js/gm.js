/* T20Session — tela do mestre */
(function () {
  'use strict';
  const R = window.T20R, S = window.T20S, CFG = window.T20_CONFIG || {};
  const store = S.criarStore();
  const app = document.getElementById('app');
  const modalRaiz = document.getElementById('modal');
  const toastRaiz = document.getElementById('toast');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sinal = n => (n >= 0 ? '+' : '') + n;
  const fmtT = n => 'T$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR');
  let tela = 'carregando';

  // ---------- Inicialização ----------
  function carregarSupabase() {
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || window.supabase) return Promise.resolve();
    return new Promise(ok => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = ok; s.onerror = ok; document.head.appendChild(s);
    });
  }
  async function boot() {
    await carregarSupabase();
    await S.Sync.iniciar();
    if (S.Sync.online() && !S.Sync.usuario) return telaLogin();
    const ativa = S.LS.get('t20s.mesaAtiva');
    if (ativa) { try { await abrirMesa(ativa); return; } catch (e) { /* mesa sumiu */ } }
    telaMesas();
  }
  async function abrirMesa(id) {
    tela = 'mesa';
    try { await store.abrir(id); } catch (e) { tela = 'mesas'; throw e; }
    render();
  }

  // ---------- Login ----------
  function telaLogin(msg) {
    tela = 'login';
    app.innerHTML = `<div class="centro"><form class="caixa" id="f-login">
      <h1>T20Session</h1><div class="sub">Gestão de sessão · Tormenta20</div>
      <label class="campo">E-mail<input type="email" name="email" required autocomplete="email"></label>
      <label class="campo">Senha<input type="password" name="senha" required minlength="6" autocomplete="current-password"></label>
      <div class="erro" id="login-erro">${esc(msg || '')}</div>
      <button class="btn primario grande" type="submit">Entrar</button>
      <button class="btn" type="button" id="b-cadastrar">Criar conta</button>
    </form></div>`;
    const f = document.getElementById('f-login');
    const erro = document.getElementById('login-erro');
    f.onsubmit = async ev => {
      ev.preventDefault(); erro.textContent = '';
      try { await S.Sync.entrar(f.email.value.trim(), f.senha.value); boot(); }
      catch (e) { erro.textContent = traduzErro(e); }
    };
    document.getElementById('b-cadastrar').onclick = async () => {
      if (!f.reportValidity()) return;
      erro.textContent = '';
      try {
        const r = await S.Sync.cadastrar(f.email.value.trim(), f.senha.value);
        if (r.confirmar) erro.textContent = 'Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.';
        else boot();
      } catch (e) { erro.textContent = traduzErro(e); }
    };
  }
  function traduzErro(e) {
    const m = (e && e.message) || String(e);
    if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme o e-mail antes de entrar (veja sua caixa de entrada).';
    if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Use Entrar.';
    if (/Failed to fetch/i.test(m)) return 'Sem conexão com o servidor.';
    return m;
  }

  // ---------- Mesas ----------
  async function telaMesas(erroMsg) {
    tela = 'mesas';
    if (store.estado) store.fechar();
    let mesas = [];
    try { mesas = await S.Sync.listarMesas(); } catch (e) { erroMsg = traduzErro(e); }
    app.innerHTML = `<div class="centro"><div class="caixa">
      <h1>T20Session</h1>
      <div class="sub">${S.Sync.online() ? esc(S.Sync.usuario.email) : 'Modo local · dados só neste navegador'}</div>
      <div class="lista-mesas">${mesas.length ? mesas.map(m => `
        <div class="mesa"><button class="abrir" data-abrir="${esc(m.id)}">${esc(m.nome)}<small>${m.atualizado ? new Date(m.atualizado).toLocaleString('pt-BR') : ''}</small></button>
        <button class="btn peq perigo" data-excluir="${esc(m.id)}">Excluir</button></div>`).join('') : '<div class="nota">Nenhuma mesa ainda.</div>'}
      </div>
      <form id="f-mesa" class="barra" style="margin:0"><input type="text" name="nome" placeholder="Nome da nova mesa" required maxlength="60" style="flex:1;width:auto">
      <button class="btn primario">Criar</button></form>
      <div class="erro">${esc(erroMsg || '')}</div>
      ${S.Sync.online() ? '<button class="btn" id="b-sair">Sair da conta</button>' : ''}
    </div></div>`;
    document.getElementById('f-mesa').onsubmit = async ev => {
      ev.preventDefault();
      try { const id = await S.Sync.criarMesa(ev.target.nome.value.trim()); await abrirMesa(id); }
      catch (e) { telaMesas(traduzErro(e)); }
    };
    app.querySelectorAll('[data-abrir]').forEach(b => b.onclick = async () => {
      try { await abrirMesa(b.dataset.abrir); } catch (e) { telaMesas(traduzErro(e)); }
    });
    app.querySelectorAll('[data-excluir]').forEach(b => b.onclick = async () => {
      if (b.dataset.conf !== '1') { b.dataset.conf = '1'; b.textContent = 'Confirmar?'; return; }
      try { await S.Sync.excluirMesa(b.dataset.excluir); if (S.LS.get('t20s.mesaAtiva') === b.dataset.excluir) S.LS.del('t20s.mesaAtiva'); telaMesas(); }
      catch (e) { telaMesas(traduzErro(e)); }
    });
    const sair = document.getElementById('b-sair');
    if (sair) sair.onclick = async () => { await S.Sync.sair(); S.LS.del('t20s.mesaAtiva'); telaLogin(); };
  }

  // ---------- Render da mesa ----------
  store.sub(() => { if (tela === 'mesa' && store.estado) render(); });

  function render() {
    const s = store.estado;
    const foco = document.activeElement && document.activeElement.id;
    const syncCls = !S.Sync.online() ? 'local' : store.erroSalvar ? 'erro' : '';
    const syncTit = !S.Sync.online() ? 'Modo local (sem login)' : store.erroSalvar ? 'Erro ao salvar: ' + store.erroSalvar : 'Sincronizado';
    app.innerHTML = `
      <header class="topo">
        <h1 data-a="renomear" title="Renomear mesa">${esc(s.nome)}</h1>
        <span class="dia">Dia ${s.dia || 1}${s.combate.ativo ? ' · Rodada ' + s.combate.rodada : ''}</span>
        <div class="abas">
          <button data-a="modo" data-v="grupo" class="${s.modo === 'grupo' ? 'ativa' : ''}">Grupo</button>
          <button data-a="modo" data-v="combate" class="${s.modo === 'combate' ? 'ativa' : ''}">Combate${s.combate.ativo ? ' ⚔' : ''}</button>
        </div>
        <span class="espaco"></span>
        <button class="btn peq" data-a="desfazer" ${store.podeDesfazer() ? '' : 'disabled'} title="Desfazer (Ctrl+Z)">↶ Desfazer</button>
        <button class="btn peq" data-a="refazer" ${store.podeRefazer() ? '' : 'disabled'} title="Refazer (Ctrl+Y)">↷</button>
        <button class="btn peq" data-a="display" title="Abrir a tela dos jogadores em outra janela">📺 Tela dos jogadores</button>
        <span class="sync ${syncCls}" title="${esc(syncTit)}"></span>
        <button class="btn peq" data-a="mesas">Mesas</button>
      </header>
      <main>${s.modo === 'combate' ? htmlCombate(s) : htmlGrupo(s)}</main>`;
    if (foco) { const el = document.getElementById(foco); if (el) el.focus(); }
  }

  function barraRec(c, tipo) {
    const r = c[tipo];
    const pct = r.max > 0 ? Math.max(0, Math.min(100, r.atual / r.max * 100)) : 0;
    const est = tipo === 'pv' ? R.estadoPV(r.atual, r.max) : '';
    return `<div class="recurso ${tipo} ${est}">
      <span class="rot">${tipo.toUpperCase()}</span>
      <div class="barra-rec"><i style="width:${pct}%"></i><span>${r.atual} / ${r.max}</span></div>
      <div class="ajuste">
        <button class="btn icone ${tipo === 'pv' ? 'dano' : 'mana'}" data-a="${tipo}-" data-id="${c.id}" title="${tipo === 'pv' ? 'Dano' : 'Gastar PM'} (valor ao lado; vazio = 1)">−</button>
        <input type="number" inputmode="numeric" min="0" id="v-${tipo}-${c.id}" placeholder="1" aria-label="valor">
        <button class="btn icone cura" data-a="${tipo}+" data-id="${c.id}" title="${tipo === 'pv' ? 'Cura' : 'Recuperar PM'}">+</button>
      </div></div>`;
  }

  function chipsCond(c) {
    return `<div class="chips">${(c.condicoes || []).map(x => {
      const d = x.dur || {}; const dur = d.tipo === 'rodadas' ? d.rest + 'r' : d.tipo === 'indef' ? '∞' : 'cena';
      return `<span class="chip ${R.perigoCondicao(x) ? 'perigo' : ''}" title="${esc(R.curtoCondicao(x))}">${esc(R.nomeCondicao(x))} <small>${dur}</small><button data-a="rmcond" data-id="${c.id}" data-uid="${x.id}" aria-label="remover">×</button></span>`;
    }).join('')}<span class="chip add" data-a="addcond" data-id="${c.id}">+ condição</span></div>`;
  }

  function avisoPV(c) {
    if (c.tipo !== 'jogador') return '';
    const e = R.estadoPV(c.pv.atual, c.pv.max);
    if (e === 'morto') return `<div class="aviso forte">☠ PV no limiar de morte (${R.limiarMorte(c.pv.max)})</div>`;
    if (e === 'caido') return `<div class="aviso forte">🩸 Caído · morre em ${R.limiarMorte(c.pv.max)} (faltam ${c.pv.atual - R.limiarMorte(c.pv.max)})</div>`;
    return '';
  }

  // ---------- Grupo ----------
  function htmlGrupo(s) {
    const cards = s.jogadores.map((j, i) => {
      const e = R.estadoPV(j.pv.atual, j.pv.max);
      const cd = R.cdFome(j.diasSemComer);
      return `<article class="card ${e === 'caido' ? 'caido' : e === 'morto' ? 'morto' : ''}">
        <div class="card-topo"><span class="nome">${esc(j.nome)}</span><span class="sub">Nv ${j.nivel}${j.jogador ? ' · ' + esc(j.jogador) : ''}</span>
          <span class="acoes">
            <button class="btn icone peq" data-a="mover" data-id="${j.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="Mover para a esquerda">‹</button>
            <button class="btn icone peq" data-a="mover" data-id="${j.id}" data-dir="1" ${i === s.jogadores.length - 1 ? 'disabled' : ''} title="Mover para a direita">›</button>
            <button class="btn icone peq" data-a="editar" data-id="${j.id}" title="Editar">✎</button></span></div>
        ${barraRec(j, 'pv')}${barraRec(j, 'pm')}${avisoPV(j)}
        <div class="stats"><span class="stat">DEF <b>${j.defesa}</b></span><span class="stat">INI <b>${sinal(j.iniciativa)}</b></span></div>
        <div class="linha-recursos">
          <span class="contador">💰 <b>${fmtT(j.dinheiro)}</b>
            <input type="number" step="0.01" min="0" id="v-din-${j.id}" placeholder="T$" style="width:64px;min-height:28px;padding:2px 6px" aria-label="valor em tibares">
            <button class="btn" data-a="din-" data-id="${j.id}" title="Gastar">−</button><button class="btn" data-a="din+" data-id="${j.id}" title="Receber">+</button></span>
          <span class="contador">🍞 <b>${j.racoes}</b>
            <button class="btn" data-a="rac-" data-id="${j.id}" title="Tirar 1 ração">−</button><button class="btn" data-a="rac+" data-id="${j.id}" title="Somar 1 ração">+</button></span>
        </div>
        ${j.diasSemComer ? `<div class="aviso">${j.diasSemComer} dia(s) sem comer${cd ? ` · Fortitude CD ${cd} hoje (falhas: fatigado → exausto → inconsciente → morte)` : ' · sem efeito no 1º dia'}</div>` : ''}
        ${chipsCond(j)}
      </article>`;
    }).join('');
    return `<div class="barra">
        <button class="btn primario" data-a="descanso">🌙 Descanso</button>
        <button class="btn" data-a="alimentar">🍞 Alimentar grupo</button>
        <button class="btn" data-a="limparcond" title="Condições terminam no fim da cena, salvo indicação (p. 394)">Limpar condições de cena</button>
        <span class="espaco"></span>
        <button class="btn" data-a="novo">+ Personagem</button>
        <button class="btn primario" data-a="iniciar">⚔ ${s.combate.ativo ? 'Voltar ao combate' : 'Iniciar combate'}</button>
      </div>
      ${s.jogadores.length ? `<div class="grade">${cards}</div>` : `<div class="vazio">Adicione os personagens do grupo para começar.<br><br><button class="btn primario" data-a="novo">+ Personagem</button></div>`}`;
  }

  // ---------- Combate ----------
  function htmlCombate(s) {
    const cb = s.combate;
    const todos = S.combatentes(s);
    const ordem = cb.ativo ? S.ordemValida(s).map(id => S.achar(s, id)) : todos;
    const vez = S.daVez(s);
    const vezC = vez && S.achar(s, vez);
    const linhas = ordem.map((c, i) => {
      const ini = cb.inis[c.id];
      const est = R.estadoPV(c.pv.atual, c.pv.max);
      const cls = [c.tipo, c.id === vez ? 'vez' : '', S.foraDeCombate(c) ? 'derrotado' : '', c.tipo === 'jogador' && est === 'caido' ? 'caido' : '', c.tipo === 'inimigo' && !c.visivel ? 'oculto' : ''].join(' ');
      return `<div class="linha-ini ${cls}">
        <div class="ini-num">${cb.ativo ? `<input type="number" id="ini-${c.id}" data-ini="${c.id}" value="${ini ? ini.total : ''}" title="Total de iniciativa (pode digitar o que o jogador rolou)"><small>${ini ? (ini.manual ? 'digitado' : 'd20 ' + ini.d20) : ''}</small>` : '<small>—</small>'}</div>
        <div class="ini-nome"><div class="nome" data-a="irpara" data-id="${c.id}" title="Passar a vez para este">${c.id === vez ? '▶ ' : ''}${esc(c.nome)}</div>
          <div class="sub">${c.tipo === 'jogador' ? 'Jogador · Nv ' + c.nivel : 'Inimigo'} · DEF ${c.defesa} · INI ${sinal(c.iniciativa)}</div>${avisoPV(c)}</div>
        <div class="ini-rec">${barraRec(c, 'pv')}${c.pm.max > 0 ? barraRec(c, 'pm') : ''}</div>
        <div class="ini-cond">${chipsCond(c)}</div>
        <div class="ini-acoes">${c.tipo === 'inimigo' ? `
          <button class="btn icone peq" data-a="visivel" data-id="${c.id}" title="${c.visivel ? 'Esconder da tela dos jogadores' : 'Mostrar na tela dos jogadores'}">${c.visivel ? '👁' : '🚫'}</button>
          <button class="btn icone peq" data-a="editarini" data-id="${c.id}" title="Editar">✎</button>
          <button class="btn icone peq perigo" data-a="rmini" data-id="${c.id}" title="Remover">✕</button>` : `<button class="btn icone peq" data-a="editar" data-id="${c.id}" title="Editar">✎</button>`}
        </div></div>`;
    }).join('');
    const opc = (chave, rot, tit) => `<label class="check" title="${esc(tit)}"><input type="checkbox" data-opc="${chave}" ${cb[chave] ? 'checked' : ''}> ${rot}</label>`;
    return `
      <div class="painel-turno">
        ${cb.ativo ? `<span class="rodada">Rodada ${cb.rodada}</span>
          <span class="vez">Vez de <b>${vezC ? esc(vezC.nome) : '—'}</b></span>
          <span class="espaco" style="flex:1"></span>
          <button class="btn" data-a="anterior" title="Turno anterior">◀</button>
          <button class="btn primario grande" data-a="proximo" title="Próximo turno (→)">Próximo turno ▶</button>
          <button class="btn" data-a="novarodada" title="Encerra a rodada agora">Nova rodada</button>
          <button class="btn" data-a="rolar">🎲 Rolar iniciativa</button>
          <button class="btn perigo" data-a="encerrar">Encerrar combate</button>`
        : `<span class="vez">Prepare os inimigos e comece o combate. A iniciativa é rolada para todos ao iniciar.</span>
          <span class="espaco" style="flex:1"></span>
          <button class="btn primario grande" data-a="iniciar" ${todos.length ? '' : 'disabled'}>⚔ Iniciar combate</button>`}
        <button class="btn" data-a="addini">+ Inimigo</button>
      </div>
      <div class="opcoes">
        ${opc('rerrolarCadaRodada', 'Rolar iniciativa a cada rodada', 'No livro, a iniciativa é rolada só no início do combate (p. 230). Ligado, o app rola de novo no começo de cada rodada.')}
        ${opc('inimigosEmGrupo', 'Inimigos fazem um único teste', 'Regra do livro (p. 230): o mestre faz um teste para todos os inimigos, usando o menor bônus.')}
        ${opc('mostrarPVInimigos', 'Mostrar PV dos inimigos na tela', 'Desligado, a tela dos jogadores mostra só Ileso / Ferido / Muito ferido / Quase caindo.')}
      </div>
      ${ordem.length ? `<div class="lista-ini">${linhas}</div>` : '<div class="vazio">Sem combatentes. Adicione personagens na aba Grupo e inimigos aqui.</div>'}`;
  }

  // ---------- Eventos ----------
  function valor(id, padrao) { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) || v <= 0 ? padrao : v; }
  function acao(nome, p) {
    const ret = store.acao(nome, p);
    return ret;
  }

  app.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b || tela !== 'mesa') return;
    const id = b.dataset.id, s = store.estado;
    switch (b.dataset.a) {
      case 'modo': acao('modo', { modo: b.dataset.v }); break;
      case 'desfazer': store.desfazer(); break;
      case 'refazer': store.refazer(); break;
      case 'mesas': store.salvarAgora(); telaMesas(); break;
      case 'display': window.open('display.html?mesa=' + encodeURIComponent(store.mesaId), 't20display', 'popup,width=1280,height=800'); break;
      case 'renomear': modalRenomear(); break;
      case 'pv-': acao('vida', { id, n: Math.floor(valor('v-pv-' + id, 1)), tipo: 'dano' }); break;
      case 'pv+': acao('vida', { id, n: Math.floor(valor('v-pv-' + id, 1)), tipo: 'cura' }); break;
      case 'pm-': acao('mana', { id, n: Math.floor(valor('v-pm-' + id, 1)), tipo: 'gastar' }); break;
      case 'pm+': acao('mana', { id, n: Math.floor(valor('v-pm-' + id, 1)), tipo: 'recuperar' }); break;
      case 'din-': acao('recurso', { id, campo: 'dinheiro', delta: -valor('v-din-' + id, 1) }); break;
      case 'din+': acao('recurso', { id, campo: 'dinheiro', delta: valor('v-din-' + id, 1) }); break;
      case 'rac-': acao('recurso', { id, campo: 'racoes', delta: -1 }); break;
      case 'rac+': acao('recurso', { id, campo: 'racoes', delta: 1 }); break;
      case 'mover': acao('moverJogador', { id, dir: +b.dataset.dir }); break;
      case 'rmcond': acao('rmCondicao', { id, uid: b.dataset.uid }); break;
      case 'addcond': modalCondicao(id); break;
      case 'novo': modalPersonagem(); break;
      case 'editar': modalPersonagem(s.jogadores.find(j => j.id === id)); break;
      case 'descanso': modalDescanso(); break;
      case 'alimentar': {
        if (!s.jogadores.length) break;
        const sem = acao('alimentar', {}) || [];
        toast(sem.length ? 'Sem ração: ' + sem.join(', ') : 'Cada personagem comeu 1 ração.', true);
        break;
      }
      case 'limparcond': acao('limparCondicoesGrupo'); toast('Condições de cena removidas.', true); break;
      case 'iniciar':
        if (s.combate.ativo) acao('modo', { modo: 'combate' });
        else if (s.modo !== 'combate' && !s.combate.inimigos.length) acao('modo', { modo: 'combate' });
        else acao('iniciarCombate');
        break;
      case 'addini': modalInimigo(); break;
      case 'editarini': modalEditarInimigo(s.combate.inimigos.find(i => i.id === id)); break;
      case 'rmini': acao('removerInimigo', { id }); toast('Inimigo removido.', true); break;
      case 'visivel': acao('visibilidade', { id }); break;
      case 'proximo': proximo(); break;
      case 'anterior': acao('turnoAnterior'); break;
      case 'irpara': if (s.combate.ativo) acao('irPara', { id }); break;
      case 'novarodada': { const r = acao('novaRodada'); avisarExpiradas(r); break; }
      case 'rolar': acao('rolarIniciativa'); break;
      case 'encerrar': modalEncerrar(); break;
    }
  });
  app.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.ini) acao('setIniciativa', { id: t.dataset.ini, total: t.value });
    if (t.dataset.opc) acao('opcaoCombate', { chave: t.dataset.opc, valor: t.checked });
  });
  // Enter no campo de valor = dano/gasto (o mais comum em combate)
  app.addEventListener('keydown', ev => {
    const t = ev.target;
    if (ev.key !== 'Enter' || !t.id) return;
    const m = t.id.match(/^v-(pv|pm)-(.+)$/);
    if (m) { ev.preventDefault(); const n = Math.floor(valor(t.id, 0)); if (n) acao(m[1] === 'pv' ? 'vida' : 'mana', { id: m[2], n, tipo: m[1] === 'pv' ? 'dano' : 'gastar' }); }
  });
  document.addEventListener('keydown', ev => {
    if (tela !== 'mesa' || modalRaiz.firstChild) { if (ev.key === 'Escape') fecharModal(); return; }
    const digitando = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.shiftKey && !digitando) { ev.preventDefault(); store.desfazer(); }
    else if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z')) && !digitando) { ev.preventDefault(); store.refazer(); }
    else if (!digitando && store.estado.modo === 'combate' && store.estado.combate.ativo && ev.key === 'ArrowRight') { ev.preventDefault(); proximo(); }
  });
  function proximo() { const r = acao('proximoTurno'); if (r && r.novaRodada) avisarExpiradas(r); }
  function avisarExpiradas(r) {
    const s = store.estado;
    const ex = r && r.novaRodada ? r.novaRodada : [];
    toast('Rodada ' + s.combate.rodada + (s.combate.rerrolarCadaRodada ? ' · iniciativa rolada de novo' : '') + (ex.length ? ' · terminou: ' + ex.join(', ') : ''), false);
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(txt, desfazer) {
    clearTimeout(toastTimer);
    toastRaiz.innerHTML = `<div class="toast"><span>${esc(txt)}</span>${desfazer ? '<button class="btn peq" id="t-desf">Desfazer</button>' : ''}</div>`;
    const b = document.getElementById('t-desf'); if (b) b.onclick = () => { store.desfazer(); toastRaiz.innerHTML = ''; };
    toastTimer = setTimeout(() => { toastRaiz.innerHTML = ''; }, 6000);
  }

  // ---------- Modais ----------
  function abrirModal(html) {
    modalRaiz.innerHTML = `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const fundo = modalRaiz.firstChild;
    fundo.addEventListener('mousedown', ev => { if (ev.target === fundo) fecharModal(); });
    const primeiro = fundo.querySelector('input:not([type=checkbox]), select');
    if (primeiro) primeiro.focus();
    fundo.querySelectorAll('[data-fechar]').forEach(b => b.onclick = fecharModal);
    return fundo.firstChild;
  }
  function fecharModal() { modalRaiz.innerHTML = ''; }

  function modalRenomear() {
    const m = abrirModal(`<h2>Renomear mesa</h2><form id="f-ren" style="display:contents">
      <input type="text" name="nome" value="${esc(store.estado.nome)}" maxlength="60" required>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
    m.querySelector('form').onsubmit = ev => { ev.preventDefault(); acao('renomearMesa', { nome: ev.target.nome.value.trim() }); fecharModal(); };
  }

  function modalPersonagem(j) {
    const v = j ? { nome: j.nome, jogador: j.jogador, nivel: j.nivel, pvMax: j.pv.max, pvAtual: j.pv.atual, pmMax: j.pm.max, pmAtual: j.pm.atual, defesa: j.defesa, iniciativa: j.iniciativa, dinheiro: j.dinheiro, racoes: j.racoes, diasSemComer: j.diasSemComer } : { nivel: 1, defesa: 10, iniciativa: 0, dinheiro: 0, racoes: 0, diasSemComer: 0 };
    const f = (nome, rot, tipo, extra) => `<label class="campo ${extra || ''}">${rot}<input type="${tipo || 'number'}" name="${nome}" value="${esc(v[nome] == null ? '' : v[nome])}" ${tipo === 'text' ? 'maxlength="40"' : nome === 'dinheiro' ? 'step="0.01" inputmode="decimal"' : 'step="1" inputmode="numeric"'}></label>`;
    const m = abrirModal(`<h2>${j ? 'Editar personagem' : 'Novo personagem'}</h2>
      <form id="f-pj" style="display:contents"><div class="form-grade">
        ${f('nome', 'Personagem', 'text', 'largo')}${f('jogador', 'Jogador (opcional)', 'text', 'largo')}
        ${f('nivel', 'Nível')}${f('defesa', 'Defesa')}${f('iniciativa', 'Iniciativa (bônus)')}
        ${f('pvMax', 'PV máximo')}${f('pvAtual', 'PV atual')}${f('pmMax', 'PM máximo')}${f('pmAtual', 'PM atual')}
        ${f('dinheiro', 'Tibares (T$)')}${f('racoes', 'Rações')}${f('diasSemComer', 'Dias sem comer')}
      </div>
      <div class="nota">PV/PM atual vazio = cheio.</div>
      <div class="rodape">${j ? '<button type="button" class="btn perigo" id="b-rm" style="margin-right:auto">Remover</button>' : ''}
        <button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
    const form = m.querySelector('form');
    form.nome.required = true;
    form.onsubmit = ev => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      if (j) d.id = j.id;
      acao('salvarJogador', d); fecharModal();
    };
    const rm = m.querySelector('#b-rm');
    if (rm) rm.onclick = () => {
      if (rm.dataset.conf !== '1') { rm.dataset.conf = '1'; rm.textContent = 'Confirmar remoção'; return; }
      acao('removerJogador', { id: j.id }); fecharModal(); toast(j.nome + ' removido.', true);
    };
  }

  function modalCondicao(id) {
    const c = S.achar(store.estado, id); if (!c) return;
    const m = abrirModal(`<h2>Condição · ${esc(c.nome)}</h2>
      <div class="barra" style="margin:0">
        <label class="check"><input type="radio" name="dur" value="cena" checked> Até o fim da cena</label>
        <label class="check"><input type="radio" name="dur" value="rodadas"> Rodadas: <input type="number" id="c-rod" value="1" min="1" style="width:64px;min-height:32px"></label>
        <label class="check"><input type="radio" name="dur" value="indef"> Indefinida</label>
      </div>
      <div class="grade-cond">${R.CONDICOES.map(x => `<button data-c="${x.id}">${esc(x.nome)}<small>${esc(x.curto)}</small></button>`).join('')}</div>
      <form id="f-livre" class="barra" style="margin:0"><input type="text" name="livre" maxlength="40" placeholder="Outro efeito (ex.: Abençoado +1)" style="flex:1;width:auto"><button class="btn">Adicionar</button></form>
      <div class="nota">Repetir uma condição que agrava troca pela mais grave (abalado → apavorado, fatigado → exausto…). Condições terminam no fim da cena, salvo indicação (p. 394).</div>
      <div class="rodape"><button class="btn" data-fechar>Fechar</button></div>`);
    m.querySelector('#c-rod').addEventListener('focus', () => { m.querySelector('input[value=rodadas]').checked = true; });
    const dur = () => {
      const t = m.querySelector('input[name=dur]:checked').value;
      return t === 'rodadas' ? { tipo: 'rodadas', rest: Math.max(1, parseInt(m.querySelector('#c-rod').value, 10) || 1) } : { tipo: t };
    };
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      const nota = acao('addCondicao', { id, cond: b.dataset.c, dur: dur() });
      fecharModal(); if (nota) toast(c.nome + ': ' + nota, true);
    });
    m.querySelector('#f-livre').onsubmit = ev => {
      ev.preventDefault(); const t = ev.target.livre.value.trim(); if (!t) return;
      acao('addCondicao', { id, cond: t, dur: dur() }); fecharModal();
    };
  }

  function modalDescanso() {
    const s = store.estado;
    if (!s.jogadores.length) return;
    const op = { tipo: 'normal', cuidados: {}, sopa: false, tormenta: false, comer: true };
    const m = abrirModal('<div id="desc"></div>');
    const corpo = m.querySelector('#desc');
    function desenhar() {
      const linhas = s.jogadores.map(j => {
        const r = R.aplicarDescanso(j, op.tipo, { cuidados: op.cuidados[j.id], sopa: op.sopa, tormenta: op.tormenta });
        const comida = op.comer ? (j.racoes > 0 ? '🍞 ' + (j.racoes - 1) : '<span class="aviso">sem ração</span>') : '';
        return `<tr><td>${esc(j.nome)} <span class="nota">Nv ${j.nivel}</span></td>
          <td><span class="ganho">+${r.ganhoPV}</span> → ${r.jogador.pv.atual}/${j.pv.max}</td>
          <td><span class="ganho">+${r.ganhoPM}</span> → ${r.jogador.pm.atual}/${j.pm.max}</td>
          <td><label class="check" title="Cura CD 15, só treinado: +1 PV por nível (p. 117)"><input type="checkbox" data-cuid="${j.id}" ${op.cuidados[j.id] ? 'checked' : ''} ${op.tipo === 'sem_sono' ? 'disabled' : ''}> Cuidados</label></td>
          <td>${comida}</td></tr>`;
      }).join('');
      corpo.innerHTML = `<h2>Descanso do grupo · fim do dia ${s.dia || 1}</h2>
        <div class="opcoes-descanso">${R.DESCANSOS.map(d => `<button class="opcao ${op.tipo === d.id ? 'ativa' : ''}" data-tipo="${d.id}"><b>${d.nome}</b><small>${d.id === 'sem_sono' ? 'recupera 0' : d.mult === 0.5 ? 'metade do nível' : d.mult === 1 ? '1 × nível' : d.mult + ' × nível'}</small></button>`).join('')}</div>
        <div class="nota">${esc(R.DESCANSO[op.tipo].desc)}. PV e PM nunca passam do máximo (p. 106).</div>
        <table class="previa"><thead><tr><th>Personagem</th><th>PV</th><th>PM</th><th>Cura</th><th>${op.comer ? 'Rações' : ''}</th></tr></thead><tbody>${linhas}</tbody></table>
        <div class="barra" style="margin:0">
          <label class="check"><input type="checkbox" data-op="comer" ${op.comer ? 'checked' : ''}> Consumir 1 ração de cada</label>
          <label class="check" title="+1 PM por nível na próxima noite (p. 162)"><input type="checkbox" data-op="sopa" ${op.sopa ? 'checked' : ''}> Sopa de peixe</label>
          <label class="check" title="Recuperação pela metade (p. 319)"><input type="checkbox" data-op="tormenta" ${op.tormenta ? 'checked' : ''}> Área de Tormenta</label>
        </div>
        <div class="nota">O descanso não remove condições pelo livro; use "Limpar condições de cena" se fizer sentido. Quem volta a 1 PV ou mais recobra a consciência (p. 237).</div>
        <div class="rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="b-desc">Descansar</button></div>`;
      corpo.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { op.tipo = b.dataset.tipo; desenhar(); });
      corpo.querySelectorAll('[data-cuid]').forEach(b => b.onchange = () => { op.cuidados[b.dataset.cuid] = b.checked; desenhar(); });
      corpo.querySelectorAll('[data-op]').forEach(b => b.onchange = () => { op[b.dataset.op] = b.checked; desenhar(); });
      corpo.querySelector('[data-fechar]').onclick = fecharModal;
      corpo.querySelector('#b-desc').onclick = () => {
        const sem = op.comer ? s.jogadores.filter(j => j.racoes <= 0).map(j => j.nome) : [];
        acao('descanso', op); fecharModal();
        toast('Descanso ' + R.DESCANSO[op.tipo].nome.toLowerCase() + ' aplicado.' + (sem.length ? ' Sem ração: ' + sem.join(', ') : ''), true);
      };
    }
    desenhar();
  }

  function modalInimigo() {
    const rec = store.estado.recentes || [];
    const m = abrirModal(`<h2>Adicionar inimigo</h2>
      ${rec.length ? `<div><div class="nota" style="margin-bottom:6px">Recentes</div><div class="recentes">${rec.map((r, i) => `<button class="btn peq" data-rec="${i}">${esc(r.nome)} <span class="nota">PV ${r.pv}</span></button>`).join('')}</div></div>` : ''}
      <form id="f-ini" style="display:contents"><div class="form-grade">
        <label class="campo largo">Nome<input type="text" name="nome" required maxlength="36" placeholder="Goblin"></label>
        <label class="campo">PV<input type="number" name="pv" value="10" min="1" required></label>
        <label class="campo">PM<input type="number" name="pm" value="0" min="0"></label>
        <label class="campo">Defesa<input type="number" name="defesa" value="12"></label>
        <label class="campo">Iniciativa (bônus)<input type="number" name="iniciativa" value="0"></label>
        <label class="campo">Quantidade<input type="number" name="qtd" value="1" min="1" max="20"></label>
      </div>
      <label class="check"><input type="checkbox" name="visivel" checked> Aparece na tela dos jogadores</label>
      <div class="nota">${store.estado.combate.ativo ? 'O combate já começou: a iniciativa dos novos inimigos é rolada agora.' : 'Com quantidade maior que 1, os nomes ficam numerados (Goblin 1, Goblin 2…).'}</div>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Adicionar</button></div></form>`);
    const form = m.querySelector('form');
    m.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => {
      const r = rec[+b.dataset.rec];
      ['nome', 'pv', 'pm', 'defesa', 'iniciativa'].forEach(k => { form[k].value = r[k]; });
      form.qtd.focus(); form.qtd.select();
    });
    form.onsubmit = ev => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      d.visivel = form.visivel.checked;
      acao('addInimigo', d); fecharModal();
    };
  }

  function modalEditarInimigo(c) {
    if (!c) return;
    const m = abrirModal(`<h2>Editar inimigo</h2><form style="display:contents"><div class="form-grade">
      <label class="campo largo">Nome<input type="text" name="nome" value="${esc(c.nome)}" maxlength="40" required></label>
      <label class="campo">PV atual<input type="number" name="pvAtual" value="${c.pv.atual}"></label>
      <label class="campo">PV máximo<input type="number" name="pvMax" value="${c.pv.max}"></label>
      <label class="campo">PM atual<input type="number" name="pmAtual" value="${c.pm.atual}"></label>
      <label class="campo">PM máximo<input type="number" name="pmMax" value="${c.pm.max}"></label>
      <label class="campo">Defesa<input type="number" name="defesa" value="${c.defesa}"></label>
      <label class="campo">Iniciativa (bônus)<input type="number" name="iniciativa" value="${c.iniciativa}"></label>
      </div><div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
    const form = m.querySelector('form');
    form.onsubmit = ev => { ev.preventDefault(); const d = Object.fromEntries(new FormData(form).entries()); d.id = c.id; acao('salvarInimigo', d); fecharModal(); };
  }

  function modalEncerrar() {
    const s = store.estado;
    const vivos = s.combate.inimigos.filter(i => i.pv.atual > 0).length;
    const m = abrirModal(`<h2>Encerrar combate</h2>
      <p style="margin:0">O fim do combate encerra a cena: as condições de cena e de rodadas saem dos personagens (p. 394). Ficam só as indefinidas.</p>
      <label class="check"><input type="checkbox" id="e-rm" checked> Remover os inimigos${vivos ? ` (${vivos} ainda de pé)` : ''}</label>
      <div class="rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="b-enc">Encerrar</button></div>`);
    m.querySelector('#b-enc').onclick = () => { acao('encerrarCombate', { manterInimigos: !m.querySelector('#e-rm').checked }); fecharModal(); toast('Combate encerrado.', true); };
  }

  // reconecta se a sessão expirar / outra aba sair
  window.addEventListener('storage', ev => { if (ev.key === 't20s.auth' && S.Sync.online() && !ev.newValue) location.reload(); });

  boot().catch(e => { app.innerHTML = `<div class="centro"><div class="caixa"><h1>T20Session</h1><div class="erro">${esc(e.message || e)}</div></div></div>`; });
})();
