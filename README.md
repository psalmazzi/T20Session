# T20Session

Gestão de sessão de **Tormenta20** para mesa presencial, em duas telas:

- **Tela do mestre** (`index.html`): grupo entre combates (PV, PM, Defesa, Iniciativa, tibares, rações, descanso e alimentação) e combate (inimigos, iniciativa, turnos, dano/cura, PM e condições).
- **Tela dos jogadores** (`display.html`): resumo visual sem botões para um segundo monitor ou TV. Atualiza sozinha.

Sem grid nem mapa: é para mesa física. Login e banco ficam no [Supabase](https://supabase.com) (plano gratuito); o site é publicado pelo GitHub Pages.

## Colocar no ar (uma vez, ~10 min)

1. **Criar o projeto no Supabase**: supabase.com → *New project* (região São Paulo). Anote a senha do banco.
2. **Criar a tabela**: no projeto, *SQL Editor* → *New query* → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → *Run*.
3. **Configurar o app**: em *Project Settings → API*, copie a *Project URL* e a chave *anon public* para [`js/config.js`](js/config.js) e faça commit. A chave anon é pública por design; os dados ficam protegidos pelas regras RLS do passo 2.
4. **Login por e-mail**: em *Authentication → URL Configuration*, ponha o endereço do site (`https://psalmazzi.github.io/T20Session/`) em *Site URL*. Se não quiser confirmar e-mail ao criar conta, desligue *Authentication → Providers → Email → Confirm email*.
5. **Ligar o GitHub Pages**: no repositório, *Settings → Pages → Source: GitHub Actions*. Cada push na `main` roda os testes e publica.

Sem o passo 3, o app funciona em **modo local**: sem login, com os dados só naquele navegador (bom para testar).

## Uso na mesa

- Abra o site no notebook e clique no ícone de **monitor** no cabeçalho (Tela dos jogadores): abre uma janela; arraste para o segundo monitor/TV e dê **duplo clique** para tela cheia. No mesmo computador a atualização é instantânea.
- Em outro aparelho (TV com navegador, tablet), abra `…/display.html` e entre uma vez com a mesma conta; ele segue a última mesa aberta.
- Atalhos do mestre: **→** próximo turno, **Ctrl+Z / Ctrl+Y** desfazer/refazer, **Enter** no campo de valor aplica dano (ou gasto de PM).
- **Histórico** (≡ no cabeçalho): cada ação fica registrada com a hora, a mais recente primeiro; um ponto dourado avisa que há novidade. **↶** desfaz. Avisos (sem ração, falha de fome, sangramento) aparecem em laranja. Erros, como PM insuficiente, aparecem num aviso no topo.
- **⋯** (menu): opções do combate, encerrar combate, tela dos jogadores, renomear mesa e trocar de mesa.
- **Celular**: toque num personagem ou combatente para abrir a folha com teclado (Dano/Cura, Gastar/Recuperar PM, tibares e rações), como no MobileT20. A barra de baixo tem Descanso/Alimentar/Combate ou ‹ Próximo turno ›.

## Regras usadas (Livro Base JdA, páginas impressas)

| Tema | Como o app faz | Página |
|---|---|---|
| PV e PM | Cura e recuperação não passam do máximo; **não dá para gastar mais PM do que se tem** (o app recusa e avisa) | 106 |
| Cair (0 PV ou menos) | Jogador fica **Inconsciente + Sangrando** (indefinidos, não saem no fim da cena). Se já caído perde mais PV, volta a sangrar | 106, 237 |
| Estabilizar e acordar | Qualquer cura de 1+ PV tira Sangrando; com 1 PV ou mais recobra a consciência (cura, descanso) | 237 |
| Sangrando | Na vez de quem sangra, o painel de turno lembra **Con CD 15**: Passou remove; Falhou perde 1d6 PV | 237 |
| Morte | PV ≤ –10 ou ≤ –metade do PV máximo, o que for mais baixo | 237 |
| Descanso | Individual: cada personagem entra ou não, com a própria condição (Ruim ½ nível, Normal 1×, Confortável 2×, Luxuosa 3×). Poderes marcados na ficha ajustam: Estoico sobe uma categoria, Descanso Natural faz relento contar como confortável, Vida Rústica garante o nível ao relento (p. 94, 133); imunes ignoram a Área de Tormenta (p. 319) |
| Descanso (base) | Ruim ½ nível, Normal 1×, Confortável 2×, Luxuosa 3× (PV e PM); sem dormir não recupera | 106, 319 |
| Cuidados prolongados | +1 PV por nível no descanso (marcar por personagem) | 117 |
| Sopa de peixe / Área de Tormenta | +1 PM por nível / recuperação à metade, depois dos outros efeitos | 162, 319 |
| Fome e sede | 1 ração por dia; o 1º dia sem comer não tem efeito; depois Fortitude CD 15 +1 por teste anterior. Botão **Falhou na Fortitude** no card: 1ª falha Fatigado, 2ª Exausto, 3ª Inconsciente, 4ª morte (condições marcadas "fome"; só comer remove) | 162, 319 |
| Iniciativa | d20 + bônus. Por padrão os inimigos fazem **um único teste** com o menor bônus; no empate vale o maior modificador (no grupo, o menor bônus usado), depois sorteio | 231 |
| Surpresa | Ao iniciar o combate, marque quem está surpreendido: fica Surpreendido até o fim da 1ª rodada e não age nela | 231 |
| Entrar no meio do combate | Quem chega depois faz o próprio teste de Iniciativa e só age na rodada seguinte | 231 |
| Duração em rodadas | Termina no início do turno de quem estava na vez quando a condição foi aplicada | 232 |
| Condições | 35 condições do livro; repetir uma que agrava troca pela mais grave (com a maior duração); terminam no fim da cena (encerrar combate) salvo "indefinida" | 394–395 |

**Regra da casa:** o livro rola a iniciativa **uma vez** por combate e a ordem se mantém (p. 231). O app vem com **"Rolar iniciativa a cada rodada (regra da casa)"** ligado, a pedido do mestre; desligue no menu **⋯** do combate para seguir o livro. O total pode ser digitado quando o jogador rola o próprio dado, e a nova rolagem de cada rodada não sobrescreve valores digitados.

Mesas salvas por versões anteriores continuam abrindo: campos novos recebem o valor padrão.

## Estrutura

```
index.html        tela do mestre
display.html      tela dos jogadores
css/              estilos (tema escuro do MobileT20, fonte do sistema)
js/config.js      URL e chave do Supabase
js/regras.js      regras puras de T20 (testadas)
js/store.js       estado, ações, desfazer, persistência e sincronização
js/gm.js          interface do mestre
js/display.js     interface dos jogadores
supabase/schema.sql
tests/regras.test.js   node tests/regras.test.js
tests/e2e.py           python3 tests/e2e.py [pasta dos prints]  (Playwright + Chrome)
```
