from pathlib import Path
from datetime import datetime,timezone
import re,base64,json,hashlib
root=Path(__file__).resolve().parent
url='https://h4sw5q2wr9-byte.github.io/candy-vault-timer/'
manifest=json.loads((root/'audio-manifest.json').read_text())
for info in manifest.values():
 assert hashlib.sha256((root/info['src']).read_bytes()).hexdigest()==info['sha256'],'Audio asset changed without updating its verified manifest'
app=(root/'app.js').read_text();style=(root/'style.css').read_text().replace('__PIXEL_FONT__',base64.b64encode((root/'vault-pixels.woff').read_bytes()).decode());shell=(root/'shell.html').read_text()
art=[{'src':'./media-artwork-192.png','sizes':'192x192','type':'image/png'},{'src':'./media-artwork.png','sizes':'512x512','type':'image/png'}]
runtime=re.sub(r'const MEDIA_ARTWORK=.*?;\n','const MEDIA_ARTWORK='+json.dumps(art)+';\n',app,count=1)
(root/'app-runtime.js').write_text(runtime)
def icon(name):return 'data:image/png;base64,'+base64.b64encode((root/name).read_bytes()).decode()
def page(standalone=False):
 assets={key:base64.b64encode((root/info['src']).read_bytes()).decode() if standalone else {'src':info['src']+'?v='+info['sha256'][:12]} for key,info in manifest.items()}
 text=shell.replace('__STYLE__',style).replace('__ASSETS__',json.dumps(assets))
 text=text.replace('__ICON_192__',icon('media-artwork-192.png') if standalone else './media-artwork-192.png').replace('__ICON_180__',icon('apple-touch-icon.png') if standalone else './apple-touch-icon.png').replace('__MANIFEST_LINK__','' if standalone else '<link rel="manifest" href="./manifest.webmanifest">')
 if standalone:return text.replace('__APP__',app)
 return text.replace('<script>\n__APP__</script>','<script src="./app-runtime.js?v='+hashlib.sha256(runtime.encode()).hexdigest()[:12]+'" defer></script>')
(root/'index.html').write_text(page());(root/'standalone.html').write_text(page(True))
(root/'manifest.webmanifest').write_text(json.dumps({'id':'./','name':'The Candy Vault Timer','short_name':'The Candy Vault Timer','description':'An unofficial DOORS-inspired music and focus timer.','start_url':'./','scope':'./','display':'standalone','background_color':'#1d181b','theme_color':'#20100b','icons':[{'src':'./media-artwork-192.png','sizes':'192x192','type':'image/png','purpose':'any'},{'src':'./media-artwork.png','sizes':'512x512','type':'image/png','purpose':'any'}]},indent=2)+'\n')
(root/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+url+'sitemap.xml\n')
(root/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+url+'</loc><lastmod>'+datetime.now(timezone.utc).date().isoformat()+'</lastmod></url></urlset>\n')
print('Built cached web version:',(root/'index.html').stat().st_size,'HTML bytes;',len(runtime.encode()),'script bytes')
print('Built self-contained offline version:',(root/'standalone.html').stat().st_size,'bytes')
