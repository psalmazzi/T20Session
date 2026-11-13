# T20Session — UX para novatos (v1) · complementa `ux-sessao.md`
Base: prints em `/home/claude/shots/ux-novato/` (01–12, 1366 e 390) e `shots/v4`. Novato = mestre na 1ª abertura, talvez novo em T20.
**Regra-mestra: "modo Dicas".** Toda explicação nova (legendas, linha de cabeçalho, dicas de 1ª vez) só aparece com `body.dicas`. Liga sozinho na 1ª abertura (`t20s.dicas` ausente); desliga em `⋯ > Mostrar dicas` (checkbox). Quem já sabe usar vê a tela atual, sem mudança. Dicas = texto `--text-3` .8rem, sem caixa, sem ícone, sem pop-up. Página do livro sempre no fim: `(p. 231)`.

## Itens priorizados
| # | P | Onde | Por que confunde | Correção (texto exato) |
|---|---|---|---|---|
| 1 | P1 | Modal **Iniciar combate** (`modalIniciar`) | Checkbox solto + nome: marcar = surpreso ou = pronto? Nada diz. | Trocar por segmentado por linha `Pronto │ Surpreso` (padrão Pronto), agrupado **Jogadores** / **Inimigos**, título da lista "Quem foi pego de surpresa?", atalhos e resumo que muda; ver wireframe A. |
| 2 | P1 | Mesa vazia (Grupo) | "Adicione os personagens…" não conta o resto do fluxo (tela dos jogadores, combate). | Card **Primeiros passos** com 3 itens que se marcam sozinhos; ver wireframe B. Some quando os 3 estão feitos ou com "Dispensar". |
| 3 | P1 | Tela **Mesas** (1ª abertura) | "Mesa" e "Modo local" não se explicam; placeholder genérico. | Sub: "Uma mesa guarda o grupo, os combates e o histórico de uma campanha." · placeholder "Nome da campanha (ex.: Coração de Rubi)" · nota local: "Modo local: os dados ficam só neste navegador. Não limpe os dados do site." |
| 4 | P1 | Cabeçalho: ícone monitor | Só ícone; novato não sabe que existe tela para os jogadores. | Desktop ≥1100 px: `▭ Tela dos jogadores` (ícone+texto). Title: "Abre uma janela para arrastar ao 2º monitor ou TV. Duplo clique nela = tela cheia." |
| 5 | P1 | Cabeçalho: bolinha `●` | Cinza sem rótulo = parece botão quebrado. | Bolinha + texto .8rem --text-3: `Local` / `Salvo` / `Erro ao salvar` (este em --danger). Title mantém o detalhe. |
| 6 | P1 | `− [1] +` de PV/PM (desktop) | Não diz que digita o valor; "1" parece o valor atual; − de PM azul parece outra coisa. | Com dicas: linha de cabeçalho fina sobre a grade/lista (wireframe C) "PV · − dano · valor · + cura" / "PM · − gasto · + recupera". Placeholder "1" → vazio com title "Digite o valor; vazio = 1. Enter aplica dano." |
| 7 | P1 | Celular: card/linha | Nada indica que tocar no card abre Dano/Cura/PM. | Com dicas, abaixo do 1º card: "Toque num personagem para dano, cura e PM." Some após abrir o teclado 1 vez (`t20s.dica.teclado`). |
| 8 | P1 | Combate antes de iniciar | "Iniciar combate" ativo sem inimigos; frase longa trunca em 1366. | Sem inimigos: linha-vazia na lista "Nenhum inimigo ainda. [+ Inimigo]" e Iniciar em `.btn` (não pri). Painel: "Adicione os inimigos e clique em Iniciar. A iniciativa de todos é rolada sozinha." |
| 9 | P1 | Menu `⋯` | Sem ajuda nem glossário. | Nova seção **Ajuda**: `[? Guia rápido]` (folha lateral, wireframe D) + checkbox "Mostrar dicas". |
| 10 | P2 | Coluna de iniciativa | Total editável não parece campo; "d20 15" é críptico. | Sub do campo: "d20 15 + 0"; title: "Total da Iniciativa. Toque para digitar o que o jogador rolou (p. 231)." Com dicas, cabeçalho "Ini" (wireframe C). |
| 11 | P2 | Nome do combatente | Clicar no nome passa a vez (surpresa: novato clica para ver/editar). | Nome deixa de ser botão; com hover na linha aparece `.btn ghost peq` "Dar a vez" à direita do nome. Celular inalterado. |
| 12 | P2 | Olho do inimigo | Ícone ambíguo (ver? esconder?). | Com dicas: texto ao lado "Visível"/"Oculto". Title: "Visível na tela dos jogadores. Oculto: some de lá (emboscada)." |
| 13 | P2 | Menu `⋯` > rerrolar a cada rodada | Vem **ligada**; novato em T20 aprende a regra da casa como se fosse do livro. | Manter o padrão do dono, mas painel do turno mostra "Rodada 2 · ordem nova a cada rodada (regra da casa)" com dicas; no Guia, explicar a regra do livro. |
| 14 | P2 | Modal Personagem | 12 campos soltos, ordem de planilha; poderes de descanso assustam. | Grupos com título .8rem: **Da ficha** (Nível, Defesa, Iniciativa, PV máx, PM máx) · **Agora** (PV atual, PM atual; placeholder "= máximo") · **Mochila** (T$, Rações, Dias sem comer). Poderes em `<details>` "Poderes que mudam o descanso (opcional)". Topo: "Copie os números da ficha do jogador." |
| 15 | P2 | Modal Condição | Ordem duração→condição não é dita; novato toca a condição antes. | Rótulos "1. Quanto dura" e "2. Toque na condição". Rodapé: "Dúvida sobre uma condição? Passe o mouse para ver o efeito (p. 394)." |
| 16 | P2 | Modal Descanso | Coluna "Condição" e checkboxes Cuidados/Sopa sem contexto visível. | Linha topo: "Escolha onde cada um dormiu; a prévia mostra o PV e PM recuperados (p. 106)." Coluna → "Onde dormiu". Sob Cuidados/Sopa, nota fixa: "Cuidados: Cura CD 15 · Sopa: +PM". |
| 17 | P2 | Histórico | "↶ no topo desfaz" lê como instrução de outro lugar; vazio diz "Nada ainda." | Nota: "↶ desfaz a última ação". Vazio: "Nada ainda. Cada dano, cura, turno e descanso aparece aqui e pode ser desfeito com ↶." |
| 18 | P2 | Tela dos jogadores esperando | "Aguardando a tela do mestre…" não diz o que fazer. | Ver wireframe E. |
| 19 | P3 | Celular: botão `+` no combate | `+` sozinho = inimigo? personagem? | Texto "+ Inimigo" (cabe: 56 + flex + 112 px). |
| 20 | P3 | Grupo: "Limpar condições" / "Alimentar" | Novato não sabe quando usar. | Title: "Fim da cena: remove condições de cena e de rodadas (p. 394)" / "Cada um come 1 ração; quem não tem fica com fome (p. 319)". |

## A · Modal Iniciar combate (item 1, P1)
```
┌ Iniciar combate ─────────────────────────────────────────┐
│ Quem foi pego de surpresa?                                │
│ Surpreso não age na 1ª rodada (p. 231).                   │ nota --text-3
│ [Ninguém surpreso] [Inimigos surpresos] [Jogadores surpresos]│ .btn peq; o ativo = --surface-3
│ JOGADORES                                                 │ .tit
│ ▌Kael      [ Pronto │ Surpreso ]                          │ seg 2 opções, 44 px
│ INIMIGOS                                                  │
│ ▌Goblin 1  [ Pronto │▓Surpreso▓]  não age na 1ª rodada    │ texto aparece só se Surpreso (--warn)
│ ▌Goblin 2  [ Pronto │▓Surpreso▓]  não age na 1ª rodada    │
│ Ninguém surpreso: todos agem na 1ª rodada.                │ resumo vivo; ou "2 surpresos: Goblin 1, Goblin 2."
│                          [Cancelar] [⚔ Iniciar combate]   │
└───────────────────────────────────────────────────────────┘
```
Padrão: todos Pronto ("Ninguém surpreso" ativo). Seg "Surpreso" ativo: fundo `--surface-3`, texto `--warn`. Atalho = 1 toque; continua 2 toques no caso comum (Iniciar → Iniciar). Celular: mesma folha, seg em largura total abaixo do nome.

## B · Mesa vazia com Primeiros passos (item 2)
```
│ Mesa Teste  [Grupo|Combate]      ↶ ↷ ≡ Histórico  ▭ Tela dos jogadores  ● Local  ⋯ │
│ [☾ Descanso] [◔ Alimentar] [Limpar condições]          [+ Personagem] [⚔ Combate] │
│ ┌ Primeiros passos · 0 de 3 ─────────────────────────────────────── Dispensar ┐ │
│ │ ○ 1  Adicione os personagens do grupo           [+ Personagem]  (btn pri)   │ │
│ │      Copie PV, PM e Defesa da ficha de cada jogador.                        │ │
│ │ ○ 2  Mostre a mesa aos jogadores (opcional)     [▭ Abrir tela dos jogadores]│ │
│ │      Abre uma janela: arraste para a TV ou 2º monitor e dê duplo clique.    │ │
│ │ ○ 3  Prepare um combate                         [⚔ Ir para Combate]         │ │
│ │      Adicione inimigos e clique em Iniciar. A iniciativa é rolada sozinha.  │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
```
Feito = `✓` --ok + texto --text-3 riscado. Passo 1 feito → card encolhe para 1 linha "Primeiros passos · 1 de 3 · Próximo: Mostre a mesa aos jogadores ›" acima da grade. Estado em `mesa.ui.passos` (por mesa); "Dispensar" esconde só o card (dicas continuam). Celular: mesmo card em 1 coluna, botões largura total.

## C · Linha de legenda (itens 6, 10; só com dicas)
```
Combate: │ Ini   Nome          PV  − dano · valor · + cura      PM  − gasto · + recupera   Condições │ 24 px, .75rem --text-3
Grupo:   legenda única acima da grade: "− dano · valor · + cura   (vazio = 1 · Enter = dano)"
```
## D · Guia rápido (folha lateral 360 px / celular 92 dvh; ⋯ > Ajuda)
```
Guia rápido                                                    ×
Como usar  1 Grupo: PV, PM, T$, rações, descanso  2 Combate: inimigos → Iniciar → Próximo turno (→)
           3 Errou? ↶ (Ctrl+Z) desfaz tudo  4 Histórico (≡) lista o que aconteceu
Termos     PV  Pontos de Vida. 0 ou menos = caído; morre em −metade do máximo ou −10 (p. 106)
           PM  Pontos de Mana: pagam magias e habilidades
           DEF Defesa: o ataque acerta se o resultado for ≥ Defesa
           INI Iniciativa: d20 + bônus decide a ordem (p. 231)
           Rodada / turno · Cena (condições acabam no fim da cena, p. 394) · T$ tibares · Rações
Condições  lista das 12 mais comuns: nome + efeito curto (R.CONDICOES.curto)
Tela dos jogadores  mostra grupo ou ordem de combate; inimigos ocultos (olho) não aparecem; PV de
           inimigo vira Ileso/Ferido/Muito ferido/Quase caindo, salvo "Mostrar PV" no ⋯.
```
## E · Tela dos jogadores esperando (item 18)
```
                 T20Session · Tela dos jogadores
          Esta tela mostra aos jogadores o grupo e a ordem do combate.
      Na tela do mestre, abra a mesa e clique em ▭ Tela dos jogadores.
          Arraste esta janela para a TV · duplo clique = tela cheia
```
Sem mesa aberta há mais de 5 s: troca "Aguardando a tela do mestre…" por este bloco (texto 1.1em --text-2, centro).
