from playwright.sync_api import sync_playwright
from pathlib import Path
import json
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
root=Path(__file__).resolve().parent
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.__mediaActions={};window.__mediaPosition=null;if(navigator.mediaSession){const session=navigator.mediaSession;const register=session.setActionHandler.bind(session);session.setActionHandler=(action,handler)=>{window.__mediaActions[action]=handler;register(action,handler);};const position=session.setPositionState.bind(session);session.setPositionState=value=>{window.__mediaPosition=value;position(value);};}''')
 audio_requests=[];page.on('request',lambda r:audio_requests.append(r.url) if '/assets/audio/' in r.url else None)
 page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
 assert page.title()=='The Candy Vault Timer'
 assert page.locator('meta[name=apple-mobile-web-app-title]').get_attribute('content')=='The Candy Vault Timer'
 touch_url=page.locator('link[rel=apple-touch-icon]').get_attribute('href')
 assert touch_url.startswith('./apple-touch-icon-') and touch_url.endswith('.png')
 manifest_url=page.locator('link[rel=manifest]').get_attribute('href')
 assert manifest_url.startswith('./manifest.webmanifest?v=')
 # Actual advertised home-screen images must decode, match their declared
 # dimensions, and be completely opaque (the OS supplies its own corners).
 assert page.evaluate('''async href=>{const image=new Image();image.src=href;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=180;const draw=canvas.getContext('2d');draw.drawImage(image,0,0);const pixels=draw.getImageData(0,0,180,180).data;return image.naturalWidth===180&&image.naturalHeight===180&&pixels.every((v,i)=>i%4!==3||v===255);}''',touch_url)
 assert not audio_requests,'Music must not delay first page render'
 manifest=page.evaluate("async href=>await (await fetch(href)).json()",manifest_url);assert manifest['name']=='The Candy Vault Timer'
 assert manifest['id']=='./' and manifest['start_url']=='./'
 for icon in manifest['icons']:
  assert '?v=' in icon['src']
  assert page.evaluate('async icon=>{const image=new Image();image.src=icon.src;await image.decode();return image.naturalWidth+\"x\"+image.naturalHeight===icon.sizes;}',icon)
 page.screenshot(path=str(root/'welcome-preview.png'))
 page.click('#enter');page.wait_for_selector('#welcome[hidden]',state='attached',timeout=30000);page.evaluate('document.fonts.ready');page.wait_for_timeout(500)
 assert page.locator('#keepCounting').is_checked(),'Keep counting defaults on'
 assert len(audio_requests)==5,audio_requests
 page.screenshot(path=str(root/'desktop-preview.png'))
 print('Desktop:',page.evaluate('({context:ctx.state,paused:player.paused,stream:player.srcObject?.active,overflow:document.documentElement.scrollWidth>innerWidth})'))
 for width in [320,375,390,430,768,1440]:
  page.set_viewport_size({'width':width,'height':900 if width>600 else 812})
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'Overflow {width}'
  assert page.locator('#start').is_visible()
  assert page.evaluate('''[...document.querySelectorAll('.preset')].every(card=>{const time=card.querySelector('.grave-time'),svg=card.querySelector('svg').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(time);const rect=range.getBoundingClientRect(),scale=Math.min(svg.width/150,svg.height/228),offset=(svg.width-150*scale)/2;return time.scrollWidth<=time.clientWidth+1&&rect.left>=svg.left+offset+18*scale-1&&rect.right<=svg.left+offset+132*scale+1;})'''),f'Gravestone text overflow {width}'
  assert page.evaluate('''(()=>{const a=document.querySelector('#minutes').getBoundingClientRect(),b=document.querySelector('#seconds').getBoundingClientRect(),c=document.querySelector('.duration-colon').getBoundingClientRect();return Math.abs((a.x+a.width/2+b.x+b.width/2)/2-(c.x+c.width/2))<.75;})()'''),f'Duration center offset {width}'
  if width==375:page.screenshot(path=str(root/'phone-preview.png'),full_page=True)
 page.set_viewport_size({'width':375,'height':667})
 button=page.locator('#start').bounding_box();assert button['y']+button['height']<=667
 page.set_viewport_size({'width':1280,'height':900})
 page.fill('#minutes','0');page.fill('#seconds','15');page.click('#start');page.wait_for_timeout(800)
 print('Playback:',page.evaluate('({context:ctx.state,paused:player.paused,plans:run.plans.map(p=>({key:p.key,at:p.at-run.origin,end:p.end-run.origin}))})'))
 assert page.evaluate('run.closingEnd-(run.cutscene)===7')
 assert page.evaluate('run.returnAt-run.cutscene===17')
 # Actual browser metadata includes decodable PNG artwork and a finite timer position.
 assert page.evaluate("navigator.mediaSession.metadata.artwork.length===2")
 assert page.evaluate("async()=>{const image=new Image();image.src=navigator.mediaSession.metadata.artwork[1].src;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const draw=canvas.getContext('2d');draw.drawImage(image,0,0);const rgba=draw.getImageData(0,0,512,512).data;return image.naturalWidth===512&&image.naturalHeight===512&&rgba.every((v,i)=>i%4!==3||v===255);}")
 page.evaluate('run.wallStartedAt=Date.now()-(run.countdown-run.origin+5)*1000;scheduleRun();render()')
 assert page.evaluate("navigator.mediaSession.metadata.title==='00:10 remaining'")
 assert page.evaluate('Math.abs(window.__mediaPosition.position-5)<.1&&window.__mediaPosition.duration===15')
 page.locator('.settings').evaluate('(node)=>node.open=true')
 page.uncheck('#liveMediaTitle');assert page.evaluate("navigator.mediaSession.metadata.title==='00:15 timer'")
 page.evaluate('window.__staticPosition=window.__mediaPosition;window.__oldTimer=ui.timer.textContent')
 page.wait_for_timeout(1200)
 assert page.evaluate("navigator.mediaSession.metadata.title==='00:15 timer'&&window.__staticPosition===window.__mediaPosition&&ui.timer.textContent!==window.__oldTimer")
 assert page.evaluate("localStorage.getItem('candyVault.liveMediaTitle')==='false'")
 page.check('#liveMediaTitle');page.locator('.settings').evaluate('(node)=>node.open=false')
 page.evaluate('window.__mediaActions.seekto({seekTime:2})')
 assert page.evaluate('Math.abs(run.deadline-runTime()-13)<.1')
 page.evaluate('window.__mediaActions.previoustrack()')
 assert page.evaluate('Math.abs(run.deadline-runTime()-73)<.1')
 page.evaluate('window.__mediaActions.nexttrack()')
 assert page.evaluate('Math.abs(run.deadline-runTime()-13)<.1')
 # Default: other-media and native pause silence music while the timer advances.
 page.evaluate('player.pause()');page.wait_for_timeout(200);assert page.evaluate('run.musicPaused&&!run.paused&&player.paused')
 silent_time=page.evaluate('runTime()');page.wait_for_timeout(400);assert page.evaluate('runTime()')>silent_time+.3
 page.evaluate('watchdog();onVisibility()');page.wait_for_timeout(100);assert page.evaluate('run.musicPaused&&player.paused')
 assert page.locator('#resumeAudio').is_visible()
 page.locator('#resumeAudio').click();page.wait_for_timeout(150);assert page.evaluate('!run.musicPaused&&!run.paused&&!player.paused')
 # The explicit in-app button still pauses the whole timer.
 page.click('#pause');page.wait_for_function('run.paused&&!changingTimer');frozen=page.evaluate('runTime()');page.wait_for_timeout(200);assert abs(page.evaluate('runTime()')-frozen)<.01
 page.click('#pause');page.wait_for_function('!run.paused&&!changingTimer')
 # Turning the saved setting off restores native pause-timer behavior.
 page.locator('.settings').evaluate('(node)=>node.open=true');page.uncheck('#keepCounting');page.locator('.settings').evaluate('(node)=>node.open=false')
 assert page.evaluate("localStorage.getItem('candyVault.keepCounting')==='false'")
 page.evaluate('player.pause()');page.wait_for_timeout(150);assert page.evaluate('run.paused&&!run.musicPaused&&player.paused')
 page.evaluate('player.play()');page.wait_for_timeout(150);assert page.evaluate('!run.paused&&!player.paused')
 page.locator('.settings').evaluate('(node)=>node.open=true');page.check('#keepCounting');page.locator('.settings').evaluate('(node)=>node.open=false')
 # Confirm non-zero PCM reaches the actual native media element transport.
 peak=page.evaluate('(()=>{const a=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs))})()')
 print('Signal:',peak);assert peak>0
 print('Quality:',page.evaluate('({rate:ctx.sampleRate,hint:player.srcObject.getAudioTracks()[0].contentHint,settings:player.srcObject.getAudioTracks()[0].getSettings()})'))
 assert page.evaluate("ctx.sampleRate===44100&&player.srcObject.getAudioTracks()[0].contentHint==='music'")
 page.screenshot(path=str(root/'running-preview.png'))
 # At zero every timer action is unavailable and the ending continues.
 page.evaluate('player.pause()');page.wait_for_timeout(100);assert page.evaluate('run.musicPaused')
 page.evaluate('window.__staleSeek=window.__mediaActions.seekto;run.wallStartedAt=Date.now()-(run.deadline-run.origin)*1000;scheduleRun();render()')
 page.wait_for_function('run.finishAttempted&&!run.musicPaused&&!player.paused')
 assert page.evaluate('Object.values(window.__mediaActions).every(handler=>handler===null)&&window.__mediaPosition===undefined')
 assert page.locator('#pause').is_disabled();assert page.locator('#reset').is_disabled()
 page.evaluate('window.__staleSeek({seekTime:0});player.pause()');page.wait_for_timeout(100)
 assert page.evaluate('runTime()>=run.deadline&&!player.paused&&!run.paused')
 # Seek the playback clock through the 17-second return cue, then into the RIP handoff.
 page.evaluate('run.wallStartedAt=Date.now()-(run.returnAt-run.origin+.1)*1000;scheduleRun();render()')
 assert page.locator('#setup').is_visible();assert page.locator('#runPanel').is_hidden()
 assert page.evaluate('run.returned&&!run.completed')
 page.fill('#minutes','25');assert page.evaluate('run.total')>=15
 page.evaluate('run.wallStartedAt=Date.now()-(run.end-run.origin+.2)*1000;scheduleRun();render()')
 page.wait_for_timeout(200);assert page.evaluate('run.completed&&!player.paused')
 assert page.locator('#start').is_visible();assert page.locator('#minutes').input_value()=='25'
 assert page.evaluate('typeof window.__mediaActions.pause==="function"&&window.__mediaActions.seekto===null&&window.__mediaPosition===undefined')
 page.evaluate('window.__mediaActions.pause()');page.wait_for_timeout(100);assert page.evaluate('player.paused&&setupPaused&&!run.paused')
 page.evaluate('watchdog()');page.wait_for_timeout(100);assert page.evaluate('player.paused&&setupPaused')
 page.evaluate('window.__mediaActions.play()');page.wait_for_timeout(100);assert page.evaluate('!player.paused&&!setupPaused&&!run.paused')
 # A forced repair reconnects audio without altering session timing or leaving it paused.
 page.evaluate('recoverAudio(true)');page.wait_for_timeout(200)
 assert page.evaluate("ctx.state==='running'&&!player.paused&&!run.paused")
 assert not errors,errors
 print('PASS: gravestone containment at 320/375/390/430/768/1440px, music-only idle pause and lock-at-zero, gradual ticking fade, full music gain, native media stream playing, audio graph signal, native pause/resume events, original 7s/17s cues, editable setup return, automatic RIP, repair recovery, real artwork decoding, finite media position, and media seek/minute controls; no page errors; home-screen metadata, deferred cached audio, static-title persistence, and offline HTML playback.')
 page.set_viewport_size({'width':375,'height':667})
 page.fill('#minutes','20');page.fill('#seconds','0');page.click('#start');page.wait_for_function('run&&!run.returned&&!ui.start.disabled')
 page.evaluate('run.wallStartedAt=Date.now()-(run.countdown-run.origin+80)*1000;scheduleRun();render()')
 assert page.evaluate('''(()=>{const panel=document.querySelector('#runPanel').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(document.querySelector('#timer'));const digits=range.getBoundingClientRect();return Math.abs(panel.x+panel.width/2-digits.x-digits.width/2)<.75;})()''')
 page.wait_for_timeout(180);page.screenshot(path=str(root/'phone-running-preview.png'))
 controls=page.locator('#pause').bounding_box();assert controls['y']+controls['height']<=667
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 for width in [320,375,390,430]:
  page.set_viewport_size({'width':width,'height':812})
  assert page.evaluate('''(()=>{const panel=document.querySelector('#runPanel').getBoundingClientRect(),timer=document.querySelector('#timer');return ['00:00','11:11','999:59'].every(value=>{timer.textContent=value;const range=document.createRange();range.selectNodeContents(timer);const digits=range.getBoundingClientRect();return Math.abs(panel.x+panel.width/2-digits.x-digits.width/2)<.75&&digits.width<=panel.width;});})()'''),f'Timer centering or width {width}'
 for width,height in [(844,390),(932,430),(1280,590),(667,375)]:
  page.set_viewport_size({'width':width,'height':height});page.evaluate('render()')
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'Landscape horizontal overflow {width}'
  assert page.locator('#pause').bounding_box()['y']+page.locator('#pause').bounding_box()['height']<=height,f'Landscape pause clipped {width}'
  assert page.locator('#reset').bounding_box()['y']+page.locator('#reset').bounding_box()['height']<=height,f'Landscape reset clipped {width}'
  assert page.locator('#timer').bounding_box()['y']>=0,f'Landscape timer clipped {width}'
  if width==844:page.screenshot(path=str(root/'landscape-preview.png'),full_page=True)
 page.set_viewport_size({'width':430,'height':932});page.evaluate('render()');page.screenshot(path=str(root/'tall-phone-preview.png'),full_page=True)
 page.locator('.settings').evaluate('(node)=>node.open=true');page.screenshot(path=str(root/'settings-preview.png'),full_page=True)
 assert page.locator('#keepCounting').is_visible()
 page.locator('.settings').evaluate('(node)=>node.open=false')
 page.emulate_media(reduced_motion='reduce');assert page.evaluate("getComputedStyle(document.querySelector('.screen-sweep')).display==='none'")
 assert page.evaluate("document.fonts.check('20px \"Vault Pixels\"')")
 page.locator('.settings').evaluate('(node)=>node.open=true');page.uncheck('#liveMediaTitle');page.uncheck('#keepCounting');page.reload();assert not page.locator('#liveMediaTitle').is_checked();assert not page.locator('#keepCounting').is_checked()
 assert page.title()=='The Candy Vault Timer'
 offline=browser.new_page();offline.goto(f'http://127.0.0.1:{server.server_port}/standalone.html');offline.context.set_offline(True)
 offline.click('#enter');offline.wait_for_selector('#welcome[hidden]',state='attached',timeout=30000)
 assert offline.evaluate("ctx.state==='running'&&!player.paused"),'Standalone audio must work offline'
 browser.close()

server.shutdown()
