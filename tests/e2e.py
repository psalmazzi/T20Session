"""Teste de ponta a ponta (Playwright + Chrome) da tela do mestre e da tela dos jogadores.

    python3 tests/e2e.py [pasta_dos_prints]

Sobe um http.server na pasta do projeto, roda o fluxo completo de uma sessão e gera prints.
Falha (código 1) em qualquer verificação, pageerror ou console.error.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/shots/v3'
PORTA = 8765
URL = f'http://localhost:{PORTA}'
CHROME = '/usr/bin/google-chrome'
os.makedirs(SHOTS, exist_ok=True)

erros, falhas = [], []


def ok(cond, msg):
    print(('  ok  ' if cond else 'FALHA ') + msg)
    if not cond:
        falhas.append(msg)


def cdn_bloqueado(m):
    """js/config.js tem Supabase configurado e o CDN não é alcançável neste ambiente:
    só a falha de carregar esse script é esperada (o app cai no modo local)."""
    url = (m.location or {}).get('url', '') if hasattr(m, 'location') else ''
    return 'ERR_TUNNEL_CONNECTION_FAILED' in m.text and ('jsdelivr' in url or 'supabase' in url or not url)


def vigiar(pg, nome):
    pg.on('pageerror', lambda e: erros.append(f'{nome} pageerror: {e}'))
    pg.on('console', lambda m: m.type == 'error' and not cdn_bloqueado(m) and erros.append(f'{nome} console: {m.text}'))


def novato(b, largura, altura, suf):
    """Prints da 1ª abertura (modo Dicas ligado sozinho) em contexto limpo."""
    ctx = b.new_context(viewport={'width': largura, 'height': altura})
    g = ctx.new_page(); vigiar(g, f'NOVATO-{suf}')
    g.goto(URL + '/index.html')
    g.wait_for_selector('#f-mesa')
    ok(g.evaluate("document.body.classList.contains('dicas')"), f'{suf}: 1ª abertura liga o modo Dicas')
    ok('Nome da campanha' in g.get_attribute('#f-mesa input', 'placeholder'), f'{suf}: placeholder da mesa explica')
    g.screenshot(path=f'{SHOTS}/novato-01-mesas-{suf}.png')
    g.fill('input[name=nome]', 'Mesa Teste'); g.click('#f-mesa button.pri')
    g.wait_for_selector('.passos')
    ok('0 de 3' in g.inner_text('.passos'), f'{suf}: Primeiros passos 0 de 3')
    ok(g.locator('.vazio').is_hidden(), f'{suf}: card substitui o vazio antigo')
    if largura > 720:
        ok(g.locator('.topo .sync-rot').inner_text() == 'Local', f'{suf}: rótulo Local no cabeçalho')
        top = g.evaluate("Array.from(document.querySelectorAll('.topo > *')).filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).reduce((a, r) => [Math.min(a[0], r.top), Math.max(a[1], r.bottom), Math.max(a[2], r.right)], [1e9, 0, 0])")
        ok(top[1] - top[0] <= 52 and top[2] <= largura, f'{suf}: cabeçalho em uma linha e sem estourar ({top})')
    g.screenshot(path=f'{SHOTS}/novato-02-mesa-vazia-{suf}.png')
    g.locator('header [data-a=modo][data-v=combate]').click()
    g.wait_for_selector('.linha-vazia')
    ok('pri' not in g.get_attribute('[data-a=iniciar]:visible', 'class'), f'{suf}: Iniciar sem destaque quando não há inimigos')
    g.screenshot(path=f'{SHOTS}/novato-03-combate-vazio-{suf}.png')
    g.locator('header [data-a=modo][data-v=grupo]').click()
    g.locator('[data-a=novo]:visible').first.click()
    g.wait_for_selector('#f-pj')
    time.sleep(0.2)
    g.screenshot(path=f'{SHOTS}/novato-04-modal-pj-{suf}.png', full_page=True)
    g.fill('#f-pj [name=nome]', 'Kael'); g.fill('#f-pj [name=pvMax]', '30'); g.fill('#f-pj [name=pmMax]', '12'); g.click('#f-pj button.pri')
    g.wait_for_selector('.passos.curto')
    ok('1 de 3' in g.inner_text('.passos.curto'), f'{suf}: passo 1 feito, card encolhe')
    g.screenshot(path=f'{SHOTS}/novato-05-grupo1-{suf}.png')
    g.locator('header [data-a=modo][data-v=combate]').click()
    g.locator('[data-a=addini]:visible').first.click()
    g.fill('#f-ini [name=nome]', 'Goblin'); g.fill('#f-ini [name=qtd]', '2'); g.click('#f-ini button.pri')
    ok('pri' in g.get_attribute('[data-a=iniciar]:visible', 'class'), f'{suf}: Iniciar em destaque com inimigos')
    g.screenshot(path=f'{SHOTS}/novato-06-combate-antes-{suf}.png')
    g.locator('[data-a=iniciar]:visible').first.click()
    g.wait_for_selector('.modal-iniciar')
    ok('Ninguém surpreso: todos agem' in g.inner_text('.resumo-surp'), f'{suf}: modal Iniciar padrão = ninguém surpreso')
    g.click('[data-atalho=inimigos]')
    ok(g.inner_text('.resumo-surp').startswith('2 surpresos: Goblin 1, Goblin 2'), f'{suf}: atalho Inimigos surpresos')
    time.sleep(0.2)
    g.screenshot(path=f'{SHOTS}/novato-07-modal-iniciar-{suf}.png')
    g.click('#b-ini')
    g.wait_for_selector('.painel-turno .rodada')
    time.sleep(0.3)
    g.screenshot(path=f'{SHOTS}/novato-08-combate-ativo-{suf}.png')
    g.locator('header [data-a=menu]').click()
    g.click('.folha [data-f=guia]')
    g.wait_for_selector('.guia')
    ok('regra da casa' in g.inner_text('.guia').lower() and 'p. 231' in g.inner_text('.guia'), f'{suf}: Guia rápido explica a regra do livro')
    time.sleep(0.3)
    g.screenshot(path=f'{SHOTS}/novato-09-guia-{suf}.png')
    g.click('.folha [data-f=fechar] >> nth=-1')
    if largura > 720:
        g.click('header [data-a=compartilhar]')
    else:
        g.locator('header [data-a=menu]').click(); g.click('.folha [data-v=compartilhar]')
    g.wait_for_selector('#comp-link')
    ok('modo online' in g.inner_text('.modal') and 'display.html?mesa=' in g.input_value('#comp-link'), f'{suf}: Compartilhar em modo local oferece só o link deste computador')
    time.sleep(0.2)
    g.screenshot(path=f'{SHOTS}/novato-10-compartilhar-{suf}.png')
    ctx.close()


srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORTA), '-d', RAIZ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        novato(b, 1366, 768, '1366')
        novato(b, 390, 844, '390')
        esp = b.new_page(viewport={'width': 1366, 'height': 768}); vigiar(esp, 'DISPLAY-ESPERA')
        esp.goto(URL + '/display.html?mesa=inexistente')
        ok('Aguardando' in esp.inner_text('body'), 'tela dos jogadores: "Aguardando" nos primeiros segundos')
        esp.wait_for_selector('.d-espera', timeout=8000)
        ok('Tela dos jogadores' in esp.inner_text('.d-espera'), 'tela dos jogadores: explicação depois de 5 s')
        esp.screenshot(path=f'{SHOTS}/novato-11-display-espera.png')
        esp.close()

        gm = ctx.new_page(); vigiar(gm, 'GM')
        gm.goto(URL + '/index.html')

        def estado():
            mid = json.loads(gm.evaluate("localStorage.getItem('t20s.mesaAtiva')"))
            return json.loads(gm.evaluate(f"localStorage.getItem('t20s.mesa.{mid}')"))

        def achar(nome, s=None):
            s = s or estado()
            for c in s['jogadores'] + s['combate']['inimigos']:
                if c['nome'] == nome:
                    return c
            raise KeyError(nome)

        def conds(nome):
            return sorted(x['cond'] for x in achar(nome)['condicoes'])

        def vez_nome():
            return gm.inner_text('.painel-turno .vez b').strip()

        # ---------- mesa e personagens ----------
        gm.fill('input[name=nome]', 'Coração de Rubi')
        gm.click('#f-mesa button.pri')
        gm.wait_for_selector('text=Adicione os personagens')
        pjs = [('Kael', 'Paulo', 5, 34, 12, 18, 4, 120, 3), ('Lyra', 'Ana', 5, 22, 25, 15, 2, 45.5, 1), ('Brom', 'Leo', 5, 41, 8, 21, 0, 10, 0)]
        for nome, jog, nv, pv, pm, de, ini, din, rac in pjs:
            gm.click('[data-a=novo] >> nth=0')
            for k, v in dict(nome=nome, jogador=jog, nivel=nv, pvMax=pv, pmMax=pm, defesa=de, iniciativa=ini, dinheiro=din, racoes=rac).items():
                gm.fill(f'#f-pj [name={k}]', str(v))
            gm.click('#f-pj button.pri')
        ok(gm.locator('.card').count() == 3, '3 personagens criados')
        kael, lyra, brom = (achar(n)['id'] for n in ('Kael', 'Lyra', 'Brom'))

        # ---------- dano até cair: Inconsciente + Sangrando ----------
        gm.fill(f'#v-pv-{brom}', '45'); gm.press(f'#v-pv-{brom}', 'Enter')
        ok(achar('Brom')['pv']['atual'] == -4, 'Brom a -4 PV')
        ok(conds('Brom') == ['inconsciente', 'sangrando'], 'Brom caiu: Inconsciente + Sangrando')
        ok('Caído · faltam 16' in gm.inner_text('.card:has-text("Brom")'), 'faixa "Caído · faltam 16" no card (morre em -20)')
        # cura 1 estabiliza (tira Sangrando, segue inconsciente)
        gm.fill(f'#v-pv-{brom}', '1'); gm.click(f'[data-a="pv+"][data-id="{brom}"]')
        ok(conds('Brom') == ['inconsciente'], 'cura de 1 PV estabiliza (sem Sangrando)')

        # ---------- PM insuficiente ----------
        gm.fill(f'#v-pm-{kael}', '20'); gm.click(f'[data-a="pm-"][data-id="{kael}"]')
        gm.wait_for_selector('#aviso .aviso-caixa')
        ok('PM insuficiente' in gm.inner_text('#aviso'), 'aviso "PM insuficiente" visível')
        ok(achar('Kael')['pm']['atual'] == 12, 'PM não mudou ao pedir mais do que tem')
        gm.fill(f'#v-pm-{kael}', '5'); gm.click(f'[data-a="pm-"][data-id="{kael}"]')
        ok(achar('Kael')['pm']['atual'] == 7, 'gasto de 5 PM aplicado')
        gm.click(f'[data-a="addcond"][data-id="{kael}"]'); gm.click('[data-c=abalado]')
        ok(conds('Kael') == ['abalado'], 'condição Abalado adicionada')

        # ---------- alimentar sem ração + falha de Fortitude ----------
        gm.click('.barra-acoes [data-a=alimentar]')
        ok(gm.locator('.ic.hist.novo').count() == 1, 'ponto de novidade no Histórico')
        ok(gm.locator('.ic.hist.flash').count() == 1, 'Histórico pisca após ação rotineira')
        ok(estado()['log'][0]['tipo'] == 'aviso' and 'Brom' in estado()['log'][0]['txt'], 'sem ração vira linha de aviso no Histórico')
        gm.click('.barra-acoes [data-a=alimentar]')  # 2º dia de Brom sem comer: CD 15
        ok('Fortitude CD 15' in gm.inner_text('.card:has-text("Brom")'), 'Brom: Fortitude CD 15 no card')
        gm.click(f'[data-a=falhafome][data-id="{brom}"]')
        f = [x for x in achar('Brom')['condicoes'] if x.get('origem') == 'fome']
        ok(len(f) == 1 and f[0]['cond'] == 'fatigado' and f[0]['dur']['tipo'] == 'indef', 'falha de fome: Fatigado (fome, indefinido)')
        ok(gm.locator('#toast').count() == 0, 'sem toast')

        # ---------- tela dos jogadores ----------
        mesa = json.loads(gm.evaluate("localStorage.getItem('t20s.mesaAtiva')"))
        dp = ctx.new_page(); vigiar(dp, 'DISPLAY-1920'); dp.set_viewport_size({'width': 1920, 'height': 1080})
        dp.goto(f'{URL}/display.html?mesa={mesa}')
        dp2 = ctx.new_page(); vigiar(dp2, 'DISPLAY-1366'); dp2.set_viewport_size({'width': 1366, 'height': 768})
        dp2.goto(f'{URL}/display.html?mesa={mesa}')
        time.sleep(0.6)
        gm.mouse.move(5, 760); time.sleep(1.2)  # deixa o flash terminar
        gm.screenshot(path=f'{SHOTS}/gm-grupo-1366.png')
        dp.screenshot(path=f'{SHOTS}/display-grupo-1920.png')
        dp2.screenshot(path=f'{SHOTS}/display-grupo-1366.png')
        gm.click('[data-a=historico]')
        gm.wait_for_selector('.folha.lateral .historico')
        ok(gm.locator('.ic.hist.novo').count() == 0, 'ponto some ao abrir o Histórico')
        ok('Fortitude' in gm.inner_text('.historico li >> nth=0'), 'Histórico lista o mais recente primeiro')
        time.sleep(0.3)
        gm.screenshot(path=f'{SHOTS}/gm-historico-1366.png')
        gm.keyboard.press('Escape')

        # ---------- descanso ----------
        gm.click('.barra-acoes [data-a=descanso]'); gm.click('[data-todos=confortavel]')
        gm.check(f'[data-m=cuidados][data-id="{brom}"]')
        gm.screenshot(path=f'{SHOTS}/gm-descanso-1366.png')
        gm.click('#b-desc')
        bs = achar('Brom')
        ok(bs['pv']['atual'] == -3 + 10 + 5, f'descanso confortável + cuidados: Brom a {bs["pv"]["atual"]} PV')
        ok(conds('Brom') == ['fatigado'], 'Brom acordou; fatigado da fome continua')

        # ---------- combate: 3 goblins + 1 oculto, surpresa ----------
        gm.click('.seg [data-v=combate]')
        gm.click('.painel-turno [data-a=addini]')
        gm.fill('#f-ini [name=nome]', 'Goblin'); gm.fill('#f-ini [name=pv]', '8'); gm.fill('#f-ini [name=defesa]', '13'); gm.fill('#f-ini [name=iniciativa]', '2'); gm.fill('#f-ini [name=qtd]', '3')
        gm.click('#f-ini button.pri')
        gm.click('.painel-turno [data-a=addini]')
        gm.fill('#f-ini [name=nome]', 'Bugbear Chefe'); gm.fill('#f-ini [name=pv]', '30'); gm.fill('#f-ini [name=pm]', '6'); gm.fill('#f-ini [name=iniciativa]', '1')
        gm.uncheck('#f-ini [name=visivel]')
        gm.click('#f-ini button.pri')
        ok(len(estado()['combate']['inimigos']) == 4, '4 inimigos adicionados')
        ok(estado()['combate']['inimigosEmGrupo'] is True, 'inimigos em grupo ligado por padrão')
        gm.click('.painel-turno [data-a=iniciar]')
        gm.wait_for_selector('.modal-iniciar')
        ok([t.lower() for t in gm.locator('.modal-iniciar .tit-grupo').all_inner_texts()] == ['jogadores', 'inimigos'], 'modal Iniciar agrupa Jogadores / Inimigos')
        ok(gm.locator('[data-surp][data-v=pronto].ativa').count() == 7, 'todos começam Pronto')
        gm.click('[data-atalho=jogadores]')
        ok(gm.inner_text('.resumo-surp').startswith('3 surpresos'), 'atalho Jogadores surpresos')
        gm.click('[data-atalho=ninguem]')
        ok(gm.locator('[data-surp][data-v=surpreso].ativa').count() == 0, 'atalho Ninguém surpreso limpa')
        gm.click(f'[data-surp="{lyra}"][data-v=surpreso]')
        ok(gm.inner_text('.resumo-surp') == '1 surpreso: Lyra.', 'resumo vivo: "1 surpreso: Lyra."')
        ok('não age na 1ª rodada' in gm.inner_text('.linha-surp.surp'), 'linha surpresa avisa "não age na 1ª rodada"')
        gm.screenshot(path=f'{SHOTS}/gm-iniciar-1366.png')
        gm.click('#b-ini')
        s = estado()
        ok(s['combate']['ativo'] and s['combate']['rodada'] == 1, 'combate iniciado')
        ok('surpreendido' in conds('Lyra'), 'Lyra surpreendida')
        gob = [i for i in s['combate']['inimigos'] if i['nome'].startswith('Goblin')]
        ok(len({s['combate']['inis'][g['id']]['total'] for g in gob}) == 1, 'goblins com um único teste')
        vistos = [vez_nome()]
        for _ in range(10):
            gm.click('.painel-turno [data-a=proximo]')
            if estado()['combate']['rodada'] > 1:
                break
            vistos.append(vez_nome())
        ok('Lyra' not in vistos, f'Lyra pulada na 1ª rodada (vez: {", ".join(vistos)})')
        # clicar no nome não passa a vez; a ação explícita aparece ao passar o mouse
        antes = vez_nome()
        outro = next(n for n in ('Kael', 'Brom', 'Lyra') if n != antes)
        gm.click(f'.linha-ini:has-text("{outro}") .ini-nome .nome')
        ok(vez_nome() == antes, f'clicar no nome de {outro} não passa a vez')
        gm.hover(f'.linha-ini:has-text("{outro}") .ini-nome .nome')
        ok(gm.locator(f'.linha-ini:has-text("{outro}") .dar-vez').is_visible(), '"Passar a vez para cá" aparece no hover')
        gm.click(f'.linha-ini:has-text("{outro}") .dar-vez')
        ok(vez_nome() == outro, f'"Passar a vez para cá" passa a vez para {outro}')
        gm.hover(f'.linha-ini:has-text("{antes}") .ini-nome .nome'); gm.click(f'.linha-ini:has-text("{antes}") .dar-vez')
        ok(vez_nome() == antes, 'vez devolvida')
        ok(estado()['combate']['rodada'] == 2, 'rodada 2')
        ok('surpreendido' not in conds('Lyra'), 'Surpreendido terminou no fim da 1ª rodada')

        # ---------- Sangrando: lembrete Con CD 15 na vez ----------
        gm.fill(f'#v-pv-{kael}', '40'); gm.press(f'#v-pv-{kael}', 'Enter')
        ok(conds('Kael') == ['abalado', 'inconsciente', 'sangrando'], 'Kael caiu em combate')
        achou = False
        for _ in range(12):
            if vez_nome() == 'Kael':
                achou = True
                break
            gm.click('.painel-turno [data-a=proximo]')
        ok(achou, 'vez do Kael')
        ok(gm.locator('.lembrete').count() == 1 and 'Con CD 15' in gm.inner_text('.lembrete'), 'lembrete "Con CD 15" no painel de turno')
        pv0 = achar('Kael')['pv']['atual']
        gm.click('.lembrete [data-a=sangra-falha]')
        ok(achar('Kael')['pv']['atual'] < pv0, 'falhou: perdeu 1d6 PV')

        # ---------- inimigo entra no meio: age na próxima rodada ----------
        rod = estado()['combate']['rodada']
        gm.click('.painel-turno [data-a=addini]')
        gm.fill('#f-ini [name=nome]', 'Lobo'); gm.fill('#f-ini [name=pv]', '12'); gm.fill('#f-ini [name=iniciativa]', '30')
        gm.click('#f-ini button.pri')
        lobo = achar('Lobo')
        ok(lobo.get('entrouNaRodada') == rod, 'Lobo marcado como entrou nesta rodada')
        ok('age na próxima rodada' in gm.inner_text('.linha-ini:has-text("Lobo")'), 'linha do Lobo avisa "age na próxima rodada"')
        vistos = []
        for _ in range(12):
            gm.click('.painel-turno [data-a=proximo]')
            if estado()['combate']['rodada'] > rod:
                break
            vistos.append(vez_nome())
        ok('Lobo' not in vistos, 'Lobo não agiu na rodada em que entrou')
        vistos = [vez_nome()]
        for _ in range(12):
            if estado()['combate']['rodada'] > rod + 1:
                break
            gm.click('.painel-turno [data-a=proximo]')
            vistos.append(vez_nome())
        ok('Lobo' in vistos, 'Lobo agiu na rodada seguinte')

        # danos para o print
        g = [i for i in estado()['combate']['inimigos'] if i['nome'].startswith('Goblin')]
        gm.fill(f'#v-pv-{g[0]["id"]}', '8'); gm.press(f'#v-pv-{g[0]["id"]}', 'Enter')
        gm.fill(f'#v-pv-{g[1]["id"]}', '3'); gm.press(f'#v-pv-{g[1]["id"]}', 'Enter')
        gm.click(f'[data-a="addcond"][data-id="{g[2]["id"]}"]'); gm.fill('#c-rod', '2'); gm.click('[data-c=enredado]')
        bug = achar('Bugbear Chefe')['id']
        gm.fill(f'#v-pv-{bug}', '12'); gm.press(f'#v-pv-{bug}', 'Enter')
        time.sleep(1.3)
        gm.mouse.move(5, 760)
        gm.screenshot(path=f'{SHOTS}/gm-combate-1366.png')
        gm.click('.painel-turno [data-a=menu]')
        gm.wait_for_selector('.folha [data-opc=rerrolarCadaRodada]')
        ok('Rolar iniciativa a cada rodada (regra da casa)' in gm.inner_text('.folha'), 'opção rotulada como regra da casa')
        ok('p. 231' in gm.inner_text('.folha'), 'ajuda cita p. 231')
        time.sleep(0.3)
        gm.screenshot(path=f'{SHOTS}/gm-menu-1366.png')
        gm.keyboard.press('Escape')
        time.sleep(0.5)
        dp.screenshot(path=f'{SHOTS}/display-combate-1920.png')
        dp2.screenshot(path=f'{SHOTS}/display-combate-1366.png')
        ok('Bugbear' not in dp.inner_text('body'), 'inimigo oculto não aparece na tela dos jogadores')
        ok('Goblin 2' in dp.inner_text('body'), 'goblins visíveis na tela dos jogadores')
        gm.close()

        # ---------- celular 390×844 ----------
        cel = ctx.new_page(); vigiar(cel, 'GM-390'); cel.set_viewport_size({'width': 390, 'height': 844})
        gm = cel
        cel.goto(URL + '/index.html')
        cel.wait_for_selector('.linha-ini')
        time.sleep(0.3)
        cel.screenshot(path=f'{SHOTS}/gm-combate-390.png')
        g2 = achar('Goblin 2')
        cel.click('.linha-ini:has-text("Goblin 2") .ini-nome')
        cel.wait_for_selector('.folha.teclado-folha')
        cel.click('.folha [data-f=tecla][data-v="4"]')
        time.sleep(0.3)
        cel.screenshot(path=f'{SHOTS}/gm-teclado-combate-390.png')
        cel.click('.folha [data-f=aplicar][data-v=menos]')
        ok(achar('Goblin 2')['pv']['atual'] == g2['pv']['atual'] - 4, 'teclado do celular aplicou 4 de dano')
        cel.click('.folha [data-f=fechar] >> nth=-1')
        cel.click('.barra-cel [data-a=proximo]')
        cel.click('[data-a=historico]')
        cel.wait_for_selector('.folha.lateral .historico')
        time.sleep(0.3)
        cel.screenshot(path=f'{SHOTS}/gm-historico-390.png')
        cel.click('.folha [data-f=fechar] >> nth=-1')
        cel.click('.seg [data-v=grupo]')
        cel.wait_for_selector('.card')
        time.sleep(0.3)
        cel.screenshot(path=f'{SHOTS}/gm-grupo-390.png')
        cel.click('.card:has-text("Lyra") .card-topo .nome')
        cel.wait_for_selector('.folha.teclado-folha')
        cel.click('.folha [data-f=alvo][data-v=pm]')
        for d in '30':
            cel.click(f'.folha [data-f=tecla][data-v="{d}"]')
        cel.click('.folha [data-f=aplicar][data-v=menos]')
        ok('PM insuficiente' in cel.inner_text('#aviso'), 'celular: PM insuficiente recusado')
        ok(achar('Lyra')['pm']['atual'] == 25, 'celular: PM da Lyra intacto')
        for d in '6':
            cel.click(f'.folha [data-f=tecla][data-v="{d}"]')
        time.sleep(0.3)
        cel.screenshot(path=f'{SHOTS}/gm-teclado-grupo-390.png')
        cel.click('.folha [data-f=aplicar][data-v=menos]')
        ok(achar('Lyra')['pm']['atual'] == 19, 'celular: gastou 6 PM')
        cel.click('.folha [data-f=fechar] >> nth=-1')

        # ---------- encerrar ----------
        cel.click('.seg [data-v=combate]')
        cel.click('.topo [data-a=menu]')
        cel.wait_for_selector('.folha [data-f=encerrar]')
        time.sleep(0.3)
        cel.screenshot(path=f'{SHOTS}/gm-menu-390.png')
        cel.click('.folha [data-f=encerrar]')
        cel.click('#b-enc')
        s = estado()
        ok(not s['combate']['ativo'] and s['modo'] == 'grupo', 'combate encerrado, volta ao Grupo')
        ok(s['combate']['inimigos'] == [], 'inimigos removidos')
        ok(conds('Kael') == ['inconsciente', 'sangrando'] or conds('Kael') == ['inconsciente'], 'fim de cena mantém só as indefinidas (Kael: %s)' % conds('Kael'))
        ok(conds('Brom') == ['fatigado'], 'fatigado da fome sobrevive ao fim da cena')
        time.sleep(0.5)
        dp.screenshot(path=f'{SHOTS}/display-fim-1920.png')
        cel.reload(); cel.wait_for_selector('.card')
        ok(cel.locator('.card').count() == 3, 'estado persiste após recarregar')
        b.close()
finally:
    srv.terminate()

print('ERROS DE PÁGINA:', erros or 'nenhum')
print('FALHAS:', falhas or 'nenhuma')
sys.exit(1 if erros or falhas else 0)
