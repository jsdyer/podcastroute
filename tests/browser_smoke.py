"""Exercise directory, queue and privacy flows at the real project subpath."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
FEED = {'id': 42, 'title': 'Curiosity <b>Radio</b>', 'author': 'Research desk', 'description': 'Science and ideas', 'language': 'en-CA', 'url': 'https://example.org/feed.xml', 'link': 'https://example.org/', 'categories': {'1': 'Science'}}
EPISODES = [{'id': 8, 'title': 'A short planet story', 'duration': 1200, 'enclosureUrl': 'https://example.org/short.mp3', 'datePublished': 1700000000}, {'id': 9, 'title': 'The long discussion', 'duration': 5400, 'enclosureUrl': 'https://example.org/long.mp3'}, {'id': 10, 'title': '<img src=x onerror=alert(1)>Unknown length'}]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
def main():
    screenshots = ROOT / 'browser-checks'; screenshots.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT / 'dist', Path(temporary) / 'podcastroute')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                opts = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
                browser = p.chromium.launch(**opts)
                page = browser.new_page(viewport={'width': 1280, 'height': 1000}); errors = []; requests=[]
                page.on('pageerror', lambda e: errors.append(str(e)))
                def gateway(route):
                    url=route.request.url; requests.append(url)
                    data = {'items': EPISODES} if '/episodes?' in url else {'feed': FEED} if '/feed?' in url else {'feeds': [FEED]}
                    route.fulfill(json={'fetched_at': '2026-11-25T12:00:00Z', 'data': data})
                page.route('https://coolcode-visitor-api.jeffdyer.workers.dev/api/podcastroute/**', gateway)
                page.route('https://example.org/**', lambda route: route.abort())
                page.goto(f'http://127.0.0.1:{server.server_port}/podcastroute/')
                page.locator('#query').fill('marine archaeology'); page.locator('#search-form button').click()
                page.get_by_role('heading', name='Curiosity Radio', exact=True).wait_for()
                assert any('q=marine+archaeology' in u for u in requests)
                page.locator('#results').get_by_role('button', name='Follow', exact=True).click()
                assert page.locator('#sub-count').inner_text() == '1'
                page.locator('#results').get_by_role('button', name='Explore episodes').click()
                page.locator('#episodes .episode').nth(2).wait_for()
                assert page.locator('#episodes img').count() == 0
                page.locator('#max-minutes').fill('30'); page.locator('#include-unknown').uncheck()
                assert page.locator('#episodes .episode').count() == 1
                page.locator('#episodes').get_by_role('button', name='Add to queue').click()
                assert page.locator('#queue-count').inner_text() == '1'
                assert page.evaluate("localStorage.getItem('coolcode:podcastroute:workspace:v1')") is None
                page.locator('#remember').check()
                page.evaluate("const k='coolcode:podcastroute:workspace:v1'; const w=JSON.parse(localStorage.getItem(k)); w.progress['8']=300; localStorage.setItem(k,JSON.stringify(w));")
                page.reload()
                assert page.locator('#queue-count').inner_text() == '1'
                page.locator('[data-tab="queue"]').click()
                page.get_by_role('heading', name='A short planet story', exact=True).wait_for()
                page.locator('#queue-list').get_by_role('button',name='Listen',exact=True).click()
                page.evaluate("const a=document.getElementById('audio'); Object.defineProperty(a,'duration',{value:1200,configurable:true}); Object.defineProperty(a,'currentTime',{value:0,writable:true,configurable:true}); a.dispatchEvent(new Event('timeupdate'));")
                assert page.evaluate("JSON.parse(localStorage.getItem('coolcode:podcastroute:workspace:v1')).progress['8']") == 300
                page.evaluate("document.getElementById('audio').dispatchEvent(new Event('loadedmetadata'))")
                assert page.locator('#audio').evaluate('(a)=>a.currentTime') == 300
                page.locator('#mark-played').click()
                page.evaluate("const a=document.getElementById('audio'); a.currentTime=400; a.dispatchEvent(new Event('timeupdate'));")
                assert page.evaluate("JSON.parse(localStorage.getItem('coolcode:podcastroute:workspace:v1')).progress['8']") == 1200
                with page.expect_download() as download:
                    page.locator('#export-json').click()
                assert download.value.suggested_filename == 'podcast-route-workspace.json'
                page.screenshot(path=str(screenshots / 'desktop.png'), full_page=True)
                page.set_viewport_size({'width':390,'height':844})
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
                page.screenshot(path=str(screenshots / 'mobile.png'), full_page=True)
                page.locator('#remember').uncheck()
                assert page.evaluate("localStorage.getItem('coolcode:podcastroute:workspace:v1')") is None
                assert not errors, errors
                browser.close()
            print('Browser checks passed: arbitrary topic, filters, queue, subscriptions, opt-in persistence, export and mobile layout')
        finally: server.shutdown()
if __name__ == '__main__': main()
