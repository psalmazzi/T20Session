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
    { id: 'caido', nome: 'Caído', curto: '–5 ataque corpo a corpo; Defesa –5 c.a.c., +5 à distância' },
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
    { id: 'sangrando', nome: 'Sangrando', curto: 'Con CD 15 no turno ou perde 1d6 PV', perigo: true },
    { id: 'sobrecarregado', nome: 'Sobrecarregado', curto: 'armadura –5; deslocamento –3m' },
    { id: 'surdo', nome: 'Surdo', curto: '–5 Iniciativa' },
    { id: 'surpreendido', nome: 'Surpreendido', curto: 'não age; desprevenido' },
    { id: 'vulneravel', nome: 'Vulnerável', curto: '–2 Defesa' }
  ];
  const COND = Object.fromEntries(CONDICOES.map(c => [c.id, c]));

  /** Aplica uma condição numa lista. Se já existe e tem `agrava`, troca pela mais grave (p. 394).
   *  dur: {tipo:'cena'|'rodadas'|'indef', rest?}. Devolve {lista, nota}. */
  function aplicarCondicao(lista, condId, dur, novoId) {
    const base = COND[condId];
    const nomeLivre = base ? null : String(condId).slice(0, 40);
    const atual = lista || [];
    const existente = atual.find(c => c.cond === condId);
    if (existente && base && base.agrava) {
      const mais = COND[base.agrava];
      const semAntiga = atual.filter(c => c !== existente && c.cond !== mais.id);
      return {
        lista: semAntiga.concat([{ id: novoId(), cond: mais.id, dur: existente.dur }]),
        nota: base.nome + ' de novo → ' + mais.nome
      };
    }
    if (existente) {
      // mesma condição sem agravar: fica a maior duração
      return { lista: atual.map(c => c === existente ? Object.assign({}, c, { dur: maiorDuracao(c.dur, dur) }) : c), nota: null };
    }
    const nova = { id: novoId(), cond: base ? condId : 'livre', nome: nomeLivre || undefined, dur: dur || { tipo: 'cena' } };
    return { lista: atual.concat([nova]), nota: null };
  }

  function maiorDuracao(a, b) {
    const peso = d => d.tipo === 'indef' ? 1e9 : d.tipo === 'cena' ? 1e6 : (d.rest || 0);
    return peso(b) > peso(a) ? b : a;
  }

  function nomeCondicao(c) { return c.cond === 'livre' ? (c.nome || 'Efeito') : (COND[c.cond] ? COND[c.cond].nome : c.cond); }
  function curtoCondicao(c) { return COND[c.cond] ? COND[c.cond].curto : ''; }
  function perigoCondicao(c) { return !!(COND[c.cond] && COND[c.cond].perigo); }

  /** Passa uma rodada: reduz durações em rodadas; devolve {lista, expiradas[]} */
  function passarRodada(lista) {
    const expiradas = [];
    const nova = [];
    (lista || []).forEach(c => {
      if (c.dur && c.dur.tipo === 'rodadas') {
        const rest = (c.dur.rest || 0) - 1;
        if (rest <= 0) { expiradas.push(c); return; }
        nova.push(Object.assign({}, c, { dur: { tipo: 'rodadas', rest } }));
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
  /** PM não fica negativo ao gastar; recuperar não passa do máximo. */
  function gastarPM(rec, n) { return Object.assign({}, rec, { atual: Math.max(0, rec.atual - Math.max(0, n | 0)) }); }

  // ---------- Descanso (p. 106, 117, 162, 319) ----------
  const DESCANSOS = [
    { id: 'ruim', nome: 'Ruim', mult: 0.5, desc: 'Ao relento, sem saco de dormir nem acampamento' },
    { id: 'normal', nome: 'Normal', mult: 1, desc: 'Estalagem comum ou acampamento com saco de dormir' },
    { id: 'confortavel', nome: 'Confortável', mult: 2, desc: 'Quarto privativo' },
    { id: 'luxuosa', nome: 'Luxuosa', mult: 3, desc: 'Acomodação de luxo' },
    { id: 'sem_sono', nome: 'Sem dormir', mult: 0, desc: 'Noite acordado: não recupera PV nem PM (p. 319)' }
  ];
  const DESCANSO = Object.fromEntries(DESCANSOS.map(d => [d.id, d]));

  /** Recuperação de uma noite. op: {cuidados (Cura CD 15: +nível PV), sopa (Sopa de Peixe: +nível PM), tormenta (metade)}.
   *  Metade arredonda para baixo (p. 226); livro não dá mínimo (nível 1 ruim = 0). */
  function recuperacaoDescanso(nivel, tipo, op) {
    op = op || {};
    const d = DESCANSO[tipo] || DESCANSO.normal;
    nivel = Math.max(1, nivel | 0);
    let pv = Math.floor(nivel * d.mult);
    let pm = Math.floor(nivel * d.mult);
    if (tipo !== 'sem_sono') {
      if (op.cuidados) pv += nivel;
      if (op.sopa) pm += nivel;
      if (op.tormenta) { pv = Math.floor(pv / 2); pm = Math.floor(pm / 2); }
    }
    return { pv, pm };
  }

  /** Aplica a noite num jogador: soma até o máximo (p. 106); quem estava caído e volta a ≥1 recobra a consciência (p. 237). */
  function aplicarDescanso(j, tipo, op) {
    const r = recuperacaoDescanso(j.nivel, tipo, op);
    const pv = Math.min(j.pv.max, j.pv.atual + r.pv);
    const pm = Math.min(j.pm.max, j.pm.atual + r.pm);
    let condicoes = j.condicoes || [];
    if (j.pv.atual <= 0 && pv >= 1) condicoes = condicoes.filter(c => c.cond !== 'inconsciente' && c.cond !== 'sangrando');
    return {
      jogador: Object.assign({}, j, { pv: Object.assign({}, j.pv, { atual: pv }), pm: Object.assign({}, j.pm, { atual: pm }), condicoes }),
      ganhoPV: pv - j.pv.atual, ganhoPM: pm - j.pm.atual
    };
  }

  // ---------- Fome e sede (p. 319) ----------
  /** Um dia sem comer não causa nada; depois, Fortitude por dia CD 15 +1 por teste anterior.
   *  diasSemComer = dias completos sem comida. Devolve a CD do teste de hoje ou null. */
  function cdFome(diasSemComer) { return diasSemComer >= 2 ? 15 + (diasSemComer - 2) : null; }

  /** Consome 1 ração (p. 162: alimenta uma pessoa por um dia). Sem ração, conta mais um dia sem comer. */
  function alimentar(j) {
    if ((j.racoes || 0) > 0) return { jogador: Object.assign({}, j, { racoes: j.racoes - 1, diasSemComer: 0 }), comeu: true };
    return { jogador: Object.assign({}, j, { diasSemComer: (j.diasSemComer || 0) + 1 }), comeu: false };
  }

  // ---------- Iniciativa (p. 230) ----------
  function d20(rng) { return 1 + Math.floor((rng || Math.random)() * 20); }

  /** Rola iniciativa. combatentes: [{id, tipo:'jogador'|'inimigo', iniciativa}]
   *  inimigosEmGrupo: o mestre faz um único teste para os inimigos usando o menor bônus (p. 230).
   *  Devolve {id: {d20, total, desempate}} */
  function rolarIniciativa(combatentes, op, rng) {
    op = op || {};
    rng = rng || Math.random;
    const res = {};
    const inimigos = combatentes.filter(c => c.tipo === 'inimigo');
    let grupo = null;
    if (op.inimigosEmGrupo && inimigos.length) {
      const menor = Math.min.apply(null, inimigos.map(i => i.iniciativa | 0));
      const dado = d20(rng);
      grupo = { d20: dado, total: dado + menor };
    }
    combatentes.forEach(c => {
      if (grupo && c.tipo === 'inimigo') res[c.id] = { d20: grupo.d20, total: grupo.total, desempate: rng() };
      else { const dado = d20(rng); res[c.id] = { d20: dado, total: dado + (c.iniciativa | 0), desempate: rng() }; }
    });
    return res;
  }

  /** Ordem: maior total; empate → maior modificador; persistindo, o desempate sorteado (p. 230). */
  function ordenarIniciativa(combatentes, inis) {
    return combatentes.slice().sort((a, b) => {
      const A = inis[a.id] || { total: -99, desempate: 0 }, B = inis[b.id] || { total: -99, desempate: 0 };
      if (B.total !== A.total) return B.total - A.total;
      if ((b.iniciativa | 0) !== (a.iniciativa | 0)) return (b.iniciativa | 0) - (a.iniciativa | 0);
      return (B.desempate || 0) - (A.desempate || 0);
    }).map(c => c.id);
  }

  const T20R = {
    CONDICOES, COND, aplicarCondicao, nomeCondicao, curtoCondicao, perigoCondicao, passarRodada, fimDeCena,
    limiarMorte, estadoPV, descricaoInimigo, aplicarDano, aplicarCura, gastarPM,
    DESCANSOS, DESCANSO, recuperacaoDescanso, aplicarDescanso,
    cdFome, alimentar, d20, rolarIniciativa, ordenarIniciativa
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = T20R;
  else raiz.T20R = T20R;
})(typeof window !== 'undefined' ? window : globalThis);
