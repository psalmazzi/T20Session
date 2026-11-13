// node tests/regras.test.js
const assert = require('assert');
const R = require('../js/regras.js');
globalThis.T20R = R;
const S = require('../js/store.js');
let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log('✓', nome); };
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

t('morte em –10 ou –metade, o mais baixo (p. 237)', () => {
  assert.strictEqual(R.limiarMorte(12), -10);
  assert.strictEqual(R.limiarMorte(30), -15);
  assert.strictEqual(R.estadoPV(-10, 12), 'morto');
  assert.strictEqual(R.estadoPV(0, 12), 'caido');
  assert.strictEqual(R.estadoPV(3, 12), 'critico');
});
t('cura não passa do máximo (p. 106)', () => {
  assert.deepStrictEqual(R.aplicarCura({ atual: 8, max: 10 }, 5), { atual: 10, max: 10 });
  assert.deepStrictEqual(R.aplicarDano({ atual: 8, max: 10 }, 12), { atual: -4, max: 10 });
});
t('descanso: elfo nível 7 recupera 7 na estalagem e 3 ao relento (p. 106)', () => {
  assert.deepStrictEqual(R.recuperacaoDescanso(7, 'normal'), { pv: 7, pm: 7 });
  assert.deepStrictEqual(R.recuperacaoDescanso(7, 'ruim'), { pv: 3, pm: 3 });
  assert.deepStrictEqual(R.recuperacaoDescanso(1, 'ruim'), { pv: 0, pm: 0 });
  assert.deepStrictEqual(R.recuperacaoDescanso(4, 'luxuosa', { cuidados: true }), { pv: 16, pm: 12 });
  assert.deepStrictEqual(R.recuperacaoDescanso(4, 'normal', { sopa: true, tormenta: true }), { pv: 2, pm: 4 });
  assert.deepStrictEqual(R.recuperacaoDescanso(5, 'sem_sono', { cuidados: true }), { pv: 0, pm: 0 });
});
t('descanso respeita máximo e acorda quem volta a ≥1 PV', () => {
  const j = S.novoJogador({ nivel: 5, pvMax: 30, pvAtual: -2, pmMax: 10, pmAtual: 8, condicoes: [{ id: 'a', cond: 'inconsciente', dur: { tipo: 'indef' } }] });
  const r = R.aplicarDescanso(j, 'confortavel');
  assert.strictEqual(r.jogador.pv.atual, 8);
  assert.strictEqual(r.jogador.pm.atual, 10);
  assert.strictEqual(r.jogador.condicoes.length, 0);
});
t('fome: 1º dia livre, depois CD 15 +1 por teste (p. 319)', () => {
  assert.strictEqual(R.cdFome(1), null);
  assert.strictEqual(R.cdFome(2), 15);
  assert.strictEqual(R.cdFome(4), 17);
  const j = S.novoJogador({ racoes: 1 });
  const a = R.alimentar(j).jogador; assert.strictEqual(a.racoes, 0);
  const b = R.alimentar(a).jogador; assert.strictEqual(b.diasSemComer, 1);
});
t('condição repetida agrava (abalado → apavorado, fatigado → exausto)', () => {
  let n = 0; const id = () => 'c' + (n++);
  let r = R.aplicarCondicao([], 'abalado', { tipo: 'cena' }, id);
  r = R.aplicarCondicao(r.lista, 'abalado', { tipo: 'cena' }, id);
  assert.deepStrictEqual(r.lista.map(c => c.cond), ['apavorado']);
  r = R.aplicarCondicao([], 'fatigado', { tipo: 'cena' }, id);
  r = R.aplicarCondicao(r.lista, 'fatigado', { tipo: 'cena' }, id);
  assert.deepStrictEqual(r.lista.map(c => c.cond), ['exausto']);
});
t('rodadas expiram; fim de cena só mantém indefinidas', () => {
  const l = [{ id: 1, cond: 'lento', dur: { tipo: 'rodadas', rest: 1 } }, { id: 2, cond: 'fraco', dur: { tipo: 'rodadas', rest: 3 } }, { id: 3, cond: 'doente', dur: { tipo: 'indef' } }, { id: 4, cond: 'abalado', dur: { tipo: 'cena' } }];
  const r = R.passarRodada(l);
  assert.strictEqual(r.expiradas.length, 1);
  assert.strictEqual(r.lista.find(c => c.id === 2).dur.rest, 2);
  assert.deepStrictEqual(R.fimDeCena(l).map(c => c.id), [3]);
});
t('iniciativa: inimigos em grupo usam o menor bônus; empate pelo maior modificador (p. 231)', () => {
  const cs = [{ id: 'a', tipo: 'jogador', iniciativa: 5 }, { id: 'b', tipo: 'jogador', iniciativa: 2 }, { id: 'g1', tipo: 'inimigo', iniciativa: 4 }, { id: 'g2', tipo: 'inimigo', iniciativa: 1 }];
  // d20 = 10 (0.45), 13 (0.6), grupo 18 (0.85)
  const inis = R.rolarIniciativa(cs, { inimigosEmGrupo: true }, seq([0.45, 0.5, 0.6, 0.5, 0.85, 0.5, 0.5]));
  assert.strictEqual(inis.g1.total, inis.g2.total);
  assert.strictEqual(inis.g1.total, inis.g1.d20 + 1);
  const ord = R.ordenarIniciativa(cs, { a: { total: 15 }, b: { total: 15 }, g1: { total: 20 }, g2: { total: 3 } });
  assert.deepStrictEqual(ord, ['g1', 'a', 'b', 'g2']);
});
t('store: combate completo (inimigos, turnos, rodada, fim de cena)', () => {
  const s = S.estadoInicial('teste');
  const A = S.ACOES;
  A.salvarJogador(s, { nome: 'Ana', nivel: 3, pvMax: 20, pmMax: 6, iniciativa: 3 });
  A.salvarJogador(s, { nome: 'Bia', nivel: 3, pvMax: 18, pmMax: 9, iniciativa: 1 });
  A.addInimigo(s, { nome: 'Goblin', pv: 6, defesa: 13, iniciativa: 2, qtd: 2 });
  assert.deepStrictEqual(s.combate.inimigos.map(i => i.nome), ['Goblin 1', 'Goblin 2']);
  s.combate.rerrolarCadaRodada = false; // ordem fixa (livro): a condição de 1 rodada aplicada na vez do 1º termina no início da rodada 2
  A.iniciarCombate(s, {}, seq([0.1, 0.3, 0.5, 0.7, 0.9]));
  assert.strictEqual(s.combate.ordem.length, 4);
  const ana = s.jogadores[0];
  A.addCondicao(s, { id: ana.id, cond: 'lento', dur: { tipo: 'rodadas', rest: 1 } });
  A.addCondicao(s, { id: ana.id, cond: 'abalado', dur: { tipo: 'cena' } });
  // derruba um goblin: deve ser pulado
  const g1 = s.combate.inimigos[0];
  A.vida(s, { id: g1.id, n: 10, tipo: 'dano' });
  const vistos = [];
  for (let i = 0; i < 5 && s.combate.rodada === 1; i++) { A.proximoTurno(s, {}, Math.random); vistos.push(S.daVez(s)); }
  assert.ok(!vistos.includes(g1.id));
  assert.ok(vistos.length <= 4);
  assert.strictEqual(s.combate.rodada, 2);
  assert.deepStrictEqual(s.jogadores[0].condicoes.map(c => c.cond), ['abalado']);
  A.encerrarCombate(s, {});
  assert.strictEqual(s.combate.inimigos.length, 0);
  assert.strictEqual(s.jogadores[0].condicoes.length, 0);
  assert.strictEqual(s.modo, 'grupo');
});
t('store: descanso (formato antigo) consome ração', () => {
  const s = S.estadoInicial('t');
  S.ACOES.salvarJogador(s, { nome: 'Ana', nivel: 4, pvMax: 30, pvAtual: 10, pmMax: 12, pmAtual: 0, racoes: 2 });
  S.ACOES.descanso(s, { tipo: 'normal', comer: true, cuidados: { [s.jogadores[0].id]: true } });
  assert.strictEqual(s.jogadores[0].pv.atual, 18);
  assert.strictEqual(s.jogadores[0].pm.atual, 4);
  assert.strictEqual(s.jogadores[0].racoes, 1);
});
t('descanso individual: cada um com sua condição; quem fica de fora não muda', () => {
  const s = S.estadoInicial('t');
  S.ACOES.salvarJogador(s, { nome: 'Ana', nivel: 4, pvMax: 30, pvAtual: 10, pmMax: 12, pmAtual: 0, racoes: 1 });
  S.ACOES.salvarJogador(s, { nome: 'Bia', nivel: 4, pvMax: 30, pvAtual: 10, pmMax: 12, pmAtual: 0 });
  S.ACOES.salvarJogador(s, { nome: 'Caio', nivel: 4, pvMax: 30, pvAtual: 10, pmMax: 12, pmAtual: 0 });
  const [a, b, c] = s.jogadores.map(j => j.id);
  S.ACOES.descanso(s, { membros: { [a]: { tipo: 'luxuosa', comer: true }, [b]: { tipo: 'ruim', sopa: true } } });
  assert.deepStrictEqual(s.jogadores.map(j => [j.pv.atual, j.pm.atual]), [[22, 12], [12, 6], [10, 0]]);
  assert.strictEqual(s.jogadores[0].racoes, 0);
  assert.strictEqual(s.jogadores[1].diasSemComer, 0);
});
t('poderes de descanso: Estoico, Descanso Natural, Vida Rústica, imune à Tormenta (p. 94, 133, 319)', () => {
  const j = (pod, nivel) => S.novoJogador({ nivel: nivel || 4, pvMax: 99, pvAtual: 1, pmMax: 99, pmAtual: 0, poderes: pod });
  assert.strictEqual(R.tipoEfetivo('normal', { estoico: true }), 'confortavel');
  assert.strictEqual(R.tipoEfetivo('luxuosa', { estoico: true }), 'luxuosa');
  assert.strictEqual(R.tipoEfetivo('ruim', { descansoNatural: true, estoico: true }), 'luxuosa');
  assert.strictEqual(R.tipoEfetivo('sem_sono', { estoico: true }), 'sem_sono');
  assert.strictEqual(R.aplicarDescanso(j({ estoico: true }), 'normal').ganhoPV, 8);
  assert.strictEqual(R.aplicarDescanso(j({ descansoNatural: true }), 'ruim').ganhoPV, 8);
  assert.strictEqual(R.aplicarDescanso(j({ vidaRustica: true }, 5), 'ruim').ganhoPV, 5);
  assert.strictEqual(R.aplicarDescanso(j({ vidaRustica: true }, 5), 'normal', { tormenta: true }).ganhoPV, 2);
  assert.strictEqual(R.aplicarDescanso(j({ imuneTormenta: true }), 'normal', { tormenta: true }).ganhoPV, 4);
  assert.strictEqual(R.aplicarDescanso(j({}), 'normal', { tormenta: true }).ganhoPV, 2);
});

// ---------- correções da revisão de regras (specs/regras-sessao.md) ----------
const A = S.ACOES;
const mesa = () => {
  const s = S.estadoInicial('t');
  A.salvarJogador(s, { nome: 'Ana', nivel: 3, pvMax: 20, pmMax: 6, iniciativa: 3 });
  A.salvarJogador(s, { nome: 'Bia', nivel: 3, pvMax: 18, pmMax: 9, iniciativa: 1 });
  return s;
};
const conds = c => c.condicoes.map(x => x.cond).sort();

t('#1 textos de Caído e Sangrando (p. 394–395)', () => {
  assert.ok(/desloc\. 1,5m/.test(R.COND.caido.curto));
  assert.ok(/início do turno: Con CD 15/.test(R.COND.sangrando.curto));
});
t('#2 agravar fica com a maior duração', () => {
  let n = 0; const id = () => 'c' + (n++);
  let r = R.aplicarCondicao([], 'fatigado', { tipo: 'cena' }, id);
  r = R.aplicarCondicao(r.lista, 'fatigado', { tipo: 'indef' }, id);
  assert.strictEqual(r.lista[0].cond, 'exausto');
  assert.strictEqual(r.lista[0].dur.tipo, 'indef');
  r = R.aplicarCondicao([], 'abalado', { tipo: 'indef' }, id);
  r = R.aplicarCondicao(r.lista, 'abalado', { tipo: 'rodadas', rest: 2 }, id);
  assert.strictEqual(r.lista[0].dur.tipo, 'indef');
  // sem dur não quebra
  r = R.aplicarCondicao(r.lista, 'apavorado', undefined, id);
  assert.strictEqual(r.lista.length, 1);
});
t('#6 chegar a 0 PV ou menos: Inconsciente + Sangrando indefinidos (p. 106, 237)', () => {
  const s = mesa(); const ana = () => s.jogadores[0];
  A.vida(s, { id: ana().id, n: 20, tipo: 'dano' });
  assert.strictEqual(ana().pv.atual, 0);
  assert.deepStrictEqual(conds(ana()), ['inconsciente', 'sangrando']);
  assert.ok(ana().condicoes.every(c => c.dur.tipo === 'indef'));
  // sobrevive ao fim da cena
  A.limparCondicoesGrupo(s);
  assert.deepStrictEqual(conds(ana()), ['inconsciente', 'sangrando']);
  // estabilizou (tirou sangrando) e perdeu mais PV: volta a sangrar
  ana().condicoes = ana().condicoes.filter(c => c.cond !== 'sangrando');
  A.vida(s, { id: ana().id, n: 3, tipo: 'dano' });
  assert.deepStrictEqual(conds(ana()), ['inconsciente', 'sangrando']);
  // inimigo não recebe as condições
  A.addInimigo(s, { nome: 'Orc', pv: 5 });
  const orc = s.combate.inimigos[0];
  A.vida(s, { id: orc.id, n: 9, tipo: 'dano' });
  assert.strictEqual(orc.condicoes.length, 0);
});
t('#7 cura de 1+ PV estabiliza; com 1+ PV acorda (p. 237)', () => {
  const s = mesa(); const ana = () => s.jogadores[0];
  A.vida(s, { id: ana().id, n: 25, tipo: 'dano' });
  assert.strictEqual(ana().pv.atual, -5);
  A.vida(s, { id: ana().id, n: 1, tipo: 'cura' });
  assert.strictEqual(ana().pv.atual, -4);
  assert.deepStrictEqual(conds(ana()), ['inconsciente']);
  A.vida(s, { id: ana().id, n: 5, tipo: 'cura' });
  assert.strictEqual(ana().pv.atual, 1);
  assert.deepStrictEqual(conds(ana()), []);
});
t('#8/#9 inimigos em grupo por padrão; desempate com o menor bônus não divide o grupo (p. 231)', () => {
  assert.strictEqual(S.estadoInicial().combate.inimigosEmGrupo, true);
  const cs = [{ id: 'pj', tipo: 'jogador', iniciativa: 2 }, { id: 'g1', tipo: 'inimigo', iniciativa: 4 }, { id: 'g2', tipo: 'inimigo', iniciativa: 1 }];
  // grupo: d20 = 12 (0.55) + menor 1 = 13 ; jogador: d20 = 11 (0.5) + 2 = 13
  const inis = R.rolarIniciativa(cs, { inimigosEmGrupo: true }, seq([0.55, 0.9, 0.5, 0.1]));
  assert.strictEqual(inis.g1.total, 13); assert.strictEqual(inis.pj.total, 13);
  assert.strictEqual(inis.g1.mod, 1); assert.strictEqual(inis.g2.mod, 1); assert.strictEqual(inis.pj.mod, 2);
  const ord = R.ordenarIniciativa(cs, inis);
  assert.strictEqual(ord[0], 'pj');
  // individual grava o próprio bônus
  const ind = R.rolarIniciativa(cs, {}, seq([0.5]));
  assert.strictEqual(ind.g1.mod, 4);
});
t('#10 quem entra no meio do combate rola o próprio teste e age na rodada seguinte (p. 231)', () => {
  const s = mesa();
  A.addInimigo(s, { nome: 'Goblin', pv: 6, iniciativa: 2, qtd: 2 });
  A.iniciarCombate(s, {}, seq([0.05, 0.1, 0.15]));
  const grupo = s.combate.inis[s.combate.inimigos[0].id].total;
  A.addInimigo(s, { nome: 'Lobo', pv: 10, iniciativa: 5 }, seq([0.99, 0.3]));
  const lobo = s.combate.inimigos.find(i => i.nome === 'Lobo');
  assert.strictEqual(lobo.entrouNaRodada, 1);
  assert.strictEqual(s.combate.inis[lobo.id].total, 25);
  assert.notStrictEqual(s.combate.inis[lobo.id].total, grupo);
  const vistos = [S.daVez(s)];
  while (s.combate.rodada === 1) { A.proximoTurno(s, {}, seq([0.5])); if (s.combate.rodada === 1) vistos.push(S.daVez(s)); }
  assert.ok(!vistos.includes(lobo.id), 'não age na rodada em que entrou');
  s.combate.rerrolarCadaRodada = false;
  const r2 = [S.daVez(s)];
  for (let i = 0; i < 4 && s.combate.rodada === 2; i++) { A.proximoTurno(s, {}, seq([0.5])); if (s.combate.rodada === 2) r2.push(S.daVez(s)); }
  assert.ok(r2.includes(lobo.id), 'age na rodada seguinte');
});
t('#11 duração em rodadas termina no início do turno de quem estava na vez (p. 232)', () => {
  const s = mesa();
  s.combate.rerrolarCadaRodada = false;
  A.addInimigo(s, { nome: 'Orc', pv: 15, iniciativa: 0 });
  A.iniciarCombate(s, {}, seq([0.05, 0.5, 0.95, 0.5, 0.5, 0.5]));  // Orc (grupo, rola antes) 2+0, Ana 20+3, Bia 11+1
  const [ana, bia] = s.jogadores; const orc = s.combate.inimigos[0];
  assert.deepStrictEqual(s.combate.ordem, [ana.id, bia.id, orc.id]);
  A.proximoTurno(s, {}, Math.random);              // vez da Bia
  A.addCondicao(s, { id: orc.id, cond: 'lento', dur: { tipo: 'rodadas', rest: 1 } });
  assert.strictEqual(orc.condicoes[0].dur.marco, bia.id);
  A.proximoTurno(s, {}, Math.random);              // Orc
  A.proximoTurno(s, {}, Math.random);              // rodada 2, Ana: ainda lento
  assert.strictEqual(s.combate.rodada, 2);
  assert.deepStrictEqual(conds(s.combate.inimigos[0]), ['lento']);
  const r = A.proximoTurno(s, {}, Math.random);    // Bia: terminou
  assert.deepStrictEqual(s.combate.inimigos[0].condicoes, []);
  assert.deepStrictEqual(r.expiradas, ['Orc: Lento']);
});
t('#12 fome: falhas fatigado → exausto → inconsciente → morte; comer remove (p. 319)', () => {
  const s = mesa(); const id = s.jogadores[0].id; const ana = () => s.jogadores[0];
  assert.strictEqual(A.falhaFome(s, { id }), 'fatigado');
  assert.deepStrictEqual(conds(ana()), ['fatigado']);
  assert.strictEqual(A.falhaFome(s, { id }), 'exausto');
  assert.deepStrictEqual(conds(ana()), ['exausto']);
  assert.strictEqual(A.falhaFome(s, { id }), 'inconsciente');
  assert.deepStrictEqual(conds(ana()), ['inconsciente']);
  assert.ok(ana().condicoes.every(c => c.origem === 'fome' && c.dur.tipo === 'indef'));
  // cura não acorda quem desmaiou de fome
  A.vida(s, { id, n: 5, tipo: 'dano' }); A.vida(s, { id, n: 5, tipo: 'cura' });
  assert.deepStrictEqual(conds(ana()), ['inconsciente']);
  // condição de outra origem fica ao comer
  A.addCondicao(s, { id, cond: 'abalado', dur: { tipo: 'indef' } });
  A.recurso(s, { id, campo: 'racoes', delta: 1 });
  A.alimentar(s, { ids: [id] });
  assert.deepStrictEqual(conds(ana()), ['abalado']);
  assert.strictEqual(ana().falhasFome, 0);
  for (let i = 0; i < 4; i++) A.falhaFome(s, { id });
  assert.strictEqual(ana().morto, 'fome');
  assert.ok(R.estaMorto(ana()));
  // editar o personagem preserva falhas e morte
  A.salvarJogador(s, { id, nome: 'Ana', pvMax: 20 });
  assert.strictEqual(ana().falhasFome, 4); assert.strictEqual(ana().morto, 'fome');
});
t('#16 não gasta mais PM do que tem (p. 106)', () => {
  assert.deepStrictEqual(R.gastarPM({ atual: 3, max: 10 }, 5), { atual: 3, max: 10 });
  assert.deepStrictEqual(R.gastarPM({ atual: 3, max: 10 }, 3), { atual: 0, max: 10 });
  const s = mesa(); const id = s.jogadores[0].id;
  const r = A.mana(s, { id, n: 7, tipo: 'gastar' });
  assert.ok(r && /PM insuficiente/.test(r.aviso));
  assert.strictEqual(s.jogadores[0].pm.atual, 6);
  A.mana(s, { id, n: 6, tipo: 'gastar' });
  assert.strictEqual(s.jogadores[0].pm.atual, 0);
});
t('surpresa: Surpreendido até o fim da 1ª rodada e pulado nela (p. 231)', () => {
  const s = mesa();
  s.combate.rerrolarCadaRodada = false;
  A.addInimigo(s, { nome: 'Orc', pv: 15 });
  const [ana, bia] = s.jogadores;
  A.iniciarCombate(s, { surpreendidos: [ana.id] }, seq([0.05, 0.5, 0.95, 0.5, 0.5, 0.5]));  // Ana seria a 1ª
  assert.deepStrictEqual(conds(s.jogadores[0]), ['surpreendido']);
  assert.notStrictEqual(S.daVez(s), ana.id);
  const r1 = [S.daVez(s)];
  while (s.combate.rodada === 1) { A.proximoTurno(s, {}, Math.random); if (s.combate.rodada === 1) r1.push(S.daVez(s)); }
  assert.ok(!r1.includes(ana.id));
  assert.ok(r1.includes(bia.id));
  assert.strictEqual(S.daVez(s), ana.id, 'age na 2ª rodada');
  assert.deepStrictEqual(conds(s.jogadores[0]), []);
});
t('sangramento: Con CD 15 no turno; passou remove, falhou perde 1d6 (p. 237)', () => {
  const s = mesa(); const id = s.jogadores[0].id;
  A.vida(s, { id, n: 21, tipo: 'dano' });
  const r = A.sangramento(s, { id, passou: false }, seq([0.5]));   // d6 = 4
  assert.strictEqual(r.dano, 4);
  assert.strictEqual(s.jogadores[0].pv.atual, -5);
  A.sangramento(s, { id, passou: true });
  assert.deepStrictEqual(conds(s.jogadores[0]), ['inconsciente']);
});
t('regra da casa: rerrolar a cada rodada não sobrescreve valores digitados', () => {
  const s = mesa();
  A.iniciarCombate(s, {}, seq([0.5]));
  const ana = s.jogadores[0];
  A.setIniciativa(s, { id: ana.id, total: 30 });
  A.novaRodada(s, {}, seq([0.1]));
  assert.strictEqual(s.combate.inis[ana.id].total, 30);
  assert.strictEqual(s.combate.ordem[0], ana.id);
});
t('estado salvo antigo: campos faltando recebem padrões', () => {
  const velho = { v: 1, nome: 'Velha', jogadores: [{ id: 'x', tipo: 'jogador', nome: 'X', nivel: 1, pv: { atual: 5, max: 5 }, pm: { atual: 1, max: 1 }, defesa: 10, iniciativa: 0, condicoes: [] }],
    combate: { ativo: true, rodada: 2, turno: 0, ordem: ['x'], inis: { x: { d20: 5, total: 5, desempate: 0.3 } }, inimigos: [], rerrolarCadaRodada: false, inimigosEmGrupo: false } };
  const s = S.normalizar(velho);
  assert.strictEqual(s.jogadores[0].falhasFome, 0);
  assert.strictEqual(s.jogadores[0].racoes, 0);
  assert.deepStrictEqual(s.combate.surpreendidos, []);
  assert.strictEqual(s.combate.inimigosEmGrupo, false, 'valor salvo é respeitado');
  assert.strictEqual(s.combate.mostrarPVInimigos, false);
  assert.ok(Array.isArray(s.log));
  A.proximoTurno(s, {}, Math.random);
  assert.strictEqual(s.combate.rodada, 3);
  assert.strictEqual(R.ordenarIniciativa(s.jogadores, s.combate.inis)[0], 'x');
});
t('estado salvo antigo ganha ui.passos (Primeiros passos) sem perder dados', () => {
  const s = S.normalizar({ nome: 'Velha', jogadores: [] });
  assert.deepStrictEqual(s.ui.passos, { tela: false, combate: false, dispensado: false });
  const s2 = S.normalizar({ ui: { passos: { tela: true } } });
  assert.strictEqual(s2.ui.passos.tela, true);
  assert.strictEqual(s2.ui.passos.dispensado, false);
});
t('iniciar combate e adicionar inimigo marcam o passo "Prepare um combate"', () => {
  const s = mesa();
  A.addInimigo(s, { nome: 'Goblin', pv: 5 }, seq([0.5]));
  assert.strictEqual(s.ui.passos.combate, true);
});
t('link público: estado sem inimigos ocultos, sem histórico; a vez continua certa', () => {
  const s = mesa();
  A.addInimigo(s, { nome: 'Goblin', pv: 5 }, seq([0.5]));
  A.addInimigo(s, { nome: 'Assassino', pv: 9, visivel: false }, seq([0.5]));
  A.iniciarCombate(s, {}, seq([0.9, 0.1, 0.5, 0.3]));
  const oculto = s.combate.inimigos.find(i => i.nome === 'Assassino');
  const p = S.estadoPublico(s);
  assert.ok(!p.combate.inimigos.some(i => i.id === oculto.id));
  assert.ok(!(oculto.id in p.combate.inis));
  assert.deepStrictEqual(p.combate.ocultos, [oculto.id]);
  assert.strictEqual(p.log, undefined); assert.strictEqual(p.recentes, undefined);
  assert.deepStrictEqual(p.combate.ordem, s.combate.ordem, 'ordem mantém os ids (a tela mostra ??? na vez do oculto)');
  assert.strictEqual(s.combate.inimigos.length, 2, 'original intacto');
});
t('código do link: 14 caracteres sem ambíguos', () => {
  for (let i = 0; i < 50; i++) {
    const c = S.Sync.gerarCodigo();
    assert.strictEqual(c.length, 14);
    assert.ok(/^[a-hjkmnp-z2-9]+$/.test(c), c);
  }
});
console.log(ok + ' testes ok');
