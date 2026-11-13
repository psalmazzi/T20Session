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

- Abra o site no notebook e clique em **📺 Tela dos jogadores**: abre uma janela; arraste para o segundo monitor/TV e dê **duplo clique** para tela cheia. No mesmo computador a atualização é instantânea.
- Em outro aparelho (TV com navegador, tablet), abra `…/display.html` e entre uma vez com a mesma conta; ele segue a última mesa aberta.
- Atalhos do mestre: **→** próximo turno, **Ctrl+Z / Ctrl+Y** desfazer/refazer, **Enter** no campo de valor aplica dano (ou gasto de PM).

## Regras usadas (Livro Base JdA, páginas impressas)

| Tema | Como o app faz | Página |
|---|---|---|
| Descanso | Ruim ½ nível, Normal 1×, Confortável 2×, Luxuosa 3× (PV e PM); nunca passa do máximo; quem volta a ≥1 PV acorda | 106, 237 |
| Cuidados prolongados | +1 PV por nível no descanso (marcar por personagem) | 117 |
| Sopa de peixe / Área de Tormenta | +1 PM por nível / recuperação à metade | 162, 319 |
| Fome e sede | 1 ração por dia; o 1º dia sem comer não tem efeito; depois Fortitude CD 15 +1 por teste anterior | 162, 319 |
| Iniciativa | d20 + bônus; empate pelo maior bônus; opção de teste único para os inimigos (menor bônus) | 230 |
| Morte | PV ≤ –10 ou ≤ –metade do PV máximo, o que for mais baixo | 237 |
| Condições | 35 condições do livro; repetir uma que agrava troca pela mais grave; terminam no fim da cena (encerrar combate) salvo "indefinida" | 394–395 |

Decisão da casa: o livro rola a iniciativa **uma vez** por combate. O app vem com **"Rolar iniciativa a cada rodada"** ligado (pedido do mestre); desligue no painel de combate para seguir o livro. O total também pode ser digitado quando o jogador rola o próprio dado.

## Estrutura

```
index.html        tela do mestre
display.html      tela dos jogadores
css/              estilos (tema escuro)
js/config.js      URL e chave do Supabase
js/regras.js      regras puras de T20 (testadas)
js/store.js       estado, ações, desfazer, persistência e sincronização
js/gm.js          interface do mestre
js/display.js     interface dos jogadores
supabase/schema.sql
tests/regras.test.js   node tests/regras.test.js
```
