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


def vigiar(pg, nome):
    pg.on('pageerror', lambda e: erros.append(f'{nome} pageerror: {e}'))
    pg.on('console', lambda m: m.type == 'error' and erros.append(f'{nome} console: {m.text}'))


srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORTA), '-d', RAIZ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
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
        gm.click('.barra-acoes [data-a=descanso]'); gm.click('[data-tipo=confortavel]')
        gm.check(f'[data-cuid="{brom}"]')
        gm.click('#b-desc')
        bs = achar('Brom')
        ok(bs['pv']['atual'] == -3 + 10 + 5, f'descanso confortável + cuidados: Brom a {bs["pv"]["atual"]} PV')
        ok(conds('Brom') == ['fatigado'], 'Brom acordou; fatigado da fome continua')
        ok(estado()['dia'] == 2, 'dia avançou')

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
        gm.check(f'[data-surp="{lyra}"]')
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
