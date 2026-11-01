from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':512,'height':512},device_scale_factor=1)
 page.set_content('<style>html,body{margin:0;background:transparent}</style>'+root.joinpath('media-artwork.svg').read_text())
 page.screenshot(path=str(root/'media-artwork.png'),omit_background=True)
 page.set_viewport_size({'width':192,'height':192})
 page.add_style_tag(content='svg{width:192px;height:192px}')
 page.screenshot(path=str(root/'media-artwork-192.png'),omit_background=True)
 browser.close()
