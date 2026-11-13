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
t('iniciativa: inimigos em grupo usam o menor bônus; empate pelo maior modificador (p. 230)', () => {
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
t('store: descanso + comer avança o dia e consome ração', () => {
  const s = S.estadoInicial('t');
  S.ACOES.salvarJogador(s, { nome: 'Ana', nivel: 4, pvMax: 30, pvAtual: 10, pmMax: 12, pmAtual: 0, racoes: 2 });
  S.ACOES.descanso(s, { tipo: 'normal', comer: true, cuidados: { [s.jogadores[0].id]: true } });
  assert.strictEqual(s.jogadores[0].pv.atual, 18);
  assert.strictEqual(s.jogadores[0].pm.atual, 4);
  assert.strictEqual(s.jogadores[0].racoes, 1);
  assert.strictEqual(s.dia, 2);
});
console.log(ok + ' testes ok');
