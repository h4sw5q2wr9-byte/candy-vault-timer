from pathlib import Path
import re,base64
root=Path(__file__).resolve().parent
current=(root/'index.html').read_text()
assets=re.search(r'<script id="audio-assets" type="application/json">(.*?)</script>',current,re.S)[1]
html=(root/'shell.html').read_text().replace('__STYLE__',(root/'style.css').read_text().replace('__PIXEL_FONT__',base64.b64encode((root/'vault-pixels.woff').read_bytes()).decode())).replace('__APP__',(root/'app.js').read_text()).replace('__ASSETS__',assets)
(root/'index.html').write_text(html)
print('Built standalone index.html from current source and original embedded audio.')
