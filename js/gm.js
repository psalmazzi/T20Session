/* T20Session — tela do mestre */
(function () {
  'use strict';
  const R = window.T20R, S = window.T20S, CFG = window.T20_CONFIG || {};
  const store = S.criarStore();
  const app = document.getElementById('app');
  const modalRaiz = document.getElementById('modal');
  const folhaRaiz = document.getElementById('folha');
  const avisoRaiz = document.getElementById('aviso');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sinal = n => (n >= 0 ? '+' : '') + n;
  const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString('pt-BR');
  const celular = () => window.matchMedia('(max-width: 720px)').matches;

  // Glifos monocromáticos (U+FE0E força a forma de texto onde existe variante emoji).
  const G = {
    espadas: '\u2694\uFE0E', lua: '\u263E\uFE0E', lapis: '\u270E\uFE0E', x: '\u00D7',
    ant: '‹', prox: '›', desf: '↶', ref: '↷', hist: '≡', mais: '⋯', apagar: '←'
  };
  // Ícones SVG 20×20, traço 1.75, currentColor.
  const svg = d => `<svg viewBox="0 0 20 20" aria-hidden="true">${d}</svg>`;
  const IC = {
    dado: svg('<rect x="3.25" y="3.25" width="13.5" height="13.5" rx="3"/><circle cx="7.6" cy="7.6" r="1" class="cheio"/><circle cx="12.4" cy="12.4" r="1" class="cheio"/>'),
    monitor: svg('<rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 17h6M10 13.5V17"/>'),
    olho: svg('<path d="M1.9 10S4.9 4.6 10 4.6 18.1 10 18.1 10 15.1 15.4 10 15.4 1.9 10 1.9 10Z"/><circle cx="10" cy="10" r="2.4"/>'),
    // ◔ (U+25D4) desenhado em SVG: o glifo falta em várias fontes do sistema.
    racao: '<svg class="ic-racao" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 10V3.5A6.5 6.5 0 0 1 16.5 10Z" class="cheio"/></svg>',
    olhoFechado: svg('<path d="M1.9 10S4.9 4.6 10 4.6 18.1 10 18.1 10 15.1 15.4 10 15.4 1.9 10 1.9 10Z"/><circle cx="10" cy="10" r="2.4"/><path d="M3.5 3.5l13 13"/>')
  };

  let tela = 'carregando';
  // Estado só da interface (não vai para o banco).
  const ui = { vistoAte: 0, flashAte: 0, folha: null, folhaId: null, alvo: 'pv', visor: '' };
  const FLASH_MS = 1100;

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
    const l = store.estado.log || [];
    ui.vistoAte = l[0] ? l[0].t : 0;
    render();
  }

  // ---------- Login ----------
  function telaLogin(msg) {
    tela = 'login';
    fecharFolha(); fecharModal();
    app.innerHTML = `<div class="centro"><form class="caixa" id="f-login">
      <h1>T20Session</h1><div class="sub">Gestão de sessão · Tormenta20</div>
      <label class="campo">E-mail<input type="email" name="email" required autocomplete="email"></label>
      <label class="campo">Senha<input type="password" name="senha" required minlength="6" autocomplete="current-password"></label>
      <div class="erro" id="login-erro">${esc(msg || '')}</div>
      <button class="btn pri" type="submit">Entrar</button>
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
    fecharFolha(); fecharModal();
    if (store.estado) store.fechar();
    let mesas = [];
    try { mesas = await S.Sync.listarMesas(); } catch (e) { erroMsg = traduzErro(e); }
    app.innerHTML = `<div class="centro"><div class="caixa">
      <h1>T20Session</h1>
      <div class="sub">${S.Sync.online() ? esc(S.Sync.usuario.email) : 'Modo local · dados só neste navegador'}</div>
      <div class="lista-mesas">${mesas.length ? mesas.map(m => `
        <div class="mesa"><button class="abrir" data-abrir="${esc(m.id)}">${esc(m.nome)}<small>${m.atualizado ? new Date(m.atualizado).toLocaleString('pt-BR') : ''}</small></button>
        <button class="btn perigo" data-excluir="${esc(m.id)}">Excluir</button></div>`).join('') : '<div class="nota">Nenhuma mesa ainda.</div>'}
      </div>
      <form id="f-mesa" class="linha-form"><input type="text" name="nome" placeholder="Nome da nova mesa" required maxlength="60">
      <button class="btn pri">Criar</button></form>
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
  store.sub(() => { if (tela === 'mesa' && store.estado) { render(); renderFolha(); } });

  function flashAttr() {
    const resta = ui.flashAte - Date.now();
    return resta > 0 ? ` style="animation-delay:-${FLASH_MS - resta}ms"` : '';
  }
  function render() {
    const s = store.estado;
    const foco = document.activeElement && document.activeElement.id;
    const syncCls = !S.Sync.online() ? 'local' : store.erroSalvar ? 'erro' : '';
    const syncTit = !S.Sync.online() ? 'Modo local (sem login)' : store.erroSalvar ? 'Erro ao salvar: ' + store.erroSalvar : 'Sincronizado';
    const cb = s.combate;
    const novo = s.log && s.log[0] && s.log[0].t > ui.vistoAte;
    const fl = ui.flashAte > Date.now() ? ' flash' : '';
    app.innerHTML = `
      <header class="topo">
        <button class="mesa-nome" data-a="renomear" title="Renomear mesa">${esc(s.nome)}</button>
        <span class="dia"><span class="so-desk">Dia ${s.dia || 1}${cb.ativo ? ' · R' + cb.rodada : ''}</span></span>
        <div class="seg" role="tablist">
          <button role="tab" data-a="modo" data-v="grupo" class="${s.modo === 'grupo' ? 'ativa' : ''}"><span class="so-desk">Grupo</span><span class="so-cel">Grupo</span></button>
          <button role="tab" data-a="modo" data-v="combate" class="${s.modo === 'combate' ? 'ativa' : ''}">${cb.ativo ? `<span class="gl-esp">${G.espadas}</span> ` : ''}<span class="so-desk">Combate</span><span class="so-cel">Combate</span></button>
        </div>
        <span class="espaco"></span>
        <button class="ic${fl}" data-a="desfazer" ${store.podeDesfazer() ? '' : 'disabled'} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"${flashAttr()}>${G.desf}</button>
        <button class="ic so-desk" data-a="refazer" ${store.podeRefazer() ? '' : 'disabled'} title="Refazer (Ctrl+Y)" aria-label="Refazer">${G.ref}</button>
        <button class="ic hist${novo ? ' novo' : ''}${fl}" data-a="historico" title="Histórico" aria-label="Histórico"${flashAttr()}><span class="gl">${G.hist}</span><span class="so-desk">Histórico</span><i class="ponto"></i></button>
        <button class="ic so-desk" data-a="display" title="Abrir a tela dos jogadores em outra janela" aria-label="Tela dos jogadores">${IC.monitor}</button>
        <span class="sync so-desk ${syncCls}" title="${esc(syncTit)}"></span>
        <button class="ic" data-a="menu" title="Mais opções" aria-label="Mais opções">${G.mais}</button>
      </header>
      <main class="${s.modo}">${s.modo === 'combate' ? htmlCombate(s) : htmlGrupo(s)}</main>
      ${htmlBarraCel(s)}`;
    if (foco) { const el = document.getElementById(foco); if (el) el.focus(); }
  }

  /** Barra de recurso: rótulo · trilho 6 px · número fora da barra. */
  function barraRec(c, tipo) {
    const r = c[tipo];
    const pct = r.max > 0 ? Math.max(0, Math.min(100, r.atual / r.max * 100)) : 0;
    const est = tipo === 'pv' ? R.estadoPV(r.atual, r.max) : '';
    return `<div class="rec ${tipo} ${est}"><span class="rot">${tipo.toUpperCase()}</span>
      <div class="trilho"><i style="width:${pct}%"></i></div><span class="num">${r.atual} / ${r.max}</span></div>`;
  }
  function ajuste(c, tipo) {
    const pv = tipo === 'pv';
    return `<div class="ajuste">
        <button class="acao-mini ${pv ? 'dano' : 'gasto'}" data-a="${tipo}-" data-id="${c.id}" title="${pv ? 'Dano' : 'Gastar PM'} (valor ao lado; vazio = 1)" aria-label="${pv ? 'Dano' : 'Gastar PM'}">−</button>
        <input type="number" inputmode="numeric" min="0" id="v-${tipo}-${c.id}" placeholder="1" aria-label="valor de ${pv ? 'PV' : 'PM'}">
        <button class="acao-mini cura" data-a="${tipo}+" data-id="${c.id}" title="${pv ? 'Cura' : 'Recuperar PM'}" aria-label="${pv ? 'Cura' : 'Recuperar PM'}">+</button>
      </div>`;
  }

  function durTxt(x) { const d = x.dur || {}; return d.tipo === 'rodadas' ? d.rest + 'r' : d.tipo === 'indef' ? '∞' : 'cena'; }
  function chipsCond(c, semAdd) {
    const lista = (c.condicoes || []).slice().sort((a, b) => R.perigoCondicao(b) - R.perigoCondicao(a)); // graves primeiro
    return `<div class="chips">${lista.map(x => `<span class="chip ${R.perigoCondicao(x) ? 'perigo' : ''}" title="${esc(R.curtoCondicao(x) + (x.origem === 'fome' ? ' · fome (comer remove)' : ''))}">${esc(R.nomeCondicao(x))}${x.origem === 'fome' ? ' <small>fome</small>' : ''} <small>${durTxt(x)}</small><button data-a="rmcond" data-id="${c.id}" data-uid="${x.id}" aria-label="remover ${esc(R.nomeCondicao(x))}">${G.x}</button></span>`).join('')}${semAdd ? '' : `<button class="chip add" data-a="addcond" data-id="${c.id}">+ condição</button>`}</div>`;
  }

  /** Faixa de estado grave (jogador). */
  function faixa(c) {
    if (c.tipo !== 'jogador') return '';
    if (c.morto) return `<span class="faixa">Morto${c.morto === 'fome' ? ' (fome)' : ''}</span>`;
    const e = R.estadoPV(c.pv.atual, c.pv.max);
    if (e === 'morto') return `<span class="faixa">Morto · PV no limiar (${R.limiarMorte(c.pv.max)})</span>`;
    if (e === 'caido') return `<span class="faixa">Caído · faltam ${c.pv.atual - R.limiarMorte(c.pv.max)}</span>`;
    return '';
  }

  function avisoFome(j) {
    if (!j.diasSemComer && !j.falhasFome) return '';
    const cd = R.cdFome(j.diasSemComer);
    const prox = R.EFEITOS_FOME[Math.min(3, j.falhasFome || 0)];
    const proxTxt = prox === 'morto' ? 'morte' : R.COND[prox].nome.toLowerCase();
    return `<div class="aviso-fome"><span>${j.diasSemComer} dia(s) sem comer${cd ? ` · <b>Fortitude CD ${cd}</b>` : ' · sem efeito no 1º dia'}${j.falhasFome ? ` · ${j.falhasFome} falha(s)` : ''}</span>
      ${cd && !j.morto ? `<button class="btn ghost peq" data-a="falhafome" data-id="${j.id}" title="Próxima falha: ${proxTxt} (p. 319)">Falhou na Fortitude</button>` : ''}</div>`;
  }

  // ---------- Grupo ----------
  function htmlGrupo(s) {
    const cards = s.jogadores.map(j => {
      const e = R.estadoPV(j.pv.atual, j.pv.max);
      const morto = R.estaMorto(j);
      return `<article class="card ${morto ? 'morto' : e === 'caido' ? 'caido' : ''}" data-a="folha" data-id="${j.id}">
        <div class="card-topo"><span class="nome">${esc(j.nome)}</span><span class="sub">Nv ${j.nivel}${j.jogador ? ' · ' + esc(j.jogador) : ''}</span>${faixa(j)}
          <span class="stats-cel so-cel">DEF <b>${j.defesa}</b> INI <b>${sinal(j.iniciativa)}</b></span>
          <button class="ic-mini" data-a="editar" data-id="${j.id}" title="Editar" aria-label="Editar ${esc(j.nome)}">${G.lapis}</button></div>
        <div class="bloco-rec">${barraRec(j, 'pv')}<div class="so-desk">${ajuste(j, 'pv')}</div></div>
        <div class="bloco-rec">${barraRec(j, 'pm')}<div class="so-desk">${ajuste(j, 'pm')}</div></div>
        <div class="stats so-desk"><span>DEF <b>${j.defesa}</b></span><span>INI <b>${sinal(j.iniciativa)}</b></span></div>
        ${avisoFome(j)}
        <div class="card-rodape"><div class="linha-recursos">
          <span class="contador"><span class="rot-t">T$</span> <b>${fmtNum(j.dinheiro)}</b>
            <span class="so-desk ctl"><input type="number" step="0.01" min="0" id="v-din-${j.id}" placeholder="T$" aria-label="valor em tibares">
            <button class="mini" data-a="din-" data-id="${j.id}" title="Gastar" aria-label="Gastar tibares">−</button><button class="mini" data-a="din+" data-id="${j.id}" title="Receber" aria-label="Receber tibares">+</button></span></span>
          <span class="contador"><span class="gl-racao" title="Rações">${IC.racao}</span> <b>${j.racoes}</b>
            <span class="so-desk ctl"><button class="mini" data-a="rac-" data-id="${j.id}" title="Tirar 1 ração" aria-label="Tirar 1 ração">−</button><button class="mini" data-a="rac+" data-id="${j.id}" title="Somar 1 ração" aria-label="Somar 1 ração">+</button></span></span>
        </div>
        ${chipsCond(j)}</div>
      </article>`;
    }).join('');
    return `<div class="barra-acoes so-desk">
        <button class="btn" data-a="descanso"><span class="gl">${G.lua}</span> Descanso</button>
        <button class="btn" data-a="alimentar"><span class="gl-racao" title="Rações">${IC.racao}</span> Alimentar</button>
        <button class="btn" data-a="limparcond" title="Condições terminam no fim da cena, salvo indicação (p. 394)">Limpar condições</button>
        <span class="espaco"></span>
        <button class="btn" data-a="novo">+ Personagem</button>
        <button class="btn" data-a="modo" data-v="combate"><span class="gl">${G.espadas}</span> Combate</button>
      </div>
      ${s.jogadores.length ? `<div class="grade">${cards}</div>` : `<div class="vazio">Adicione os personagens do grupo para começar.<br><br><button class="btn pri" data-a="novo">+ Personagem</button></div>`}`;
  }

  // ---------- Combate ----------
  function htmlCombate(s) {
    const cb = s.combate;
    const todos = S.combatentes(s);
    const ordem = cb.ativo ? S.ordemValida(s).map(id => S.achar(s, id)) : todos;
    const vez = S.daVez(s);
    const vezC = vez && S.achar(s, vez);
    const linhas = ordem.map(c => {
      const ini = cb.inis[c.id];
      const est = R.estadoPV(c.pv.atual, c.pv.max);
      const espera = cb.ativo && S.pulaVez(s, c) && !S.foraDeCombate(c);
      const cls = [c.tipo, c.id === vez ? 'vez' : '', S.foraDeCombate(c) ? 'derrotado' : '', c.tipo === 'jogador' && (est === 'caido' || R.estaMorto(c)) ? 'caido' : '', c.tipo === 'inimigo' && !c.visivel ? 'oculto' : '', c.pm.max > 0 ? '' : 'sem-pm'].join(' ');
      const sub = [`DEF ${c.defesa}`, `INI ${sinal(c.iniciativa)}`];
      if (c.tipo === 'inimigo' && !c.visivel) sub.push('oculto');
      if (espera) sub.push(c.entrouNaRodada === cb.rodada ? 'age na próxima rodada' : 'surpreendido: não age');
      return `<div class="linha-ini ${cls}" data-a="folha" data-id="${c.id}">
        <div class="ini-num">${cb.ativo ? `<input type="number" id="ini-${c.id}" data-ini="${c.id}" value="${ini ? ini.total : ''}" aria-label="Iniciativa de ${esc(c.nome)}" title="Total de iniciativa (pode digitar o que o jogador rolou)"><small>${ini ? (ini.manual ? 'digitado' : 'd20 ' + ini.d20) : ''}</small>` : '<small>—</small>'}</div>
        <div class="ini-nome"><div class="nome-linha"><button class="nome" data-a="irpara" data-id="${c.id}" title="Passar a vez para este">${esc(c.nome)}</button>${faixa(c)}</div>
          <div class="sub">${sub.join(' · ')}</div></div>
        <div class="ini-pv">${barraRec(c, 'pv')}<div class="so-desk">${ajuste(c, 'pv')}</div></div>
        <div class="ini-pm so-desk">${c.pm.max > 0 ? barraRec(c, 'pm') + ajuste(c, 'pm') : ''}</div>
        <div class="ini-cond">${chipsCond(c)}</div>
        <div class="ini-acoes so-desk">${c.tipo === 'inimigo' ? `
          <button class="ic-mini olho ${c.visivel ? '' : 'off'}" data-a="visivel" data-id="${c.id}" title="${c.visivel ? 'Esconder da tela dos jogadores' : 'Mostrar na tela dos jogadores'}" aria-label="${c.visivel ? 'Esconder' : 'Mostrar'} ${esc(c.nome)}">${c.visivel ? IC.olho : IC.olhoFechado}</button>
          <button class="ic-mini" data-a="editarini" data-id="${c.id}" title="Editar" aria-label="Editar ${esc(c.nome)}">${G.lapis}</button>
          <button class="ic-mini rm" data-a="rmini" data-id="${c.id}" title="Remover" aria-label="Remover ${esc(c.nome)}">${G.x}</button>` : `<button class="ic-mini" data-a="editar" data-id="${c.id}" title="Editar" aria-label="Editar ${esc(c.nome)}">${G.lapis}</button>`}
        </div></div>`;
    }).join('');
    const sangra = cb.ativo && vezC && (vezC.condicoes || []).some(x => x.cond === 'sangrando');
    return `
      <div class="painel-turno">
        ${cb.ativo ? `<span class="rodada">Rodada ${cb.rodada}</span><span class="vez">Vez de <b>${vezC ? esc(vezC.nome) : '—'}</b></span>
          <span class="espaco"></span>
          <span class="so-desk grupo-btn">
          <button class="btn" data-a="anterior" title="Turno anterior" aria-label="Turno anterior"><span class="seta">${G.ant}</span></button>
          <button class="btn pri" data-a="proximo" title="Próximo turno (seta para a direita)">Próximo turno <span class="seta">${G.prox}</span></button>
          <button class="btn" data-a="novarodada" title="Encerra a rodada agora">Nova rodada</button>
          <button class="btn" data-a="rolar" title="Rola de novo para todos">${IC.dado} Rolar ini</button>
          <button class="btn" data-a="addini">+ Inimigo</button></span>`
        : `<span class="vez">Prepare os inimigos e comece. A iniciativa é rolada para todos ao iniciar.</span>
          <span class="espaco"></span>
          <span class="grupo-btn"><button class="btn pri" data-a="iniciar" ${todos.length ? '' : 'disabled'}><span class="gl">${G.espadas}</span> Iniciar combate</button>
          <button class="btn so-desk" data-a="addini">+ Inimigo</button></span>`}
        <button class="ic so-desk" data-a="menu" title="Opções do combate" aria-label="Opções do combate">${G.mais}</button>
      </div>
      ${sangra ? `<div class="lembrete"><span><b>${esc(vezC.nome)}</b> está sangrando · início do turno: <b>Con CD 15</b></span>
        <span class="grupo-btn"><button class="btn" data-a="sangra-ok" data-id="${vezC.id}">Passou</button><button class="btn perigo" data-a="sangra-falha" data-id="${vezC.id}">Falhou · −1d6 PV</button></span></div>` : ''}
      ${ordem.length ? `<div class="lista-ini">${linhas}</div>` : '<div class="vazio">Sem combatentes. Adicione personagens na aba Grupo e inimigos aqui.</div>'}`;
  }

  /** Barra de ação fixa do celular. */
  function htmlBarraCel(s) {
    if (s.modo === 'combate') {
      if (!s.combate.ativo) return `<nav class="barra-cel so-cel"><button class="btn pri" data-a="iniciar"><span class="gl">${G.espadas}</span> Iniciar combate</button><button class="btn" data-a="addini" aria-label="Adicionar inimigo">+ Inimigo</button></nav>`;
      return `<nav class="barra-cel so-cel"><button class="btn quad" data-a="anterior" aria-label="Turno anterior"><span class="seta">${G.ant}</span></button>
        <button class="btn pri" data-a="proximo">Próximo turno <span class="seta">${G.prox}</span></button>
        <button class="btn quad" data-a="addini" aria-label="Adicionar inimigo">+</button></nav>`;
    }
    return `<nav class="barra-cel so-cel"><button class="btn" data-a="descanso"><span class="gl">${G.lua}</span> Descanso</button>
      <button class="btn" data-a="alimentar"><span class="gl-racao" title="Rações">${IC.racao}</span> Alimentar</button>
      <button class="btn" data-a="modo" data-v="combate"><span class="gl">${G.espadas}</span> Combate</button></nav>`;
  }

  // ---------- Eventos ----------
  function valor(id, padrao) { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) || v <= 0 ? padrao : v; }
  // Ações rotineiras: registram no Histórico e piscam ≡ e ↶ (substitui o toast).
  const ROTINA = new Set(['alimentar', 'descanso', 'limparCondicoesGrupo', 'removerInimigo', 'removerJogador', 'novaRodada', 'encerrarCombate', 'iniciarCombate', 'falhaFome', 'sangramento', 'rolarIniciativa']);
  function acao(nome, p) {
    const antes = store.estado && store.estado.log && store.estado.log[0];
    const ret = store.acao(nome, p);
    if (ret && ret.aviso) aviso(ret.aviso);
    const depois = store.estado.log && store.estado.log[0];
    if (depois !== antes && (ROTINA.has(nome) || (ret && ret.novaRodada))) { ui.flashAte = Date.now() + FLASH_MS; render(); }
    return ret;
  }

  app.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b || tela !== 'mesa') return;
    const id = b.dataset.id, s = store.estado;
    switch (b.dataset.a) {
      case 'modo': acao('modo', { modo: b.dataset.v }); break;
      case 'desfazer': store.desfazer(); break;
      case 'refazer': store.refazer(); break;
      case 'historico': abrirFolha('historico'); break;
      case 'menu': abrirFolha('menu'); break;
      case 'display': abrirDisplay(); break;
      case 'renomear': modalRenomear(); break;
      case 'folha': if (celular()) abrirFolha('teclado', id); break;
      case 'pv-': acao('vida', { id, n: Math.floor(valor('v-pv-' + id, 1)), tipo: 'dano' }); break;
      case 'pv+': acao('vida', { id, n: Math.floor(valor('v-pv-' + id, 1)), tipo: 'cura' }); break;
      case 'pm-': acao('mana', { id, n: Math.floor(valor('v-pm-' + id, 1)), tipo: 'gastar' }); break;
      case 'pm+': acao('mana', { id, n: Math.floor(valor('v-pm-' + id, 1)), tipo: 'recuperar' }); break;
      case 'din-': acao('recurso', { id, campo: 'dinheiro', delta: -valor('v-din-' + id, 1) }); break;
      case 'din+': acao('recurso', { id, campo: 'dinheiro', delta: valor('v-din-' + id, 1) }); break;
      case 'rac-': acao('recurso', { id, campo: 'racoes', delta: -1 }); break;
      case 'rac+': acao('recurso', { id, campo: 'racoes', delta: 1 }); break;
      case 'rmcond': acao('rmCondicao', { id, uid: b.dataset.uid }); break;
      case 'addcond': modalCondicao(id); break;
      case 'novo': modalPersonagem(); break;
      case 'editar': modalPersonagem(s.jogadores.find(j => j.id === id)); break;
      case 'descanso': modalDescanso(); break;
      case 'alimentar': if (s.jogadores.length) acao('alimentar', {}); break;
      case 'falhafome': acao('falhaFome', { id }); break;
      case 'limparcond': acao('limparCondicoesGrupo'); break;
      case 'iniciar': if (s.combate.ativo) acao('modo', { modo: 'combate' }); else modalIniciar(); break;
      case 'addini': modalInimigo(); break;
      case 'editarini': modalEditarInimigo(s.combate.inimigos.find(i => i.id === id)); break;
      case 'rmini': acao('removerInimigo', { id }); break;
      case 'visivel': acao('visibilidade', { id }); break;
      case 'proximo': acao('proximoTurno'); break;
      case 'anterior': acao('turnoAnterior'); break;
      case 'irpara': if (celular()) abrirFolha('teclado', id); else if (s.combate.ativo) acao('irPara', { id }); break;
      case 'novarodada': acao('novaRodada'); break;
      case 'rolar': acao('rolarIniciativa'); break;
      case 'sangra-ok': acao('sangramento', { id, passou: true }); break;
      case 'sangra-falha': acao('sangramento', { id, passou: false }); break;
    }
  });
  app.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.ini) acao('setIniciativa', { id: t.dataset.ini, total: t.value });
  });
  // Enter no campo de valor = dano/gasto (o mais comum em combate)
  app.addEventListener('keydown', ev => {
    const t = ev.target;
    if (ev.key !== 'Enter' || !t.id) return;
    const m = t.id.match(/^v-(pv|pm)-(.+)$/);
    if (m) { ev.preventDefault(); const n = Math.floor(valor(t.id, 0)); if (n) acao(m[1] === 'pv' ? 'vida' : 'mana', { id: m[2], n, tipo: m[1] === 'pv' ? 'dano' : 'gastar' }); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { if (modalRaiz.firstChild) fecharModal(); else fecharFolha(); return; }
    if (tela !== 'mesa' || modalRaiz.firstChild) return;
    const digitando = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.shiftKey && !digitando) { ev.preventDefault(); store.desfazer(); }
    else if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z')) && !digitando) { ev.preventDefault(); store.refazer(); }
    else if (!digitando && !ui.folha && store.estado.modo === 'combate' && store.estado.combate.ativo && ev.key === 'ArrowRight') { ev.preventDefault(); acao('proximoTurno'); }
  });
  function abrirDisplay() { window.open('display.html?mesa=' + encodeURIComponent(store.mesaId), 't20display', 'popup,width=1280,height=800'); }

  // ---------- Aviso (só erros/avisos; o resto vai para o Histórico) ----------
  let avisoTimer;
  function aviso(txt) {
    clearTimeout(avisoTimer);
    avisoRaiz.innerHTML = `<div class="aviso-caixa"><span>${esc(txt)}</span><button class="ic-mini" aria-label="Fechar aviso">${G.x}</button></div>`;
    avisoRaiz.querySelector('button').onclick = () => { avisoRaiz.innerHTML = ''; };
    avisoTimer = setTimeout(() => { avisoRaiz.innerHTML = ''; }, 4500);
  }

  // ---------- Folhas (Histórico, menu ⋯, teclado do celular) ----------
  function abrirFolha(tipo, id) {
    ui.folha = tipo; ui.folhaId = id || null;
    if (tipo === 'teclado') { ui.alvo = 'pv'; ui.visor = ''; }
    if (tipo === 'historico') { const l = store.estado.log || []; ui.vistoAte = l[0] ? l[0].t : 0; render(); }
    renderFolha();
  }
  function fecharFolha() { ui.folha = null; ui.folhaId = null; folhaRaiz.innerHTML = ''; }

  function renderFolha() {
    if (!ui.folha || tela !== 'mesa' || !store.estado) { folhaRaiz.innerHTML = ''; return; }
    let html = '', cls = '';
    if (ui.folha === 'historico') {
      const l = store.estado.log || [];
      ui.vistoAte = l[0] ? l[0].t : ui.vistoAte;
      cls = 'lateral';
      html = `<div class="folha-topo"><h2>Histórico</h2><span class="nota">${G.desf} no topo desfaz</span><button class="ic-mini" data-f="fechar" aria-label="Fechar">${G.x}</button></div>
        <ol class="historico">${l.length ? l.map(e => `<li class="${e.tipo === 'aviso' ? 'aviso' : ''}"><time>${new Date(e.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><span>${esc(e.txt)}</span></li>`).join('') : '<li class="nota">Nada ainda.</li>'}</ol>`;
    } else if (ui.folha === 'menu') {
      cls = 'lateral';
      html = htmlMenu(store.estado);
    } else if (ui.folha === 'teclado') {
      const c = S.achar(store.estado, ui.folhaId);
      if (!c) { fecharFolha(); return; }
      cls = 'teclado-folha';
      html = htmlTeclado(c);
    }
    const ja = folhaRaiz.querySelector('.folha');
    if (ja && ja.dataset.tipo === ui.folha) { ja.innerHTML = html; return; } // atualiza sem refazer a animação
    folhaRaiz.innerHTML = `<div class="folha-fundo" data-f="fechar"></div><section class="folha ${cls}" data-tipo="${ui.folha}" role="dialog" aria-modal="true">${html}</section>`;
  }

  function htmlMenu(s) {
    const cb = s.combate;
    const opc = (chave, rot, ajuda) => `<label class="opcao-linha"><input type="checkbox" data-opc="${chave}" ${cb[chave] ? 'checked' : ''}><span><b>${rot}</b><small>${ajuda}</small></span></label>`;
    return `<div class="folha-topo"><h2>Opções</h2><button class="ic-mini" data-f="fechar" aria-label="Fechar">${G.x}</button></div>
      ${s.modo === 'combate' ? `<div class="menu-sec"><div class="tit">Combate</div>
        ${opc('rerrolarCadaRodada', 'Rolar iniciativa a cada rodada (regra da casa)', 'Pelo livro, rola-se só no início do combate e a ordem se mantém (p. 231). Valores digitados não são sobrescritos.')}
        ${opc('inimigosEmGrupo', 'Inimigos fazem um único teste', 'Regra do livro (p. 231): um teste para todos os inimigos, com o menor bônus.')}
        ${opc('mostrarPVInimigos', 'Mostrar PV dos inimigos na tela', 'Desligado, a tela dos jogadores mostra só Ileso / Ferido / Muito ferido / Quase caindo.')}
        <div class="so-cel menu-botoes"><button class="btn" data-f="acao" data-v="novarodada">Nova rodada</button><button class="btn" data-f="acao" data-v="rolar">${IC.dado} Rolar iniciativa</button></div>
        ${cb.ativo ? '<button class="btn perigo largo" data-f="encerrar">Encerrar combate</button>' : ''}</div>` : `<div class="menu-sec so-cel"><div class="tit">Grupo</div>
        <div class="menu-botoes"><button class="btn" data-f="acao" data-v="novo">+ Personagem</button><button class="btn" data-f="acao" data-v="limparcond">Limpar condições</button></div></div>`}
      <div class="menu-sec"><div class="tit">Mesa</div>
        <div class="menu-botoes">
          <button class="btn so-cel" data-f="acao" data-v="refazer" ${store.podeRefazer() ? '' : 'disabled'}>${G.ref} Refazer</button>
          <button class="btn" data-f="acao" data-v="display">${IC.monitor} Tela dos jogadores</button>
          <button class="btn" data-f="acao" data-v="renomear">Renomear mesa</button>
          <button class="btn" data-f="acao" data-v="mesas">Mesas</button>
        </div>
        <div class="nota">${!S.Sync.online() ? 'Modo local: dados só neste navegador.' : store.erroSalvar ? 'Erro ao salvar: ' + esc(store.erroSalvar) : 'Sincronizado.'}</div></div>`;
  }

  /** Folha inferior do celular: Dano/Cura/PM com teclado (como a aba Vida do MobileT20). */
  function htmlTeclado(c) {
    const jog = c.tipo === 'jogador';
    if (!jog && ui.alvo === 'tb') ui.alvo = 'pv';
    if (ui.alvo === 'pm' && c.pm.max <= 0) ui.alvo = 'pv';
    const v = parseInt(ui.visor, 10) || 0;
    const rcard = (alvo, rot, num, max, pct) => `<button class="rcard ${alvo} ${ui.alvo === alvo ? 'sel' : ''}" data-f="alvo" data-v="${alvo}"><span class="rc-rot">${rot}</span><span class="rc-num">${num}</span><span class="rc-max">${max}</span>${pct == null ? '' : `<span class="trilho"><i style="width:${pct}%"></i></span>`}</button>`;
    const pct = r => r.max > 0 ? Math.max(0, Math.min(100, r.atual / r.max * 100)) : 0;
    const acoes = {
      pv: [['menos', 'Dano', 'dano'], ['mais', 'Cura', 'cura']],
      pm: [['menos', 'Gastar', 'gasto'], ['mais', 'Recup.', 'cura']],
      tb: [['menos', 'Gastar', 'dano'], ['mais', 'Receber', 'cura']]
    }[ui.alvo];
    const tecla = d => `<button class="tecla" data-f="tecla" data-v="${d}">${d}</button>`;
    const acaoBtn = (a) => `<button class="acao ${a[2]}" data-f="aplicar" data-v="${a[0]}" ${v ? '' : 'disabled'}>${a[1]}</button>`;
    const rotVisor = { pv: 'Pontos de Vida', pm: 'Pontos de Mana', tb: 'Tibares (T$)' }[ui.alvo];
    return `<div class="folha-topo"><h2>${esc(c.nome)}</h2><span class="nota">${jog ? 'Nv ' + c.nivel + ' · ' : ''}DEF ${c.defesa}</span>${faixa(c)}<button class="ic-mini" data-f="fechar" aria-label="Fechar">${G.x}</button></div>
      <div class="rcards ${jog ? 'tres' : ''}">
        ${rcard('pv', 'PV', c.pv.atual, 'de ' + c.pv.max, pct(c.pv))}
        ${c.pm.max > 0 ? rcard('pm', 'PM', c.pm.atual, 'de ' + c.pm.max, pct(c.pm)) : ''}
        ${jog ? rcard('tb', 'T$', fmtNum(c.dinheiro), c.racoes + ' rações', null) : ''}
      </div>
      <div class="visor-linha"><span class="previa">${rotVisor}</span><span class="visor">${v || 0}</span></div>
      <div class="teclado">
        ${tecla(7)}${tecla(8)}${tecla(9)}${acaoBtn(acoes[0])}
        ${tecla(4)}${tecla(5)}${tecla(6)}${acaoBtn(acoes[1])}
        ${tecla(1)}${tecla(2)}${tecla(3)}<button class="acao meio" data-f="metade" ${v > 1 ? '' : 'disabled'} aria-label="Metade">½</button>
        <button class="tecla" data-f="tecla" data-v="del" aria-label="Apagar">${G.apagar}</button>${tecla(0)}<button class="tecla" data-f="tecla" data-v="c" aria-label="Limpar">C</button><button class="acao meio" data-f="cond">+ Cond.</button>
      </div>
      ${jog ? `<div class="folha-rodape"><span><span class="gl-racao" title="Rações">${IC.racao}</span> Rações <b>${c.racoes}</b></span><span class="grupo-btn"><button class="mini" data-f="rac" data-v="-1" aria-label="Tirar 1 ração">−</button><button class="mini" data-f="rac" data-v="1" aria-label="Somar 1 ração">+</button></span><button class="mini texto" data-f="editar">${G.lapis} Editar</button></div>` : ''}
      ${chipsCond(c, true)}`;
  }

  folhaRaiz.addEventListener('click', ev => {
    const b = ev.target.closest('[data-f],[data-a]'); if (!b) return;
    if (b.dataset.a === 'rmcond') { acao('rmCondicao', { id: b.dataset.id, uid: b.dataset.uid }); return; }
    const f = b.dataset.f, v = b.dataset.v, id = ui.folhaId;
    switch (f) {
      case 'fechar': fecharFolha(); break;
      case 'alvo': ui.alvo = v; ui.visor = ''; renderFolha(); break;
      case 'tecla':
        if (v === 'del') ui.visor = ui.visor.slice(0, -1);
        else if (v === 'c') ui.visor = '';
        else if (ui.visor.length < 4) ui.visor = (ui.visor + v).replace(/^0+/, '');
        renderFolha(); break;
      case 'metade': ui.visor = String(Math.floor((parseInt(ui.visor, 10) || 0) / 2) || ''); renderFolha(); break;
      case 'aplicar': {
        const n = parseInt(ui.visor, 10) || 0; if (!n) break;
        ui.visor = '';
        if (ui.alvo === 'pv') acao('vida', { id, n, tipo: v === 'menos' ? 'dano' : 'cura' });
        else if (ui.alvo === 'pm') acao('mana', { id, n, tipo: v === 'menos' ? 'gastar' : 'recuperar' });
        else acao('recurso', { id, campo: 'dinheiro', delta: v === 'menos' ? -n : n });
        renderFolha(); break;
      }
      case 'rac': acao('recurso', { id, campo: 'racoes', delta: +v }); break;
      case 'cond': modalCondicao(id); break;
      case 'editar': { const j = store.estado.jogadores.find(x => x.id === id); fecharFolha(); modalPersonagem(j); break; }
      case 'encerrar': fecharFolha(); modalEncerrar(); break;
      case 'acao':
        fecharFolha();
        if (v === 'novarodada') acao('novaRodada');
        else if (v === 'rolar') acao('rolarIniciativa');
        else if (v === 'novo') modalPersonagem();
        else if (v === 'limparcond') acao('limparCondicoesGrupo');
        else if (v === 'refazer') store.refazer();
        else if (v === 'display') abrirDisplay();
        else if (v === 'renomear') modalRenomear();
        else if (v === 'mesas') { store.salvarAgora(); telaMesas(); }
        break;
    }
  });
  folhaRaiz.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.opc) acao('opcaoCombate', { chave: t.dataset.opc, valor: t.checked });
  });

  // ---------- Modais ----------
  function abrirModal(html) {
    modalRaiz.innerHTML = `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const fundo = modalRaiz.firstChild;
    fundo.addEventListener('mousedown', ev => { if (ev.target === fundo) fecharModal(); });
    const primeiro = fundo.querySelector('input:not([type=checkbox]):not([type=radio]), select');
    if (primeiro && !celular()) primeiro.focus();
    fundo.querySelectorAll('[data-fechar]').forEach(b => b.onclick = fecharModal);
    return fundo.firstChild;
  }
  function fecharModal() { modalRaiz.innerHTML = ''; }

  function modalRenomear() {
    const m = abrirModal(`<h2>Renomear mesa</h2><form id="f-ren" class="form-col">
      <input type="text" name="nome" value="${esc(store.estado.nome)}" maxlength="60" required>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`);
    m.querySelector('form').onsubmit = ev => { ev.preventDefault(); acao('renomearMesa', { nome: ev.target.nome.value.trim() }); fecharModal(); };
  }

  function modalPersonagem(j) {
    const s = store.estado;
    const i = j ? s.jogadores.indexOf(j) : -1;
    const v = j ? { nome: j.nome, jogador: j.jogador, nivel: j.nivel, pvMax: j.pv.max, pvAtual: j.pv.atual, pmMax: j.pm.max, pmAtual: j.pm.atual, defesa: j.defesa, iniciativa: j.iniciativa, dinheiro: j.dinheiro, racoes: j.racoes, diasSemComer: j.diasSemComer } : { nivel: 1, defesa: 10, iniciativa: 0, dinheiro: 0, racoes: 0, diasSemComer: 0 };
    const f = (nome, rot, tipo, extra) => `<label class="campo ${extra || ''}">${rot}<input type="${tipo || 'number'}" name="${nome}" value="${esc(v[nome] == null ? '' : v[nome])}" ${tipo === 'text' ? 'maxlength="40"' : nome === 'dinheiro' ? 'step="0.01" inputmode="decimal"' : 'step="1" inputmode="numeric"'}></label>`;
    const m = abrirModal(`<h2>${j ? 'Editar personagem' : 'Novo personagem'}</h2>
      <form id="f-pj" class="form-col"><div class="form-grade">
        ${f('nome', 'Personagem', 'text', 'largo')}${f('jogador', 'Jogador (opcional)', 'text', 'largo')}
        ${f('nivel', 'Nível')}${f('defesa', 'Defesa')}${f('iniciativa', 'Iniciativa (bônus)')}
        ${f('pvMax', 'PV máximo')}${f('pvAtual', 'PV atual')}${f('pmMax', 'PM máximo')}${f('pmAtual', 'PM atual')}
        ${f('dinheiro', 'Tibares (T$)')}${f('racoes', 'Rações')}${f('diasSemComer', 'Dias sem comer')}
      </div>
      ${j && j.morto ? `<label class="check"><input type="checkbox" name="morto" checked> Morto${j.morto === 'fome' ? ' (fome)' : ''}</label>` : ''}
      ${j && s.jogadores.length > 1 ? `<div class="linha-form"><span class="nota">Posição no grupo</span>
        <button type="button" class="btn" data-mover="-1" ${i === 0 ? 'disabled' : ''}><span class="seta">${G.ant}</span> Antes</button>
        <button type="button" class="btn" data-mover="1" ${i === s.jogadores.length - 1 ? 'disabled' : ''}>Depois <span class="seta">${G.prox}</span></button></div>` : ''}
      <div class="nota">PV/PM atual vazio = cheio.</div>
      <div class="rodape">${j ? '<button type="button" class="btn perigo" id="b-rm" style="margin-right:auto">Remover</button>' : ''}
        <button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`);
    const form = m.querySelector('form');
    form.nome.required = true;
    form.onsubmit = ev => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      if (j) { d.id = j.id; if (j.morto) d.morto = form.morto.checked ? j.morto : null; }
      acao('salvarJogador', d); fecharModal();
    };
    m.querySelectorAll('[data-mover]').forEach(b => b.onclick = () => {
      acao('moverJogador', { id: j.id, dir: +b.dataset.mover });
      modalPersonagem(store.estado.jogadores.find(x => x.id === j.id));
    });
    const rm = m.querySelector('#b-rm');
    if (rm) rm.onclick = () => {
      if (rm.dataset.conf !== '1') { rm.dataset.conf = '1'; rm.textContent = 'Confirmar remoção'; return; }
      acao('removerJogador', { id: j.id }); fecharModal();
    };
  }

  function modalCondicao(id) {
    const s = store.estado;
    const c = S.achar(s, id); if (!c) return;
    const vez = S.daVez(s); const vezC = vez && S.achar(s, vez);
    const m = abrirModal(`<h2>Condição · ${esc(c.nome)}</h2>
      <div class="seg-dur">
        <label><input type="radio" name="dur" value="cena" checked><span>Até o fim da cena</span></label>
        <label><input type="radio" name="dur" value="rodadas"><span>Rodadas <input type="number" id="c-rod" value="1" min="1" aria-label="número de rodadas"></span></label>
        <label><input type="radio" name="dur" value="indef"><span>Indefinida</span></label>
      </div>
      ${vezC ? `<div class="nota">Em rodadas: termina no início do turno de ${esc(vezC.nome)} (quem está na vez agora, p. 232).</div>` : ''}
      <div class="grade-cond">${R.CONDICOES.map(x => `<button data-c="${x.id}">${esc(x.nome)}<small>${esc(x.curto)}</small></button>`).join('')}</div>
      <form id="f-livre" class="linha-form"><input type="text" name="livre" maxlength="40" placeholder="Outro efeito (ex.: Abençoado +1)"><button class="btn">Adicionar</button></form>
      <div class="nota">Repetir uma condição que agrava troca pela mais grave (abalado → apavorado, fatigado → exausto…). Condições terminam no fim da cena, salvo indicação (p. 394).</div>
      <div class="rodape"><button class="btn" data-fechar>Fechar</button></div>`);
    m.querySelector('#c-rod').addEventListener('focus', () => { m.querySelector('input[value=rodadas]').checked = true; });
    const dur = () => {
      const t = m.querySelector('input[name=dur]:checked').value;
      return t === 'rodadas' ? { tipo: 'rodadas', rest: Math.max(1, parseInt(m.querySelector('#c-rod').value, 10) || 1) } : { tipo: t };
    };
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { acao('addCondicao', { id, cond: b.dataset.c, dur: dur() }); fecharModal(); });
    m.querySelector('#f-livre').onsubmit = ev => {
      ev.preventDefault(); const t = ev.target.livre.value.trim(); if (!t) return;
      acao('addCondicao', { id, cond: t, dur: dur() }); fecharModal();
    };
  }

  function modalDescanso() {
    const s = store.estado;
    if (!s.jogadores.length) return;
    const op = { tipo: 'normal', cuidados: {}, sopa: false, tormenta: false, comer: true };
    const m = abrirModal('<div id="desc" class="form-col"></div>');
    const corpo = m.querySelector('#desc');
    function desenhar() {
      const linhas = s.jogadores.map(j => {
        const r = R.aplicarDescanso(j, op.tipo, { cuidados: op.cuidados[j.id], sopa: op.sopa, tormenta: op.tormenta });
        const comida = op.comer ? (j.racoes > 0 ? `<span class="gl-racao" title="Rações">${IC.racao}</span> ${j.racoes - 1}` : '<span class="txt-aviso">sem ração</span>') : '';
        return `<tr><td>${esc(j.nome)} <span class="nota">Nv ${j.nivel}</span></td>
          <td><span class="ganho">+${r.ganhoPV}</span> → ${r.jogador.pv.atual}/${j.pv.max}</td>
          <td><span class="ganho">+${r.ganhoPM}</span> → ${r.jogador.pm.atual}/${j.pm.max}</td>
          <td><label class="check" title="Cura CD 15, só treinado: +1 PV por nível (p. 117)"><input type="checkbox" data-cuid="${j.id}" ${op.cuidados[j.id] ? 'checked' : ''} ${op.tipo === 'sem_sono' ? 'disabled' : ''}> Cuidados</label></td>
          <td>${comida}</td></tr>`;
      }).join('');
      corpo.innerHTML = `<h2>Descanso do grupo · fim do dia ${s.dia || 1}</h2>
        <div class="opcoes-descanso">${R.DESCANSOS.map(d => `<button class="opcao ${op.tipo === d.id ? 'ativa' : ''}" data-tipo="${d.id}"><b>${d.nome}</b><small>${d.id === 'sem_sono' ? 'recupera 0' : d.mult === 0.5 ? 'metade do nível' : d.mult === 1 ? '1 × nível' : d.mult + ' × nível'}</small></button>`).join('')}</div>
        <div class="nota">${esc(R.DESCANSO[op.tipo].desc)}. PV e PM nunca passam do máximo (p. 106).</div>
        <div class="tabela-rolagem"><table class="previa"><thead><tr><th>Personagem</th><th>PV</th><th>PM</th><th>Cura</th><th>${op.comer ? 'Rações' : ''}</th></tr></thead><tbody>${linhas}</tbody></table></div>
        <div class="linha-form">
          <label class="check"><input type="checkbox" data-op="comer" ${op.comer ? 'checked' : ''}> Consumir 1 ração de cada</label>
          <label class="check" title="+1 PM por nível na próxima noite (p. 162)"><input type="checkbox" data-op="sopa" ${op.sopa ? 'checked' : ''}> Sopa de peixe</label>
          <label class="check" title="Recuperação pela metade (p. 319)"><input type="checkbox" data-op="tormenta" ${op.tormenta ? 'checked' : ''}> Área de Tormenta</label>
        </div>
        <div class="nota">O descanso não remove condições pelo livro; use "Limpar condições" se fizer sentido. Quem volta a 1 PV ou mais recobra a consciência (p. 237).</div>
        <div class="rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="b-desc">Descansar</button></div>`;
      corpo.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { op.tipo = b.dataset.tipo; desenhar(); });
      corpo.querySelectorAll('[data-cuid]').forEach(b => b.onchange = () => { op.cuidados[b.dataset.cuid] = b.checked; desenhar(); });
      corpo.querySelectorAll('[data-op]').forEach(b => b.onchange = () => { op[b.dataset.op] = b.checked; desenhar(); });
      corpo.querySelector('[data-fechar]').onclick = fecharModal;
      corpo.querySelector('#b-desc').onclick = () => { fecharModal(); acao('descanso', op); };
    }
    desenhar();
  }

  /** Iniciar combate: marcar quem está surpreendido (p. 231). */
  function modalIniciar() {
    const s = store.estado;
    const todos = S.combatentes(s);
    if (!todos.length) return;
    const m = abrirModal(`<h2>Iniciar combate</h2>
      <div class="nota">Surpresa (p. 231): quem não percebeu os inimigos fica Surpreendido até o fim da 1ª rodada e não age nela.</div>
      <div class="lista-surpresa">${todos.map(c => `<label class="check linha-check ${c.tipo}"><input type="checkbox" data-surp="${c.id}"><span>${esc(c.nome)}</span><small>${c.tipo === 'jogador' ? 'Jogador' : 'Inimigo'}</small></label>`).join('')}</div>
      <div class="rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="b-ini"><span class="gl">${G.espadas}</span> Iniciar combate</button></div>`);
    m.querySelector('#b-ini').onclick = () => {
      const surpreendidos = Array.from(m.querySelectorAll('[data-surp]:checked')).map(x => x.dataset.surp);
      fecharModal(); acao('iniciarCombate', { surpreendidos });
    };
  }

  function modalInimigo() {
    const rec = store.estado.recentes || [];
    const m = abrirModal(`<h2>Adicionar inimigo</h2>
      ${rec.length ? `<div><div class="nota" style="margin-bottom:6px">Recentes</div><div class="recentes">${rec.map((r, i) => `<button class="chip" data-rec="${i}">${esc(r.nome)} <small>PV ${r.pv}</small></button>`).join('')}</div></div>` : ''}
      <form id="f-ini" class="form-col"><div class="form-grade">
        <label class="campo largo">Nome<input type="text" name="nome" required maxlength="36" placeholder="Goblin"></label>
        <label class="campo">PV<input type="number" name="pv" value="10" min="1" required></label>
        <label class="campo">PM<input type="number" name="pm" value="0" min="0"></label>
        <label class="campo">Defesa<input type="number" name="defesa" value="12"></label>
        <label class="campo">Iniciativa (bônus)<input type="number" name="iniciativa" value="0"></label>
        <label class="campo">Quantidade<input type="number" name="qtd" value="1" min="1" max="20"></label>
      </div>
      <label class="check"><input type="checkbox" name="visivel" checked> Aparece na tela dos jogadores</label>
      <div class="nota">${store.estado.combate.ativo ? 'O combate já começou: os novos inimigos fazem o próprio teste de Iniciativa agora e só agem na próxima rodada (p. 231).' : 'Com quantidade maior que 1, os nomes ficam numerados (Goblin 1, Goblin 2…).'}</div>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Adicionar</button></div></form>`);
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
    const m = abrirModal(`<h2>Editar inimigo</h2><form class="form-col"><div class="form-grade">
      <label class="campo largo">Nome<input type="text" name="nome" value="${esc(c.nome)}" maxlength="40" required></label>
      <label class="campo">PV atual<input type="number" name="pvAtual" value="${c.pv.atual}"></label>
      <label class="campo">PV máximo<input type="number" name="pvMax" value="${c.pv.max}"></label>
      <label class="campo">PM atual<input type="number" name="pmAtual" value="${c.pm.atual}"></label>
      <label class="campo">PM máximo<input type="number" name="pmMax" value="${c.pm.max}"></label>
      <label class="campo">Defesa<input type="number" name="defesa" value="${c.defesa}"></label>
      <label class="campo">Iniciativa (bônus)<input type="number" name="iniciativa" value="${c.iniciativa}"></label>
      </div><div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`);
    const form = m.querySelector('form');
    form.onsubmit = ev => { ev.preventDefault(); const d = Object.fromEntries(new FormData(form).entries()); d.id = c.id; acao('salvarInimigo', d); fecharModal(); };
  }

  function modalEncerrar() {
    const s = store.estado;
    const vivos = s.combate.inimigos.filter(i => i.pv.atual > 0).length;
    const m = abrirModal(`<h2>Encerrar combate</h2>
      <p class="texto">O fim do combate encerra a cena: as condições de cena e de rodadas saem (p. 394). Ficam só as indefinidas, como Inconsciente e Sangrando de quem caiu.</p>
      <label class="check"><input type="checkbox" id="e-rm" checked> Remover os inimigos${vivos ? ` (${vivos} ainda de pé)` : ''}</label>
      <div class="rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn perigo" id="b-enc">Encerrar combate</button></div>`);
    m.querySelector('#b-enc').onclick = () => { const manter = !m.querySelector('#e-rm').checked; fecharModal(); acao('encerrarCombate', { manterInimigos: manter }); };
  }

  // reconecta se a sessão expirar / outra aba sair
  window.addEventListener('storage', ev => { if (ev.key === 't20s.auth' && S.Sync.online() && !ev.newValue) location.reload(); });

  boot().catch(e => { app.innerHTML = `<div class="centro"><div class="caixa"><h1>T20Session</h1><div class="erro">${esc(e.message || e)}</div></div></div>`; });
})();
