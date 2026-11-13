# T20Session — UX/UI v2 (tema MobileT20)  ·  fonte: psalmazzi/mobilet20/web/index.html
Regras: `system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif` em tudo (remover Cinzel/--serif; títulos = peso 700). **Zero `linear-gradient`, glow, `box-shadow` colorido, `transform:scale`.** Números com `font-variant-numeric:tabular-nums`. Margem lateral única **20 px**; gap entre cards 12 px; padding de card 16 px.
## 1. Tokens (copiar exatos para :root de style.css e display.css)
`--bg:#0B0D10 --surface:#13161B --surface-2:#1B1F25 --surface-3:#232830 --border:#20252C --border-strong:#3A424D`  
`--text:#E8EAED --text-2:#9AA3AF --text-3:#7C8693 --hdr:#171C24 --hdr-borda:#262D38 --hdr-ctl:#222937`
`--pv:#FF6B70 --pv-temp:#FFA94D --pm:#5AA2FF --ok:#4ADE80 --warn:#FFB86B --danger:#FF6B70 --danger-bg:#2A0F12 --crit:#FFD60A --accent:#E0B84F --accent-ink:#1A1300`
`--btn-dano:#A3262D --btn-cura:#1E6E47 --btn-pm:#2457C5 --r:14px (cards) · 12px (botões/campos) · 9px (seg interno) · 999px (chips) --ease:cubic-bezier(.2,.8,.2,1)`
| Degradê atual | Substituto sólido |
|---|---|
| barras `.pv`/`.pm` (style.css 74-75, display.css 25-27) | `var(--pv)` / `var(--pm)`; `.vago` → `var(--text-3)` |
| `.d-vez` (faixa dourada) | `background:var(--surface-2)` + `border-left:4px solid var(--accent)`; sem borda externa |
| `.linha-ini.vez`/`.d-linha.vez` glow | `box-shadow:inset 0 0 0 2px var(--accent)` (só inset, sem blur) |
| `.opcao.ativa` | `background:var(--surface-3)`; sem borda |
- Trilho de barra: `--surface-3`, altura 6 px, raio 3 px; o número `22 / 30` fica FORA da barra, à direita (texto `--text`, peso 700). PV ≤ 25 %: número em `--danger`.
## 2. Ícones (todos monocromáticos; nunca emoji colorido; `font-variant-emoji:text` + seletor de texto U+FE0E após o glifo)
| Atual | Novo | Cor | Onde |
|---|---|---|---|
| 💰 tibares | texto `T$` (sem ícone) | --text-3 | card, display |
| 🍞 rações | `◔` (U+25D4) | --text-3 | card, Alimentar |
| 🌙 Descanso | `☾` (U+263E) | --text-2 | botão |
| ⚔ Iniciar/Combate | `⚔` (U+2694 + U+FE0E) | --text-2; aba ativa --accent | aba, botão |
| 🎲 Rolar iniciativa | SVG quadrado traço 1.75, 2 pontos | currentColor | botão |
| 📺 Tela dos jogadores | SVG monitor traço 1.75 | currentColor | cabeçalho |
| 👁 visível / 🚫 oculto | SVG olho / olho cortado, traço 1.75 | --text-2 / --text-3 | linha inimigo |
| ✎ editar | `✎` (U+270E) | --text-3 | cards |
| ✕/× remover | `×` (U+00D7) | --text-3 (hover --danger) | chips, inimigo |
| ▶ ◀ turno | `›` `‹` (U+203A/2039) maiores, peso 600 | --accent-ink no pri | Próximo/Anterior |
| ↶ ↷ / Histórico | `↶` `↷` (U+21B6/21B7) / `≡` (U+2261)+texto | --text-2 | cabeçalho |
| 🩸 Caído | sem ícone; faixa `--danger-bg` texto `#FFB4B4` | — | card |
- SVGs: 20×20, `fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round`, inline em js (constante `IC`). Ícone 1.1 rem; botão-ícone 44×44, fundo --surface-2, raio 12.
## 3. Tela do mestre
Cabeçalho (1 linha, 52 px, fundo --hdr, borda inferior --hdr-borda, sticky): `Nome da mesa` 600 · `Dia 2 · R1` --text-2 | seg Grupo/Combate (fundo --hdr-ctl, ativo --surface-3) | à direita: `↶` `↷` `≡ Histórico` `[monitor]` `●`(sync) `Mesas`.
```
1366×768 — GRUPO
┌──────────────────────────────────────────────────────────────────────────────┐
│ Coração de Rubi  Dia 1   [Grupo|Combate]           ↶ ↷  ≡ Histórico• ▭ ● ⋯ │52
├──────────────────────────────────────────────────────────────────────────────┤
│ [☾ Descanso] [◔ Alimentar] [Limpar condições]      [+ Personagem] [⚔ Combate]│48
│ ┌Kael Nv5·Paulo   ✎┐ ┌Lyra            ✎┐ ┌Brom ▌Caído·faltam 16 ✎┐ ┌ 4º ┐ │
│ │PV ▬▬▬▬──── 14/34  │ │PV ▬▬▬▬▬▬▬ 22/22 │ │PV ─────────  −4/41     │ │    │ │
│ │   [−][ 1 ][+]     │ │   [−][ 1 ][+]   │ │   [−][ 1 ][+]          │ │    │ │
│ │PM ▬▬▬▬▬▬▬ 12/12  │ │PM ...  (idem)   │ │PM ...                  │ │    │ │
│ │DEF 18 · INI +4    │ │                 │ │                        │ │    │ │
│ │T$ 120 [_][−][+] ◔ 3 [−][+]          │ │                        │ │    │ │
│ │[Abalado cena ×] [+ condição]        │ │                        │ │    │ │
└──────────────────────────────────────────────────────────────────────────────┘
```
Grid `repeat(auto-fill,minmax(300px,1fr))`, card ≈ 330 px alto → **4 jogadores visíveis sem rolar** em 1366×768. Setas ‹ › de reordenar vão para o modal Editar (sai do card).
```
1366×768 — COMBATE (linha = 64 px com PM, 52 px sem)
│ Coração de Rubi  Dia 2·R1 [Grupo|Combate]          ↶ ↷  ≡ Histórico ▭ ● ⋯ │
│ Rodada 1 · Vez de Goblin 3   [‹][Próximo turno ›][Nova rodada][▢ Rolar ini] [+ Inimigo] [⋯]│
│ ┌19┐ Bugbear Chefe  DEF12   PV ▬▬▬▬── 22/30 [−][1][+]  PM ... [+cond]  ◉ ✎ ×│
│ ┃18┃ Goblin 3 (vez: inset 2px accent)  ...                                  │
│ ┌11┐ Kael  DEF18            PV ...  PM ...  [Abalado cena ×]              ✎ │
```
Faixa lateral 3 px: jogador `--pm`, inimigo `--pv`. Total de iniciativa = input 56×44, editável; d20 em --text-3 abaixo. As 3 opções (rerrolar/teste único/mostrar PV) e "Encerrar combate" (btn.perigo) vão para o menu `⋯` (folha). **Cabem 8 combatentes sem rolar** (52+56+8×72).
```
390×844 — celular (Grupo e Combate)
┌────────────────────────────────┐
│ Rubi · D2  [Grp|Cmb]  ↶ ≡• ⋯  │52  (↷, ▭, Mesas dentro de ⋯)
├────────────────────────────────┤
│ Kael  Nv5           DEF18 INI+4│ card compacto 1 coluna
│ PV ▬▬▬▬▬───────────     14/34  │
│ PM ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬     12/12  │
│ T$120  ◔3  [Abalado ×]  [+]    │
│ (toque → folha Dano/Cura/PM)   │
├────────────────────────────────┤
│[☾ Descanso][◔ Alimentar][⚔ Cmb]│64 barra-acao fixa (Combate: [‹][Próximo turno ›][+])
└────────────────────────────────┘
```
Celular: toque no card abre folha inferior com Dano/Cura/PM + teclado (como aba Vida do MobileT20). 4 cards de grupo (≈150 px) ou 7 linhas de combate (80 px: nome+ini / barra PV) sem rolar.
**Feedback (substitui o toast):** remover `#toast` e `toast(...,true)`. Cada ação rotineira (alimentar, descansar, limpar, remover inimigo, nova rodada) → entrada no Histórico + classe `.novo` (ponto 7 px --accent) no `≡ Histórico` e `.flash` (keyframe `flashHist` 1.1 s: fundo rgba(224,184,79,.35)→transparente) no `≡` e no `↶`. Desfazer = `↶` (sempre visível). Histórico abre folha lateral (desktop 360 px à direita / celular folha inferior 92 dvh) listando ações com hora; o ponto some ao abrir. Pop-up/modal só para aviso/erro ("Sem ração: Brom" vira linha do Histórico em --warn, não pop-up).
## 4. Tela dos jogadores (display.html; sem botões; `font-size:clamp(16px,1.25vw,24px)` → 24 px em 1920, 17 px em 1366)
**Hierarquia:** (1) **Vez de** — nome 3 em, 700, --text; rótulo `Vez de` .9 em --text-3; `Depois: Kael` 1.1 em à direita; bloco --surface-2, border-left 4px --accent, raio 14, padding 1em 1.2em. (2) Lista: linhas --surface, raio 14, gap .5em, padding .8em 1.2em; colunas `ini 3em | nome 1.4em 700 + DEF .8em --text-3 | barras (jogador) ou estado textual (inimigo) | condições`. (3) Cabeçalho: mesa 1.4em 700 --text à esquerda, `⚔ Rodada 1` --text-2 à direita; sem faixa dourada. 1920×1080: 8 linhas de 92 px sem rolar. 1366×768: 7 linhas de 72 px; condições perdem a descrição (só nome).  
Estados: **vez** = inset 2px --accent + número de ini em --accent; **derrotado** = opacity .4, nome riscado, estado "Derrotado" --text-3; **caído** (jogador PV ≤ 0) = fundo --danger-bg, rótulo `Caído · faltam 16` #FFB4B4, barra PV vazia; **oculto** = linha não renderizada (nem placeholder). Inimigo sem "mostrar PV": Ileso --ok, Ferido --warn, Sangrando --danger (texto, sem barra). Grupo (fora de combate): grade 3–4 colunas de cards --surface com nome, barras PV/PM, `T$ 120`, `◔ 3`, chips.
## 5. Botões e chips
Dano/Cura/PM (`.acao`, raio 12, min-height 48 px desktop / 56 px celular, texto #fff 700, sem borda, sem sombra): Dano `--btn-dano`, Cura `--btn-cura`, Gasto PM `--btn-pm`, Recuperar PM `--btn-cura`; `:active{filter:brightness(.85)}`; `:disabled{opacity:.28}`. Campo de valor: `.input` --surface-2, raio 12, 56×48, centralizado. Rótulos textuais "Dano/Cura" no celular; `−`/`+` no desktop (com `aria-label`). Genéricos: `.btn` --surface-2 sem borda, raio 12, 48 px, 600; `.btn.pri` --accent / --accent-ink (só Próximo turno e Iniciar combate); `.btn.ghost` transparente + inset 1px --border-strong; `.btn.perigo` --danger texto + inset 1px --danger.
Chips de condição: `.chip` raio 999, min-height 32 px (desktop)/40 px (celular), padding 6px 12px, fundo --surface-2, texto --warn .86rem 500, duração `small` --text-3, `×` --text-3. Condição grave (caído/inconsciente/sangrando) = fundo --danger-bg, texto #FFB4B4. `+ condição` = `.chip` transparente, inset 1px --border-strong, texto --text-3 (sem tracejado).
