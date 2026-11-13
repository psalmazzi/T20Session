/* T20Session — regras puras de Tormenta20 (Livro Base JdA, páginas impressas).
 * Sem DOM e sem estado: tudo aqui pode ser testado no Node (tests/regras.test.js).
 * RNG injetável: funções que rolam recebem `rng` (padrão Math.random). */
(function (raiz) {
  'use strict';

  // ---------- Condições (p. 394–395) ----------
  // curto: resumo mostrado no card e na tela dos jogadores.
  // agrava: aplicar de novo a mesma condição vira esta (p. 394).
  const CONDICOES = [
    { id: 'abalado', nome: 'Abalado', curto: '–2 em testes de perícia', agrava: 'apavorado' },
    { id: 'agarrado', nome: 'Agarrado', curto: '–2 ataque, só armas leves; desprevenido e imóvel' },
    { id: 'alquebrado', nome: 'Alquebrado', curto: 'habilidades custam +1 PM' },
    { id: 'apavorado', nome: 'Apavorado', curto: '–5 em perícias; não se aproxima da fonte' },
    { id: 'atordoado', nome: 'Atordoado', curto: 'não pode fazer ações; desprevenido' },
    { id: 'caido', nome: 'Caído', curto: '–5 ataque c.a.c.; desloc. 1,5m; Defesa –5 c.a.c., +5 à distância' },
    { id: 'cego', nome: 'Cego', curto: '–5 perícias de For/Des; desprevenido e lento' },
    { id: 'confuso', nome: 'Confuso', curto: '1d6 no turno decide o que faz' },
    { id: 'debilitado', nome: 'Debilitado', curto: '–5 em testes de For/Des/Con', agrava: 'inconsciente' },
    { id: 'desprevenido', nome: 'Desprevenido', curto: '–5 Defesa e Reflexos' },
    { id: 'doente', nome: 'Doente', curto: 'conforme a doença' },
    { id: 'em_chamas', nome: 'Em chamas', curto: '1d6 fogo no início do turno', perigo: true },
    { id: 'enfeiticado', nome: 'Enfeitiçado', curto: 'prestativo com a fonte' },
    { id: 'enjoado', nome: 'Enjoado', curto: 'só 1 ação padrão ou de movimento' },
    { id: 'enredado', nome: 'Enredado', curto: '–2 ataque; lento e vulnerável' },
    { id: 'envenenado', nome: 'Envenenado', curto: 'conforme o veneno', perigo: true },
    { id: 'esmorecido', nome: 'Esmorecido', curto: '–5 em testes de Int/Sab/Car' },
    { id: 'exausto', nome: 'Exausto', curto: 'debilitado, lento e vulnerável', agrava: 'inconsciente' },
    { id: 'fascinado', nome: 'Fascinado', curto: '–5 Percepção; só observa' },
    { id: 'fatigado', nome: 'Fatigado', curto: 'fraco e vulnerável', agrava: 'exausto' },
    { id: 'fraco', nome: 'Fraco', curto: '–2 em testes de For/Des/Con', agrava: 'debilitado' },
    { id: 'frustrado', nome: 'Frustrado', curto: '–2 em testes de Int/Sab/Car', agrava: 'esmorecido' },
    { id: 'imovel', nome: 'Imóvel', curto: 'deslocamento 0' },
    { id: 'inconsciente', nome: 'Inconsciente', curto: 'não age; indefeso', perigo: true },
    { id: 'indefeso', nome: 'Indefeso', curto: '–10 Defesa; falha em Reflexos' },
    { id: 'lento', nome: 'Lento', curto: 'deslocamento à metade' },
    { id: 'ofuscado', nome: 'Ofuscado', curto: '–2 ataque e Percepção' },
    { id: 'paralisado', nome: 'Paralisado', curto: 'só ações mentais; imóvel e indefeso' },
    { id: 'pasmo', nome: 'Pasmo', curto: 'não pode fazer ações' },
    { id: 'petrificado', nome: 'Petrificado', curto: 'RD 8; inconsciente' },
    { id: 'sangrando', nome: 'Sangrando', curto: 'início do turno: Con CD 15; falha –1d6 PV, passa remove', perigo: true },
    { id: 'sobrecarregado', nome: 'Sobrecarregado', curto: 'armadura –5; deslocamento –3m' },
    { id: 'surdo', nome: 'Surdo', curto: '–5 Iniciativa' },
    { id: 'surpreendido', nome: 'Surpreendido', curto: 'não age; desprevenido' },
    { id: 'vulneravel', nome: 'Vulnerável', curto: '–2 Defesa' }
  ];
  const COND = Object.fromEntries(CONDICOES.map(c => [c.id, c]));

  /** Aplica uma condição numa lista. Se já existe e tem `agrava`, troca pela mais grave (p. 394).
   *  dur: {tipo:'cena'|'rodadas'|'indef', rest?, marco?}. marco = id de quem estava na vez quando a
   *  condição foi aplicada (a duração em rodadas termina no início do turno dele, p. 232).
   *  extra: campos copiados para a condição nova (ex.: {origem:'fome'}). Devolve {lista, nota}. */
  function aplicarCondicao(lista, condId, dur, novoId, extra) {
    dur = dur || { tipo: 'cena' };
    const base = COND[condId];
    const nomeLivre = base ? null : String(condId).slice(0, 40);
    const atual = lista || [];
    const existente = atual.find(c => c.cond === condId);
    if (existente && base && base.agrava) {
      const mais = COND[base.agrava];
      const semAntiga = atual.filter(c => c !== existente && c.cond !== mais.id);
      return {
        lista: semAntiga.concat([Object.assign({ id: novoId(), cond: mais.id, dur: maiorDuracao(existente.dur, dur) }, extra || {})]),
        nota: base.nome + ' de novo → ' + mais.nome
      };
    }
    if (existente) {
      // mesma condição sem agravar: fica a maior duração
      return { lista: atual.map(c => c === existente ? Object.assign({}, c, { dur: maiorDuracao(c.dur, dur) }) : c), nota: null };
    }
    const nova = Object.assign({ id: novoId(), cond: base ? condId : 'livre', nome: nomeLivre || undefined, dur }, extra || {});
    return { lista: atual.concat([nova]), nota: null };
  }

  function maiorDuracao(a, b) {
    if (!a) return b; if (!b) return a;
    const peso = d => d.tipo === 'indef' ? 1e9 : d.tipo === 'cena' ? 1e6 : (d.rest || 0);
    return peso(b) > peso(a) ? b : a;
  }

  function nomeCondicao(c) { return c.cond === 'livre' ? (c.nome || 'Efeito') : (COND[c.cond] ? COND[c.cond].nome : c.cond); }
  function curtoCondicao(c) { return COND[c.cond] ? COND[c.cond].curto : ''; }
  function perigoCondicao(c) { return !!(COND[c.cond] && COND[c.cond].perigo); }

  /** Desconta 1 rodada das durações em rodadas (só das que passam em `filtro`, se dado).
   *  Devolve {lista, expiradas[]}. Quem chama decide o momento (início do turno do marco, p. 232). */
  function passarRodada(lista, filtro) {
    const expiradas = [];
    const nova = [];
    (lista || []).forEach(c => {
      if (c.dur && c.dur.tipo === 'rodadas' && (!filtro || filtro(c))) {
        const rest = (c.dur.rest || 0) - 1;
        if (rest <= 0) { expiradas.push(c); return; }
        nova.push(Object.assign({}, c, { dur: Object.assign({}, c.dur, { rest }) }));
      } else nova.push(c);
    });
    return { lista: nova, expiradas };
  }

  /** Fim da cena: condições terminam no fim da cena, salvo indicação (p. 394). Ficam só as indefinidas. */
  function fimDeCena(lista) { return (lista || []).filter(c => c.dur && c.dur.tipo === 'indef'); }

  // ---------- PV / estado (p. 106, 237) ----------
  /** Morre em –10 ou –metade dos PV totais, o que for mais baixo (p. 237). */
  function limiarMorte(pvMax) { return Math.min(-10, -Math.floor((pvMax || 0) / 2)); }

  function estadoPV(atual, max) {
    if (atual <= limiarMorte(max)) return 'morto';
    if (atual <= 0) return 'caido';
    if (max > 0 && atual <= max * 0.25) return 'critico';
    if (max > 0 && atual <= max * 0.5) return 'ferido';
    return 'ok';
  }

  /** Descrição vaga para inimigos na tela dos jogadores. */
  function descricaoInimigo(atual, max) {
    if (atual <= 0) return 'Derrotado';
    if (atual >= max) return 'Ileso';
    const f = atual / max;
    if (f > 0.5) return 'Ferido';
    if (f > 0.25) return 'Muito ferido';
    return 'Quase caindo';
  }

  function aplicarDano(rec, n) {
    n = Math.max(0, Math.floor(n || 0));
    return Object.assign({}, rec, { atual: rec.atual - n });
  }
  /** Cura nunca passa do máximo (p. 106). */
  function aplicarCura(rec, n) {
    n = Math.max(0, Math.floor(n || 0));
    return Object.assign({}, rec, { atual: Math.min(rec.max, rec.atual + n) });
  }
  /** Não se pode gastar mais PM do que se tem (p. 106): pedido maior devolve `rec` sem mudança. */
  function gastarPM(rec, n) {
    n = Math.max(0, n | 0);
    if (n > rec.atual) return rec;
    return Object.assign({}, rec, { atual: rec.atual - n });
  }
  function podeGastarPM(rec, n) { return Math.max(0, n | 0) <= rec.atual; }

  /** Morto: PV no limiar (p. 237) ou marcado (ex.: 4ª falha de fome, p. 319). */
  function estaMorto(c) { return !!c.morto || estadoPV(c.pv.atual, c.pv.max) === 'morto'; }

  // ---------- Descanso (p. 106, 117, 162, 319) ----------
  const DESCANSOS = [
    { id: 'ruim', nome: 'Ruim', mult: 0.5, desc: 'Ao relento, sem saco de dormir nem acampamento' },
    { id: 'normal', nome: 'Normal', mult: 1, desc: 'Estalagem comum ou acampamento com saco de dormir' },
    { id: 'confortavel', nome: 'Confortável', mult: 2, desc: 'Quarto privativo' },
    { id: 'luxuosa', nome: 'Luxuosa', mult: 3, desc: 'Acomodação de luxo' },
    { id: 'sem_sono', nome: 'Sem dormir', mult: 0, desc: 'Noite acordado: não recupera PV nem PM (p. 319)' }
  ];
  const DESCANSO = Object.fromEntries(DESCANSOS.map(d => [d.id, d]));

  /** Poderes que mudam o descanso, guardados na ficha (p. 94, 133, 319). */
  const PODERES_DESCANSO = [
    { id: 'estoico', nome: 'Estoico', pag: 94, desc: 'condição de descanso sobe uma categoria' },
    { id: 'vidaRustica', nome: 'Vida Rústica', pag: 94, desc: 'ao relento, recupera no mínimo o nível' },
    { id: 'descansoNatural', nome: 'Descanso Natural', pag: 133, desc: 'dormir ao relento conta como confortável' },
    { id: 'imuneTormenta', nome: 'Imune à Tormenta', pag: 319, desc: 'lefeu e lefou: Área de Tormenta não reduz' }
  ];
  const ORDEM_DESCANSO = ['ruim', 'normal', 'confortavel', 'luxuosa'];

  /** Categoria efetiva: Descanso Natural troca relento (ruim) por confortável; Estoico sobe uma (até luxuosa). */
  function tipoEfetivo(tipo, pod) {
    pod = pod || {};
    if (tipo === 'sem_sono' || !DESCANSO[tipo]) return tipo;
    let t = tipo;
    if (pod.descansoNatural && t === 'ruim') t = 'confortavel';
    if (pod.estoico) t = ORDEM_DESCANSO[Math.min(ORDEM_DESCANSO.indexOf(t) + 1, 3)];
    return t;
  }

  /** Recuperação de uma noite (ordem do descanso.json): categoria → fórmula → extras → Vida Rústica → Tormenta.
   *  op: {cuidados (Cura CD 15: +nível PV, p. 117), sopa (Sopa de Peixe: +nível PM, p. 162), tormenta (metade, p. 319),
   *       minimoNivel (Vida Rústica ao relento)}. Metade arredonda para baixo (p. 226). */
  function recuperacaoDescanso(nivel, tipo, op) {
    op = op || {};
    const d = DESCANSO[tipo] || DESCANSO.normal;
    nivel = Math.max(1, nivel | 0);
    let pv = Math.floor(nivel * d.mult);
    let pm = Math.floor(nivel * d.mult);
    if (tipo !== 'sem_sono') {
      if (op.cuidados) pv += nivel;
      if (op.sopa) pm += nivel;
      if (op.minimoNivel) { pv = Math.max(pv, nivel); pm = Math.max(pm, nivel); }
      if (op.tormenta) { pv = Math.floor(pv / 2); pm = Math.floor(pm / 2); }
    }
    return { pv, pm };
  }

  /** Aplica a noite num jogador, considerando os poderes da ficha (j.poderes).
   *  Soma até o máximo (p. 106); quem estava caído e volta a ≥1 recobra a consciência (p. 237). */
  function aplicarDescanso(j, tipo, op) {
    op = op || {};
    const pod = j.poderes || {};
    const efetivo = tipoEfetivo(tipo, pod);
    const r = recuperacaoDescanso(j.nivel, efetivo, {
      cuidados: op.cuidados, sopa: op.sopa,
      minimoNivel: !!(pod.vidaRustica && tipo === 'ruim'),
      tormenta: !!(op.tormenta && !pod.imuneTormenta)
    });
    const pv = Math.min(j.pv.max, j.pv.atual + r.pv);
    const pm = Math.min(j.pm.max, j.pm.atual + r.pm);
    let condicoes = j.condicoes || [];
    if (j.pv.atual <= 0 && pv >= 1) condicoes = condicoes.filter(c => !(c.cond === 'sangrando' || (c.cond === 'inconsciente' && c.origem !== 'fome')));
    return {
      jogador: Object.assign({}, j, { pv: Object.assign({}, j.pv, { atual: pv }), pm: Object.assign({}, j.pm, { atual: pm }), condicoes }),
      ganhoPV: pv - j.pv.atual, ganhoPM: pm - j.pm.atual, tipoEfetivo: efetivo
    };
  }

  // ---------- Fome e sede (p. 319) ----------
  /** Um dia sem comer não causa nada; depois, Fortitude por dia CD 15 +1 por teste anterior.
   *  diasSemComer = dias completos sem comida. Devolve a CD do teste de hoje ou null. */
  function cdFome(diasSemComer) { return diasSemComer >= 2 ? 15 + (diasSemComer - 2) : null; }

  /** Consome 1 ração (p. 162: alimenta uma pessoa por um dia). Sem ração, conta mais um dia sem comer.
   *  Comer cura os efeitos da fome (p. 319): zera as falhas e tira as condições de origem 'fome'. */
  function alimentar(j) {
    if ((j.racoes || 0) > 0) return {
      jogador: Object.assign({}, j, { racoes: j.racoes - 1, diasSemComer: 0, falhasFome: 0, condicoes: (j.condicoes || []).filter(c => c.origem !== 'fome') }),
      comeu: true
    };
    return { jogador: Object.assign({}, j, { diasSemComer: (j.diasSemComer || 0) + 1 }), comeu: false };
  }

  /** Falha no teste de Fortitude da fome (p. 319): 1ª fatigado, 2ª exausto, 3ª inconsciente, 4ª morte.
   *  Condições indefinidas com origem 'fome' (só comida remove). Devolve {jogador, efeito}. */
  const EFEITOS_FOME = ['fatigado', 'exausto', 'inconsciente', 'morto'];
  function falhaFome(j, novoId) {
    const n = Math.min(4, (j.falhasFome || 0) + 1);
    const efeito = EFEITOS_FOME[n - 1];
    let condicoes = j.condicoes || [];
    let morto = j.morto || null;
    if (efeito === 'morto') morto = 'fome';
    else condicoes = condicoes.filter(c => c.origem !== 'fome')
      .concat([{ id: novoId(), cond: efeito, dur: { tipo: 'indef' }, origem: 'fome' }]);
    return { jogador: Object.assign({}, j, { falhasFome: n, condicoes, morto }), efeito };
  }

  // ---------- Iniciativa (p. 231) ----------
  function d20(rng) { return 1 + Math.floor((rng || Math.random)() * 20); }
  function d6(rng) { return 1 + Math.floor((rng || Math.random)() * 6); }

  /** Rola iniciativa. combatentes: [{id, tipo:'jogador'|'inimigo', iniciativa}]
   *  inimigosEmGrupo: o mestre faz um único teste para os inimigos usando o menor bônus (p. 231).
   *  Devolve {id: {d20, total, mod, desempate}}; mod = modificador usado no desempate
   *  (no grupo, o menor bônus, para o grupo não se dividir em volta de um jogador). */
  function rolarIniciativa(combatentes, op, rng) {
    op = op || {};
    rng = rng || Math.random;
    const res = {};
    const inimigos = combatentes.filter(c => c.tipo === 'inimigo');
    let grupo = null;
    if (op.inimigosEmGrupo && inimigos.length) {
      const menor = Math.min.apply(null, inimigos.map(i => i.iniciativa | 0));
      const dado = d20(rng);
      grupo = { d20: dado, total: dado + menor, mod: menor, desempate: rng() };
    }
    combatentes.forEach(c => {
      if (grupo && c.tipo === 'inimigo') res[c.id] = { d20: grupo.d20, total: grupo.total, mod: grupo.mod, desempate: grupo.desempate };
      else { const dado = d20(rng); res[c.id] = { d20: dado, total: dado + (c.iniciativa | 0), mod: c.iniciativa | 0, desempate: rng() }; }
    });
    return res;
  }

  /** Ordem: maior total; empate → maior modificador; persistindo, o desempate sorteado (= novo teste, p. 231).
   *  Resultados antigos sem `mod` usam o bônus do combatente. */
  function ordenarIniciativa(combatentes, inis) {
    const mod = (x, c) => x.mod !== undefined ? x.mod : (c.iniciativa | 0);
    return combatentes.slice().sort((a, b) => {
      const A = inis[a.id] || { total: -99, desempate: 0 }, B = inis[b.id] || { total: -99, desempate: 0 };
      if (B.total !== A.total) return B.total - A.total;
      if (mod(B, b) !== mod(A, a)) return mod(B, b) - mod(A, a);
      return (B.desempate || 0) - (A.desempate || 0);
    }).map(c => c.id);
  }

  const T20R = {
    CONDICOES, COND, aplicarCondicao, nomeCondicao, curtoCondicao, perigoCondicao, passarRodada, fimDeCena,
    limiarMorte, estadoPV, estaMorto, descricaoInimigo, aplicarDano, aplicarCura, gastarPM, podeGastarPM,
    DESCANSOS, DESCANSO, PODERES_DESCANSO, tipoEfetivo, recuperacaoDescanso, aplicarDescanso,
    cdFome, alimentar, falhaFome, EFEITOS_FOME, d20, d6, rolarIniciativa, ordenarIniciativa
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = T20R;
  else raiz.T20R = T20R;
})(typeof window !== 'undefined' ? window : globalThis);
