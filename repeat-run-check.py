"""Exercise repeated five-minute sessions and reject audio from an old mix."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import json
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.click('#enter');page.wait_for_selector('#welcome[hidden]',state='attached',timeout=30000)
  page.fill('#minutes','5');page.fill('#seconds','0');page.click('#start');page.wait_for_function('run&&!startingRun')
  reports=[]
  for scenario in ['finished','ending still playing','R.I.P. paused']:
   page.evaluate('''scenario=>{
    const target=scenario==='ending still playing'?run.cutscene+18:run.end+.25;
    run.wallStartedAt=Date.now()-(target-run.origin)*1000;scheduleRun();render();
    analyser.fftSize=8192;analyser.smoothingTimeConstant=0;
    window.__oldMix=mixBus;window.__probe=ctx.createOscillator();window.__probeGain=ctx.createGain();
    __probe.frequency.value=3344*ctx.sampleRate/8192;__probeGain.gain.value=.015;
    __probe.connect(__probeGain);__probeGain.connect(__oldMix);__probe.start();
    window.__toneLevel=()=>{const bins=new Float32Array(analyser.frequencyBinCount);analyser.getFloatFrequencyData(bins);return Math.max(-160,...bins.slice(3342,3347));};
   }''',scenario)
   page.wait_for_timeout(300);before=page.evaluate('__toneLevel()');assert before>-80,before
   if scenario=='R.I.P. paused':
    page.evaluate('player.pause()');page.wait_for_function('setupPaused')
   page.click('#start');page.wait_for_function('run&&!run.returned&&!startingRun&&!transportStarting')
   page.wait_for_timeout(500)
   result=page.evaluate('''()=>({oldToneDb:__toneLevel(),oldMixMuted:__oldMix.gain.value===0,newMix:mixBus!==__oldMix,liveSources:[...sources].length,currentSources:[...sources].filter(item=>item.bus===mixBus).length,oldSources:[...sources].filter(item=>item.bus===__oldMix).length,ripSources:[...sources].filter(item=>item.bus===mixBus&&item.key==='rip').length,context:ctx.state,paused:player.paused,introDelay:run.countdown-run.origin})''')
   assert result['newMix'] and result['oldMixMuted'],result
   assert result['oldSources']==0 and result['currentSources']==7 and result['liveSources']==7 and result['ripSources']==1,result
   assert result['context']=='running' and not result['paused'] and abs(result['introDelay']-20)<1e-6,result
   assert result['oldToneDb']<before-25,(before,result)
   if scenario=='ending still playing':
    page.wait_for_timeout(2800)
    assert page.evaluate('[...sources].every(item=>item.bus===mixBus)')
    assert page.evaluate('__toneLevel()')<before-25
   page.evaluate('__probe.stop();__probe.disconnect();__probeGain.disconnect();')
   reports.append({'scenario':scenario,'probeBeforeDb':before,**result})
  assert not errors,errors
  print('PASS: repeated five-minute timelines, early ending restart and paused R.I.P. restart; old high-frequency probe removed; one current score and fixed 20s intro:',json.dumps(reports))
  browser.close()
finally:server.shutdown()
