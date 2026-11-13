# Regras da sessão — validação contra o Livro Base JdA

Páginas impressas (PDF = impressa + 6). Revisados: `js/regras.js` e `ACOES` em `js/store.js`. Testes atuais: 10/10 ok.

## 1. Confere / Corrigir

| # | Item | Situação | Pág. | Mudança sugerida |
|---|------|----------|------|------------------|
| 1 | Lista das 35 condições e cadeias (abalado→apavorado, fraco→debilitado→inconsciente, frustrado→esmorecido, fatigado→exausto→inconsciente) | Confere | 394–395 | Ajuste de texto: `caido.curto` = '–5 ataque c.a.c.; desloc. 1,5m; Defesa –5 c.a.c., +5 à distância'; `sangrando.curto` = 'início do turno: Con CD 15; falha –1d6 PV, passa remove' |
| 2 | Duração ao agravar | Corrigir (leve) | 394 | `aplicarCondicao`: a nova condição usa `maiorDuracao(existente.dur, dur \|\| {tipo:'cena'})` em vez de só `existente.dur` |
| 3 | Condições terminam no fim da cena | Confere | 394 | `fimDeCena` mantém só `indef`. Ver #6 e #12: inconsciente/sangrando/fome precisam ser `indef` |
| 4 | Morte em –10 ou –metade dos PV totais (o mais baixo), metade p/ baixo | Confere | 237, 226 | — |
| 5 | Volta a ≥1 PV por habilidade, magia ou descanso → recobra a consciência | Confere | 237 | — |
| 6 | Chegar a ≤0 PV → cai inconsciente **e** sangrando | Corrigir | 106, 237 | `ACOES.vida`: se `c.tipo==='jogador' && antes>0 && c.pv.atual<=0`, aplicar `inconsciente` e `sangrando` com `dur:{tipo:'indef'}`. Se já ≤0 e sofre dano, reaplicar `sangrando` ("exceto se perder mais PV") |
| 7 | Estabilizar: "qualquer efeito que cure pelo menos 1 PV" para o sangramento | Corrigir | 237 | `ACOES.vida` (cura): se `antes<=0`, remover `sangrando` sempre; remover `inconsciente` só se `c.pv.atual>=1` (hoje remove os dois só com ≥1) |
| 8 | Iniciativa: inimigos fazem **um único teste** com o menor bônus | Corrigir (padrão) | 231 | `estadoInicial().combate.inimigosEmGrupo = true` (livro manda; hoje é `false`) |
| 9 | Desempate pelo maior modificador, depois novo teste | Corrigir | 231 | No grupo, o modificador de desempate é o menor bônus usado, senão o grupo se divide em volta de um jogador. `rolarIniciativa`: gravar `mod` em cada resultado (grupo: `menor`; individual: `c.iniciativa\|0`); `ordenarIniciativa`: comparar `B.mod - A.mod` em vez de `b.iniciativa - a.iniciativa`. Desempate final por `rng()` equivale ao novo teste: confere |
| 10 | Entrar na batalha depois do início: faz teste e age **na rodada seguinte** | Corrigir | 231 | `ACOES.addInimigo` (combate ativo): rolar teste próprio (`R.rolarIniciativa(novos, {}, rng)` sem copiar o do grupo) e marcar `n.entrouNaRodada = s.combate.rodada`; `primeiroValido` pula quem tem `entrouNaRodada === s.combate.rodada` |
| 11 | Durações em rodadas terminam "imediatamente antes do mesmo resultado de Iniciativa em que se iniciaram" | Corrigir (precisão) | 232 | `ACOES.addCondicao`: guardar `dur.marco = daVez(s)`; descontar `rest` em `proximoTurno` quando a vez chega ao `marco` (não em `novaRodada`). Sem combatente da vez, manter o desconto em `novaRodada` |
| 12 | Fome e sede: 1º dia livre; Fortitude CD 15 +1 por teste anterior; falhas: fatigado→exausto→inconsciente→morte; só comida cura | Confere a CD (`cdFome`); Corrigir efeitos | 319 | Novo `R.falhaFome(j)`: `j.falhasFome+1` → 1 `fatigado`, 2 `exausto`, 3 `inconsciente`, 4 'morto'; condições com `dur:{tipo:'indef'}` e `origem:'fome'`. `R.alimentar` (comeu): zerar `falhasFome` e remover condições com `origem==='fome'` |
| 13 | Ração de viagem: alimenta 1 pessoa por 1 dia; T$ 0,5 | Confere | 162, 157 | (opcional) botão "comprar ração" debita T$ 0,5 |
| 14 | Sopa de Peixe | Confere: +1 **PM**/nível | 162 | O trecho "+1 **PV** por nível" é do **Prato do Aventureiro** (T$ 1). Ver item 3 da seção 3 |
| 15 | Área de Tormenta: recuperação à metade **após** outros efeitos | Confere | 319 | — |
| 16 | Gasto de PM | Corrigir | 106 | Livro: "não pode gastar mais PM do que tem" (0 ou menos não dá penalidade). `R.gastarPM`: se `n > rec.atual`, devolver `rec` inalterado; `ACOES.mana` devolve aviso 'PM insuficiente' em vez de zerar |
| 17 | Cura/recuperação não passa do máximo | Confere | 106 | — |
| 18 | Noite sem dormir: não recupera PV/PM | Confere | 319 | — |
| 19 | Citação de página da iniciativa | Corrigir | 231 | Comentários de `rolarIniciativa`/`ordenarIniciativa` e nome do teste: "p. 230" → "p. 231" |

## 2. "Rolar iniciativa a cada rodada"

O livro diz o contrário (p. 231): "Não é preciso fazer novos testes de Iniciativa a cada rodada; a ordem se mantém durante todo o combate" (Passo 4: "na mesma ordem"). Pode manter ligado por padrão, já que é pedido do mestre, mas deixe claro que é regra da casa:

- Interruptor: **"Rolar iniciativa a cada rodada (regra da casa)"**
- Ajuda: "Pelo livro, rola-se só no início do combate e a ordem se mantém (p. 231)."
- Com a opção ligada, `novaRodada` não deve sobrescrever valores digitados (`inis[id].manual`) sem perguntar.

## 3. O que falta, útil e simples (sem grid), por prioridade

1. **Surpresa** (p. 231): em `iniciarCombate`, receber `p.surpreendidos` (ids) e aplicar `surpreendido` com `dur:{tipo:'rodadas',rest:1}`. A vez deles é pulada na 1ª rodada (desprevenidos, não agem).
2. **Lembrete de Sangrando** (p. 237): na vez de quem está `sangrando`, mostrar "Con CD 15" com os botões [Passou → remove] e [Falhou → –1d6 PV]. A morte é checada pelo limiar.
3. **Pratos especiais no descanso** (p. 162): trocar `op.sopa` por `op.prato: 'sopa'|'aventureiro'|null` (Prato do Aventureiro = +1 PV/nível; Sopa = +1 PM/nível). Só um bônus de alimentação por dia, e cada prato debita T$ 1 por pessoa (p. 157).
4. **PV/PM temporários** (p. 106): campo `temp` em `pv`/`pm`. O dano gasta o temporário primeiro, pode passar do máximo e some no fim do dia (`ACOES.descanso`). Cobre Macarrão de Yuvalin (+5 PV) e Gorad Quente (+2 PM) (p. 162).
5. **Atrasar** (p. 235): botão "Atrasar" que move o combatente para depois de outro na ordem pelo resto do combate (limite: –10 menos o bônus de Iniciativa).
