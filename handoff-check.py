"""Compare the production scheduler against the user-approved D listening test."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import json
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent
reference=Path('/workspace/candy-vault-tick-tests/D-together.f32')
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/approved-D.f32' and reference.exists():
   body=reference.read_bytes();self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page();page.add_init_script('window.setInterval=()=>0;')
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.click('#enter');page.wait_for_selector('#welcome[hidden]',state='attached',timeout=30000)
  report=page.evaluate('''async()=>{
   const sr=44100,reference=new Float32Array(await (await fetch('/approved-D.f32')).arrayBuffer()),originalContext=ctx;
   transportChanging=true;player.pause();stopAll();await originalContext.suspend();
   const now=Date.now;Date.now=()=>1000000000;
   const reports=[];
   try{
    for(const startInClip of [0,12,16.1]){
     const length=Math.round((28-startInClip)*sr),offline=new OfflineAudioContext(2,length,sr);ctx=offline;master=offline.destination;
     run={origin:0,countdown:20,total:1200,wallStartedAt:Date.now(),paused:false};buildTimeline(run);
     const clipStart=run.closing-8+startInClip;run.wallStartedAt=Date.now()-clipStart*1000;scheduleRun();
     const out=await offline.startRendering();let maxError=0,power=0;
     for(let c=0;c<2;c++){const channel=out.getChannelData(c);for(let i=0;i<channel.length;i++){const d=channel[i]-reference[2*(Math.round(startInClip*sr)+i)+c];maxError=Math.max(maxError,Math.abs(d));power+=d*d;}}
     reports.push({startInClip,maxError,rmsError:Math.sqrt(power/(length*2)),plans:run.plans.map(p=>({key:p.key,at:p.at-run.closing,offset:p.offset||0,loop:Boolean(p.loop)}))});
     stopAll();
    }
   }finally{Date.now=now;}
   return {introPreparedSeconds:buffers.closeIntro.duration,sourceAmbienceSeconds:buffers.ambience.duration,reports};
  }''')
  for case in report['reports']:
   assert case['maxError']<.001 and case['rmsError']<.0001,case
  assert report['sourceAmbienceSeconds']>88
  assert abs(report['introPreparedSeconds']-8.2)<1e-6
  print('PASS: production D mix and recovery inside/after the EQ intro match the approved audio:',json.dumps(report))
  browser.close()
finally:server.shutdown()
