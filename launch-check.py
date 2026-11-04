"""Check shared-origin app boundaries and non-destructive relaunch handling.

This cannot simulate iOS SpringBoard's Dynamic Island app selection.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root.parent)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
app_url = origin + '/candy-vault-timer/'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script('''
            window.__focusCalls = 0;
            window.focus = () => window.__focusCalls++;
            Object.defineProperty(window, 'launchQueue', {value: {
                setConsumer(callback) {window.__launchConsumer = callback;}
            }});
        ''')
        page.goto(app_url)
        manifest_url = page.locator('link[rel=manifest]').get_attribute('href')
        manifest = page.evaluate('async href => (await fetch(href)).json()', manifest_url)
        resolved_manifest = urljoin(app_url, manifest_url)
        for key in ['id', 'start_url', 'scope']:
            assert urljoin(resolved_manifest, manifest[key]) == app_url
        assert urljoin(resolved_manifest, './') == app_url, 'Existing app identity must remain stable'
        assert not (origin + '/scouting-fotojacht/').startswith(urljoin(resolved_manifest, manifest['scope']))
        assert manifest['launch_handler']['client_mode'] == 'focus-existing'
        cdp = page.context.new_cdp_session(page)
        parsed = cdp.send('Page.getAppManifest')
        assert not parsed['errors'], parsed['errors']
        page.evaluate('window.__launchConsumer({targetURL: location.href})')
        assert page.evaluate('window.__focusCalls===1 && !ctx')
        page.click('#enter')
        page.wait_for_selector('#welcome[hidden]', state='attached', timeout=30000)
        page.click('#start')
        page.wait_for_function('run && !startingRun')
        page.evaluate('window.__originalRun=run;window.__originalSources=[...sources];window.__originalContext=ctx;window.__originalStart=run.wallStartedAt')
        page.evaluate('''window.__launchConsumer({targetURL: location.origin+'/candy-vault-timer/?launch=media'});
            window.__launchConsumer({targetURL: location.origin+'/scouting-fotojacht/'});''')
        assert page.url == app_url
        assert page.evaluate('''window.__focusCalls===3 && run===window.__originalRun &&
            ctx===window.__originalContext && run.wallStartedAt===window.__originalStart &&
            window.__originalSources.every(source=>sources.has(source)) && !run.paused && !player.paused''')
        assert not errors, errors
        browser.close()
    print('PASS: explicit shared-origin app scope, stable existing identity, browser manifest parsing, and relaunch preserving live countdown/audio. iOS tap routing requires a device check.')
finally:
    server.shutdown()
