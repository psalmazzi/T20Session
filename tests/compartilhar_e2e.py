"""Compartilhar (link público) com um Supabase falso (tests/fake_supabase.js): o ambiente de teste não alcança o Supabase.

    python3 tests/compartilhar_e2e.py [pasta_dos_prints]

Confere: criar link, display ?c= sem login recebe o estado por Broadcast, inimigo oculto não vaza,
gerar novo link invalida o antigo, parar de compartilhar.
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/shots/v5'
PORTA = 8767
URL = f'http://localhost:{PORTA}'
os.makedirs(SHOTS, exist_ok=True)
FAKE = open(os.path.join(RAIZ, 'tests', 'fake_supabase.js'), encoding='utf-8').read()
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
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 1366, 'height': 768})
        ctx.add_init_script(FAKE)
        gm = ctx.new_page(); vigiar(gm, 'GM')
        gm.goto(URL + '/index.html')
        gm.fill('#f-mesa input[name=nome]', 'Coração de Rubi'); gm.click('#f-mesa button.pri')
        gm.wait_for_selector('.topo')
        ok(gm.inner_text('.topo .sync-rot') == 'Salvo', 'online: rótulo "Salvo" no cabeçalho')
        gm.click('[data-a=novo] >> nth=0'); gm.fill('#f-pj [name=nome]', 'Kael'); gm.fill('#f-pj [name=pvMax]', '30'); gm.click('#f-pj button.pri')
        gm.click('.seg [data-v=combate]')
        for nome, vis in (('Goblin', True), ('Assassino', False)):
            gm.click('.painel-turno [data-a=addini]'); gm.fill('#f-ini [name=nome]', nome)
            if not vis:
                gm.uncheck('#f-ini [name=visivel]')
            gm.click('#f-ini button.pri')
        gm.click('header [data-a=compartilhar]')
        gm.wait_for_selector('#comp-criar')
        ok('não está compartilhada' in gm.inner_text('.modal'), 'mesa começa sem link')
        gm.click('#comp-criar')
        gm.wait_for_selector('#comp-link')
        link = gm.input_value('#comp-link')
        cod = link.split('?c=')[1]
        ok('/display.html?c=' in link and len(cod) >= 12, f'link público criado ({len(cod)} caracteres)')
        ok(all(ch not in cod for ch in '01ilo'), 'código sem caracteres ambíguos')
        time.sleep(0.3)
        gm.screenshot(path=f'{SHOTS}/gm-compartilhar-1366.png')
        gm.click('.modal [data-fechar]')
        ok('ligado' in gm.get_attribute('header [data-a=compartilhar]', 'class'), 'botão Compartilhar fica destacado com link ativo')

        # jogador abre o link no celular (sem login)
        cel = ctx.new_page(); vigiar(cel, 'CEL'); cel.set_viewport_size({'width': 390, 'height': 844})
        cel.goto(link.replace('http://localhost:8767', URL))
        cel.wait_for_selector('.d-card')
        ok('Kael' in cel.inner_text('body'), 'link público: carga inicial via rpc mostra o grupo')
        ok(cel.locator('#f').count() == 0, 'link público nunca pede login')
        gm.click('.painel-turno [data-a=iniciar]'); gm.click('#b-ini')
        cel.wait_for_selector('.d-vez', timeout=4000)
        txt = cel.inner_text('body')
        ok('Goblin' in txt and 'Assassino' not in txt, 'Broadcast: combate chega; inimigo oculto não aparece')
        env = gm.evaluate('window.__ultimoEnvio')
        ok(all(i['nome'] != 'Assassino' for i in env['estado']['combate']['inimigos']) and 'log' not in env['estado'], 'payload do Broadcast já vai sem ocultos e sem histórico')
        n0 = gm.evaluate('window.__enviados')
        kid = gm.evaluate("JSON.parse(localStorage.getItem('t20s.mesa.' + JSON.parse(localStorage.getItem('t20s.mesaAtiva')))).jogadores[0].id")
        for _ in range(6):
            gm.fill(f'#v-pv-{kid}', '1'); gm.press(f'#v-pv-{kid}', 'Enter')
        time.sleep(0.8)
        n1 = gm.evaluate('window.__enviados')
        ok(n1 - n0 <= 4, f'throttle: 6 ações rápidas viraram {n1 - n0} envios')
        ok('24 / 30' in cel.inner_text('body'), 'último estado chega ao celular (PV 24/30)')
        time.sleep(0.3)
        cel.screenshot(path=f'{SHOTS}/display-link-publico-390.png')

        # gerar novo link: o antigo para de funcionar
        gm.click('header [data-a=compartilhar]'); gm.click('#comp-novo')
        gm.wait_for_function(f"document.querySelector('#comp-link') && !document.querySelector('#comp-link').value.endsWith('{cod}')")
        velho = ctx.new_page(); vigiar(velho, 'VELHO'); velho.goto(f'{URL}/display.html?c={cod}')
        velho.wait_for_selector('.d-espera')
        ok('não está mais ativo' in velho.inner_text('body'), 'link antigo avisa que não está mais ativo')
        gm.click('#comp-parar')
        gm.wait_for_selector('#comp-criar')
        ok(gm.evaluate("JSON.parse(localStorage.getItem('fake.mesas'))[0].codigo") is None, 'parar de compartilhar grava codigo = null')
        b.close()
finally:
    srv.terminate()
print('ERROS DE PÁGINA:', erros or 'nenhum')
print('FALHAS:', falhas or 'nenhuma')
sys.exit(1 if erros or falhas else 0)
