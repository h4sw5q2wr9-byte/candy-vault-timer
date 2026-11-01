'use strict';
const $=id=>document.getElementById(id);
const APP_NAME='The Candy Vault Timer';
let liveMediaTitle=true;try{liveMediaTitle=localStorage.getItem('candyVault.liveMediaTitle')!=='false';}catch{}
function setText(element,value){if(element.textContent!==value)element.textContent=value;}
function setPageTitle(value){if(document.title!==value)document.title=value;}
const ui={};for(const id of ['timer','sub','status','bar','setup','start','pause','reset','hint','minutes','seconds','nowPlaying','screenLabel','resumeAudio','runPanel'])ui[id]=$(id);
const MEDIA_ARTWORK=[{"src": "./media-artwork-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "./media-artwork.png", "sizes": "512x512", "type": "image/png"}];
// Matching musical and sample positions; preserve the opening, then repeat without a cycle fade.
const AMBIENCE_LOOP={start:579726/44100,end:3514051/44100};
// Approved D mix: long overlap, with melody and ticks entering together.
const HANDOFF={duration:8,midpoint:5.085170068027211,eqTail:.2};
const TRACK_EDITS={intro:{start:0,end:26.8},close:{start:0,end:123.75},cutscene:{start:0,end:31.67}};
const sources=new Set();let ctx,master,analyser,mediaDestination,player,buffers,loading,setupSource,run=null,resetting=false,repairing=false,setupPaused=false,setupPausedAt=0,transportChanging=false,lastSignalAt=Date.now(),lastRepairAt=0,stallAt=0,clockProbe=null;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fmt=seconds=>{const n=Math.max(0,Math.ceil(seconds-1e-6));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
function duration(){return clamp(Math.trunc(Number(ui.minutes.value)||0),0,999)*60+clamp(Math.trunc(Number(ui.seconds.value)||0),0,59);}
function normalize(){ui.minutes.value=clamp(Math.trunc(Number(ui.minutes.value)||0),0,999);ui.seconds.value=clamp(Math.trunc(Number(ui.seconds.value)||0),0,59);}
function level(){if(master)master.gain.setTargetAtTime(Number($('volume').value)/100,ctx.currentTime,.05);}
function trimBuffer(buffer,edit){if(!edit)return buffer;const first=Math.round(edit.start*buffer.sampleRate),last=Math.min(buffer.length,Math.round(edit.end*buffer.sampleRate)),output=ctx.createBuffer(buffer.numberOfChannels,last-first,buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++)output.getChannelData(c).set(buffer.getChannelData(c).subarray(first,last));return output;}
async function prepareCloseIntro(buffer){
 // Render only the short EQ entrance once. Seeking then preserves filter history,
 // and no live filters or repeated audio analysis run during the countdown.
 const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 const offline=new Offline(buffer.numberOfChannels,Math.round((HANDOFF.duration+HANDOFF.eqTail)*buffer.sampleRate),buffer.sampleRate),source=offline.createBufferSource();source.buffer=buffer;
 let tail=source;
 for(const [type,frequency,depth] of [['lowshelf',100,-4],['highshelf',900,-8]]){
  const eq=offline.createBiquadFilter();eq.type=type;eq.frequency.value=frequency;
  const curve=Float32Array.from({length:129},(_,i)=>depth*(.5+.5*Math.cos(Math.PI*i/128)));
  eq.gain.setValueCurveAtTime(curve,0,HANDOFF.duration);eq.gain.setValueAtTime(0,HANDOFF.duration);tail.connect(eq);tail=eq;
 }
 tail.connect(offline.destination);source.start();return offline.startRendering();
}
function ambienceOffset(seconds){
 const rate=buffers.ambience.sampleRate,position=Math.round(seconds*rate),start=Math.round(AMBIENCE_LOOP.start*rate),end=Math.round(AMBIENCE_LOOP.end*rate);
 return (position<end?position:start+(position-start)%(end-start))/rate;
}
function handoffAngle(seconds){
 const a=HANDOFF.midpoint,b=HANDOFF.duration-a,d0=(Math.PI/4)/a,d1=(Math.PI/4)/b;
 const m0=Math.max(0,((2*a+b)*d0-a*d1)/(a+b)),m2=Math.max(0,((2*b+a)*d1-b*d0)/(a+b));
 const w1=2*b+a,w2=b+2*a,m1=(w1+w2)/(w1/d0+w2/d1),t=clamp(seconds,0,HANDOFF.duration);
 const left=t<=a,h=left?a:b,u=(left?t:t-a)/h,y=left?0:Math.PI/4,m=left?m0:m1,n=left?m1:m2;
 return (2*u*u*u-3*u*u+1)*y+(u*u*u-2*u*u+u)*h*m+(-2*u*u*u+3*u*u)*(y+Math.PI/4)+(u*u*u-u*u)*h*n;
}
function handoffEnvelope(after=0,ambience=false){
 const times=new Set([0,after,after+HANDOFF.midpoint,after+HANDOFF.duration]);
 for(let i=0;i<=256;i++)times.add(after+HANDOFF.duration*i/256);
 if(ambience)for(let i=0;i<=32;i++)times.add(5*i/32);
 return [...times].sort((a,b)=>a-b).map(t=>[t,ambience?Math.sin(clamp(t/5,0,1)*Math.PI/2)*Math.cos(handoffAngle(t-after)):Math.sin(handoffAngle(t-after))]);
}
function envelopeAt(points,time){
 if(time<=points[0][0])return points[0][1];
 for(let i=1;i<points.length;i++){const [end,value]=points[i];if(time<=end){const [start,previous]=points[i-1];return previous+(value-previous)*(time-start)/(end-start);}}
 return points.at(-1)[1];
}
async function audio(){
 if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:44100,latencyHint:'playback'});master=ctx.createGain();analyser=ctx.createAnalyser();analyser.fftSize=256;master.connect(analyser);level();createTransport();ctx.onstatechange=audioStateChanged;installMediaControls();}
 // Both calls happen inside the original user gesture, before waiting for decoding.
 const previousTransport=transportChanging;transportChanging=true;try{const resume=ctx.resume(),play=player.play();await Promise.all([resume,play]);}finally{transportChanging=previousTransport;}setupPaused=false;setupPausedAt=0;
 if(!loading)loading=(async()=>{const assets=JSON.parse($('audio-assets').textContent),pairs=await Promise.all(Object.entries(assets).map(async([key,b64])=>{let bytes;if(typeof b64==='object'&&b64.src){const response=await fetch(b64.src);if(!response.ok)throw new Error('Could not load '+key+' audio');bytes=await response.arrayBuffer();}else{const raw=atob(b64),data=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);bytes=data.buffer;}const buffer=trimBuffer(await ctx.decodeAudioData(bytes),TRACK_EDITS[key]);return [key,buffer];}));const decoded=Object.fromEntries(pairs);decoded.closeIntro=await prepareCloseIntro(decoded.close);buffers=decoded;})();
 try{await loading;}catch(e){loading=null;throw e;}
}
function createTransport(){
 // The native media element carries actual audible audio, not a silent keepalive.
 mediaDestination=ctx.createMediaStreamDestination();mediaDestination.channelCount=2;mediaDestination.channelCountMode='explicit';analyser.connect(mediaDestination);
 for(const track of mediaDestination.stream.getAudioTracks()){try{track.contentHint='music';if(track.applyConstraints)track.applyConstraints({channelCount:{ideal:2},sampleRate:{ideal:44100},autoGainControl:false,echoCancellation:false,noiseSuppression:false}).catch(()=>{});}catch{}}
 player=$('soundtrack');player.srcObject=mediaDestination.stream;player.volume=1;player.muted=false;player.playbackRate=1;player.defaultPlaybackRate=1;
 player.addEventListener('pause',()=>{if(transportChanging)return;const mode=mediaMode();if(mode==='ending'){keepEndingPlaying();return;}if(mode==='rip'){pauseSetup(true);return;}if(run&&!run.paused)setPaused(true);});
 player.addEventListener('play',()=>{stallAt=0;if(transportChanging)return;if(mediaMode()==='rip'){if(setupPaused)pauseSetup(false);else mediaState('playing');return;}if(mediaMode()==='ending'){mediaState('none');return;}if(run?.paused)setPaused(false);});
 player.addEventListener('playing',()=>{stallAt=0;});
 for(const event of ['stalled','waiting','error'])player.addEventListener(event,()=>{if(!stallAt)stallAt=Date.now();});
}
function track(key,when,{offset=0,length,volume=1,loop=false,fadeIn=0,fadeOut=0,elapsed=0,curve='linear',envelope}={}){
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffers[key];source.loop=loop;if(loop&&key==='ambience'){source.loopStart=AMBIENCE_LOOP.start;source.loopEnd=AMBIENCE_LOOP.end;}source.connect(gain);gain.connect(master);
 const total=length??(loop?Infinity:buffers[key].duration-offset),originalTotal=total+elapsed,inFade=Math.min(fadeIn,originalTotal/2),outFade=Math.min(fadeOut,originalTotal-inFade);
 const fade=x=>curve==='power'?Math.sin(clamp(x,0,1)*Math.PI/2):clamp(x,0,1);
 const valueAt=e=>volume*Math.min(inFade?fade(e/inFade):1,outFade?fade((originalTotal-e)/outFade):1)*(envelope?envelopeAt(envelope,e):1);
 gain.gain.setValueAtTime(valueAt(elapsed),when);
 // Schedule the envelope in audio time, including correct values after recovery.
 const times=new Set();
 function ramp(from,to){if(to<=from)return;const count=curve==='power'?32:1;times.add(from);for(let i=1;i<=count;i++)times.add(from+(to-from)*i/count);}
 if(inFade>elapsed)ramp(0,inFade);
 if(outFade)ramp(originalTotal-outFade,originalTotal);
 if(envelope)for(const [at] of envelope)times.add(at);
 for(const at of [...times].filter(t=>t>elapsed&&t<=originalTotal).sort((a,b)=>a-b))gain.gain.linearRampToValueAtTime(valueAt(at),when+at-elapsed);
 source.start(when,offset);if(Number.isFinite(total))source.stop(when+total);
 const item={source,gain,key,when,end:when+total};sources.add(item);source.onended=()=>{sources.delete(item);source.disconnect();gain.disconnect();};return item;
}
function stopAll(){for(const item of sources){try{item.source.stop();}catch{}item.source.disconnect();item.gain.disconnect();}sources.clear();setupSource=null;}
function fadeAll(seconds){const now=ctx.currentTime;for(const item of sources){item.gain.gain.cancelScheduledValues(now);item.gain.gain.setValueAtTime(item.gain.gain.value,now);item.gain.gain.linearRampToValueAtTime(0,now+seconds);try{item.source.stop(now+seconds);}catch{}}setupSource=null;}
function setupMusic(){if(buffers&&!setupSource){setupSource=track('rip',ctx.currentTime+.02,{loop:true,volume:.22,fadeIn:1.6});mediaState('playing');}}
function stage(key){if(document.body.dataset.state!==key)document.body.dataset.state=key;}
function setupView(outro=false){
 stage('setup');ui.runPanel.hidden=true;ui.setup.hidden=false;ui.start.hidden=false;ui.pause.hidden=true;ui.reset.hidden=true;ui.resumeAudio.hidden=true;setText(ui.status,outro?'SESSION COMPLETE':'READY');ui.screenLabel.textContent='TIME REMAINING';setText(ui.hint,outro?'Your next session starts here.':'Choose your time. Enter the vault.');setText(ui.nowPlaying,outro?'The final scene is playing.':'R.I.P. · Set up your next session');setPageTitle(APP_NAME);ui.start.textContent='INVOKE';ui.pause.textContent=run?.paused?'RESUME':'PAUSE';
}
function error(message){setText(ui.hint,message);ui.hint.classList.add('error');}
$('enter').onclick=async()=>{const button=$('enter');button.disabled=true;button.textContent='CONNECTING…';$('loadStatus').hidden=false;$('loadStatus').textContent='Loading the soundtrack…';try{await audio();setupMusic();document.body.classList.add('powered');$('welcome').hidden=true;syncMusicButton();ui.start.focus();}catch{button.disabled=false;button.textContent='TRY AGAIN';$('loadStatus').textContent='Audio could not start. Tap to try again.';}};
ui.start.onclick=async()=>{
 if((run&&!run.returned)||resetting)return;normalize();const total=duration();if(total<1){error('Set a duration of at least one second.');return;}ui.start.disabled=true;
 try{
  await audio();fadeAll(.65);ui.hint.classList.remove('error');
  const origin=ctx.currentTime+.08,countdown=origin+20;
  run={origin,countdown,total,wallStartedAt:Date.now()+80,paused:false,audioInterrupted:false,returned:false,completed:false};buildTimeline(run);
  scheduleRun(true);mediaState('playing');requestWake();lastSignalAt=Date.now();
  ui.setup.hidden=true;ui.runPanel.hidden=false;ui.start.hidden=true;ui.pause.hidden=false;ui.pause.disabled=false;ui.pause.textContent='PAUSE';ui.reset.hidden=false;ui.reset.disabled=false;render();
 }catch{stopAll();run=null;setupView();setupMusic();error('Audio was interrupted. Tap Invoke to try again.');}finally{ui.start.disabled=false;}
};
ui.pause.onclick=()=>setPaused(!run?.paused);ui.resumeAudio.onclick=()=>recoverAudio(true);
$('liveMediaTitle').checked=liveMediaTitle;$('liveMediaTitle').onchange=()=>{liveMediaTitle=$('liveMediaTitle').checked;try{localStorage.setItem('candyVault.liveMediaTitle',String(liveMediaTitle));}catch{}lastMediaKey='';syncMediaPanel(true);render();};
$('keepAwake').onchange=()=>{$('keepAwake').checked?requestWake():releaseWake();};
ui.reset.onclick=async()=>{resetting=true;stopAll();run=null;releaseWake();setupView();try{await audio();setupMusic();}catch{error('Tap Invoke to enable audio.');}finally{resetting=false;}};
for(const id of ['minutes','seconds'])ui[id].addEventListener('input',()=>{document.querySelectorAll('.preset').forEach(p=>p.classList.toggle('selected',Number(p.dataset.seconds)===duration()));syncMediaPanel(true);});
document.querySelectorAll('.preset').forEach(p=>p.onclick=()=>{ui.minutes.value=Math.floor(Number(p.dataset.seconds)/60);ui.seconds.value=Number(p.dataset.seconds)%60;ui.minutes.dispatchEvent(new Event('input'));});
$('test').onclick=()=>{ui.minutes.value=0;ui.seconds.value=15;ui.minutes.dispatchEvent(new Event('input'));};$('volume').oninput=level;$('musicPause').onclick=()=>pauseSetup(!setupPaused);
function buildTimeline(r){
 const {origin,countdown,total}=r,deadline=countdown+total,closingEnd=deadline,closing=Math.max(countdown,closingEnd-buffers.close.duration),ambienceStart=origin+21.54,introEnd=origin+buffers.intro.duration;
 const cutscene=deadline-7,returnAt=cutscene+17,end=cutscene+buffers.cutscene.duration;
 const plans=[{key:'intro',at:origin,end:introEnd,volume:1,fadeOut:buffers.intro.duration-21.54}];
 const hasAmbience=closing>ambienceStart;
 if(hasAmbience){
  const before=closing-ambienceStart,envelope=handoffEnvelope(before,true);
  plans.push({key:'ambience',at:ambienceStart,end:closing,loop:true,volume:1,envelope});
  // On its final pass, continue into the original tail instead of wrapping
  // halfway through the transition and truncating the outgoing melody.
  plans.push({key:'ambience',at:closing,end:closing+HANDOFF.duration,offset:ambienceOffset(before),volume:1,envelope:envelope.map(([t,v])=>[t-before,v])});
 }
 const closeLength=closingEnd-closing;
 if(hasAmbience){
  plans.push({key:'closeIntro',at:closing,end:closing+buffers.closeIntro.duration,volume:1,envelope:handoffEnvelope()});
  plans.push({key:'close',at:closing+buffers.closeIntro.duration,end:closingEnd,offset:buffers.closeIntro.duration,volume:1,fadeOut:4,curve:'power'});
 }else plans.push({key:'close',at:closing,end:closingEnd,offset:Math.max(0,buffers.close.duration-closeLength),volume:1,fadeIn:Math.min(6,closeLength/3),fadeOut:Math.min(4,closeLength/2),curve:'power'});
 plans.push({key:'cutscene',at:cutscene,end,volume:1,fadeIn:.02,fadeOut:.15});
 plans.push({key:'rip',at:end,end:Infinity,loop:true,volume:.22,fadeIn:1.6});
 Object.assign(r,{deadline,closingEnd,closing,ambienceStart,cutscene,returnAt,end,plans});
}
function seekTimer(position){
 if(!mediaControlsEnabled()||run.returned||!Number.isFinite(position))return;
 const r=run,target=r.countdown+clamp(position,0,r.total);
 // Shift the shared wall-clock origin. Music, zero, and outro cues all move together.
 r.wallStartedAt+=(runTime()-target)*1000;
 if(!r.paused)scheduleRun();
 lastMediaKey='';render();requestWake();
}
function adjustTimer(deltaRemaining){
 if(!mediaControlsEnabled()||run.returned||!Number.isFinite(deltaRemaining))return;const r=run,t=runTime();
 if(t<r.countdown){r.total=clamp(r.total+deltaRemaining,1,59999);buildTimeline(r);if(!r.paused)scheduleRun();}
 else{
  const remaining=clamp(Math.max(0,r.deadline-t)+deltaRemaining,0,59999);
  if(remaining>r.total){r.total=Math.ceil(remaining);buildTimeline(r);}
  seekTimer(r.total-remaining);
 }
 ui.minutes.value=Math.floor(r.total/60);ui.seconds.value=r.total%60;syncMediaPanel(true);render();
}
let lastMediaKey='',lastPositionKey='',lastPositionAt=0;
function syncMediaPanel(force=false){
 if(!ctx||!navigator.mediaSession)return;force=force||lastMediaKey==='';updateMediaControls();const r=run,t=r?runTime():0,active=r&&!r.returned,mode=mediaMode();
 const remaining=active?clamp(r.deadline-t,0,r.total):duration();
 const title=active?(liveMediaTitle?fmt(remaining)+' remaining':fmt(r.total)+' timer'):fmt(duration())+' ready';
 const artist=active?(r.paused?'Paused · '+APP_NAME:t<r.countdown?'Opening · '+APP_NAME:APP_NAME):(mode==='rip'&&setupPaused?'R.I.P. paused · '+APP_NAME:r&&!r.completed?'Final scene · Prepare your next session':APP_NAME);
 const position=active?clamp(t-r.countdown,0,r.total):0,key=[title,artist,active&&r.paused,mode].join('|');
 if(force||key!==lastMediaKey){
  lastMediaKey=key;
  try{
   if(!navigator.mediaSession.metadata&&window.MediaMetadata)navigator.mediaSession.metadata=new window.MediaMetadata({title,artist,album:'R.I.P. · Revenant Interface Program',artwork:MEDIA_ARTWORK});
   else if(navigator.mediaSession.metadata){if(navigator.mediaSession.metadata.title!==title)navigator.mediaSession.metadata.title=title;if(navigator.mediaSession.metadata.artist!==artist)navigator.mediaSession.metadata.artist=artist;}
  }catch{}
 }
 // Native media progress advances on its own. Publish snapshots for state changes,
 // seeks, and occasional correction in live-title mode, not every screen refresh.
 const positionKey=[mode,Boolean(r&&t>=r.countdown),r?.total,r?.paused,r?.origin].join('|');
 if(force||positionKey!==lastPositionKey||(liveMediaTitle&&mode==='timer'&&Date.now()-lastPositionAt>=10000)){
  lastPositionKey=positionKey;lastPositionAt=Date.now();
  try{if(navigator.mediaSession.setPositionState){if(mode==='timer'&&t>=r.countdown)navigator.mediaSession.setPositionState({duration:r.total,position,playbackRate:1});else navigator.mediaSession.setPositionState();}}catch{}
 }
}

function runTime(){return run?run.origin+((run.paused?run.pausedAt:setupPaused&&run.completed?setupPausedAt:Date.now())-run.wallStartedAt)/1000:0;}
function scheduleRun(keepSetup=false){
 if(!run||run.paused)return;const r=run,t=runTime();if(!keepSetup)stopAll();r.scheduledVirtual=t;r.scheduledAudio=ctx.currentTime;
 for(const plan of r.plans){if(t>=plan.end)continue;const elapsed=Math.max(0,t-plan.at),at=ctx.currentTime+Math.max(0,plan.at-t);let offset=(plan.offset||0)+elapsed;if(plan.loop){if(plan.key==='ambience')offset=ambienceOffset(offset);else offset%=buffers[plan.key].duration;}track(plan.key,at,{...plan,offset,length:plan.end-Math.max(t,plan.at),elapsed});}
}
function audioStateChanged(){
 if(!run||run.paused||setupPaused||repairing)return;if(ctx.state==='running'){if(run.audioInterrupted){run.audioInterrupted=false;scheduleRun();}}else if(ctx.state==='suspended'||ctx.state==='interrupted'){run.audioInterrupted=true;recoverAudio();}render();
}
async function recoverAudio(force=false){
 if(!ctx||repairing||run?.paused||setupPaused)return;repairing=true;const currentRun=run;
 try{
  if(force||stallAt&&Date.now()-stallAt>3000){transportChanging=true;player.pause();await ctx.suspend();await ctx.resume();transportChanging=false;stallAt=0;if(run===currentRun){if(run)scheduleRun();else{stopAll();setupMusic();}}}
  else if(ctx.state!=='running')await ctx.resume();
  if(run!==currentRun)return;
  player.muted=false;player.volume=1;if(player.paused||force)await player.play();level();
  if(run){const expected=run.scheduledVirtual+(ctx.currentTime-run.scheduledAudio);if(run.audioInterrupted||Math.abs(runTime()-expected)>.25){run.audioInterrupted=false;scheduleRun();}}
  else if(!setupSource)setupMusic();
 }catch{if(run)run.audioInterrupted=true;}finally{transportChanging=false;repairing=false;render();}
}
function watchdog(){
 if(!ctx||run?.paused||setupPaused||repairing){clockProbe=null;return;}
 const now=Date.now(),activeClock=ctx.currentTime;if(clockProbe&&ctx.state==='running'&&now-clockProbe.wall>1000&&(activeClock-clockProbe.audio)<(now-clockProbe.wall)/4000){clockProbe={wall:now,audio:activeClock};recoverAudio(true);return;}clockProbe={wall:now,audio:activeClock};
 recoverAudio();
 // Exact zero output for several seconds indicates a lost graph, not the cutscene's short pauses.
 const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);let power=0;for(const sample of data)power+=sample*sample;
 if(power/data.length>1e-10)lastSignalAt=Date.now();
 const active=[...sources].some(s=>ctx.currentTime>=s.when&&ctx.currentTime<s.end);
 if(active&&Date.now()-lastSignalAt>6500&&Date.now()-lastRepairAt>15000){lastRepairAt=Date.now();lastSignalAt=Date.now();recoverAudio(true);}
}
let wakeLock=null,wakePending=false,wakeGeneration=0;
async function releaseWake(){wakeGeneration++;const old=wakeLock;wakeLock=null;if(old)try{await old.release();}catch{}}
async function requestWake(){if(!navigator.wakeLock||wakeLock||wakePending||!$('keepAwake').checked||document.visibilityState==='hidden'||!run||run.paused||run.returned)return;wakePending=true;const generation=wakeGeneration;try{const lock=await navigator.wakeLock.request('screen');if(generation!==wakeGeneration||!run||run.paused||run.returned||!$('keepAwake').checked||document.visibilityState==='hidden'){await lock.release();return;}wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});}catch{}finally{wakePending=false;}}
let lastControlMode=null;
function mediaMode(){if(!run)return 'rip';const t=runTime();return t<run.deadline?'timer':t<run.end?'ending':'rip';}
function mediaControlsEnabled(){return mediaMode()==='timer';}
function updateMediaControls(force=false){
 if(!ctx||!navigator.mediaSession)return;const mode=mediaMode();if(!force&&mode===lastControlMode)return;lastControlMode=mode;
 const timerAction=fn=>details=>{if(mediaControlsEnabled())return fn(details);};
 const handlers={pause:()=>setPaused(true),play:()=>run.paused?setPaused(false):recoverAudio(),stop:()=>ui.reset.onclick(),seekto:details=>seekTimer(details.seekTime),seekbackward:details=>adjustTimer(Number.isFinite(details?.seekOffset)?details.seekOffset:30),seekforward:details=>adjustTimer(-(Number.isFinite(details?.seekOffset)?details.seekOffset:30)),previoustrack:()=>adjustTimer(60),nexttrack:()=>adjustTimer(-60)};
 for(const [action,handler] of Object.entries(handlers)){
  let callback=mode==='timer'?timerAction(handler):null;
  if(mode==='rip'&&(action==='pause'||action==='play'))callback=()=>{if(mediaMode()==='rip')return pauseSetup(action==='pause');};
  try{navigator.mediaSession.setActionHandler(action,callback);}catch{}
 }
 mediaState(mode==='timer'?(run.paused?'paused':'playing'):mode==='rip'?(setupPaused?'paused':'playing'):'none');
}
function keepEndingPlaying(){
 if(mediaMode()!=='ending'||ctx.state!=='running'||transportChanging)return;
 transportChanging=true;player.play().catch(()=>{}).finally(()=>{transportChanging=false;mediaState('none');});
}
function syncMusicButton(){const visible=Boolean(ctx&&buffers&&mediaMode()==='rip');$('musicPause').hidden=!visible;if(visible){$('musicPause').textContent=setupPaused?'PLAY':'PAUSE';$('musicPause').setAttribute('aria-label',setupPaused?'Resume R.I.P. music':'Pause R.I.P. music');if(setupPaused){setText(ui.status,'MUSIC PAUSED');setText(ui.nowPlaying,'R.I.P. · Paused');}else if(!run){setText(ui.status,'READY');setText(ui.nowPlaying,'R.I.P. · Ready when you are');}}}

function installMediaControls(){
 try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
 if(!navigator.mediaSession)return;
 try{if(window.MediaMetadata)navigator.mediaSession.metadata=new window.MediaMetadata({title:'The Candy Vault Timer',artist:'R.I.P. · Revenant Interface Program',album:'The Candy Vault',artwork:MEDIA_ARTWORK});}catch{}
 updateMediaControls(true);
 syncMediaPanel(true);
}
function mediaState(state){try{if(navigator.mediaSession)navigator.mediaSession.playbackState=mediaMode()==='ending'?'none':state;}catch{}}
async function pauseSetup(paused){
 if(!ctx||mediaMode()!=='rip'||setupPaused===paused)return;transportChanging=true;
 try{
  if(paused){if(run){const needsSetup=!run.returned||!run.completed;run.completed=true;run.returned=true;if(needsSetup)setupView();}setupPausedAt=Date.now();setupPaused=true;ui.resumeAudio.hidden=true;player.pause();await ctx.suspend();mediaState('paused');}
  else{await ctx.resume();await player.play();if(run&&run.completed)run.wallStartedAt+=Date.now()-setupPausedAt;setupPaused=false;setupPausedAt=0;clockProbe=null;level();mediaState('playing');}
  lastMediaKey='';render();
 }catch{error('Tap Play to resume R.I.P. music.');}finally{transportChanging=false;}
}
async function setPaused(paused){
 if(!mediaControlsEnabled()||!run||run.paused===paused||ui.pause.disabled)return;ui.pause.disabled=true;const r=run;transportChanging=true;
 try{if(paused){r.pausedAt=Date.now();r.paused=true;player.pause();await releaseWake();await ctx.suspend();mediaState('paused');}else{await ctx.resume();await player.play();if(run!==r)return;r.wallStartedAt+=Date.now()-r.pausedAt;r.paused=false;r.audioInterrupted=false;scheduleRun();level();mediaState('playing');requestWake();}ui.pause.textContent=r.paused?'RESUME':'PAUSE';render();}catch{error('Tap Resume audio to reconnect.');}finally{transportChanging=false;ui.pause.disabled=false;}
}
function onVisibility(){if(document.visibilityState!=='hidden'){recoverAudio();requestWake();}else releaseWake();render();}
function render(){
 syncMediaPanel();syncMusicButton();if(!run||!ctx)return;const t=runTime(),r=run;
 if(t>=r.returnAt&&!r.returned){r.returned=true;setupView(true);releaseWake();}
 if(r.returned){
  if(t>=r.end&&!r.completed){r.completed=true;setupView();}
  setText(ui.nowPlaying,setupPaused?'R.I.P. · Paused':r.completed?'R.I.P. · Ready when you are':'Final scene · Prepare your next session');setText(ui.status,setupPaused?'MUSIC PAUSED':r.paused?'PAUSED':r.completed?'READY':'SESSION COMPLETE');
 }else{
  let key,status,sub,playing;
  if(t<r.countdown){key='intro';status='OPENING';sub='YOUR TIME BEGINS AT THE TICK';playing='The Vault · Opening';setText(ui.hint,'Your timer starts in '+Math.ceil(r.countdown-t)+' seconds.');}
  else if(t<r.closing){key=t<r.ambienceStart?'intro':'ambience';status='IN SESSION';sub='ONE THING AT A TIME';playing=t<r.origin+buffers.intro.duration?'Opening ticks + ambience':'The Vault · Ambience';setText(ui.hint,'Stay a little longer. Keep your focus.');}
  else if(t<r.deadline){key='closing';status='LOW TIME';sub='THE FINAL STRETCH';playing=t>=r.cutscene?'Low time + final scene':'The Vault · Low time';setText(ui.hint,'You’re almost there.');}
  else{key='cutscene';status='COMPLETE';sub='YOU MADE IT';playing='The final scene';setText(ui.hint,'Take a breath.');}
  ui.pause.disabled=mediaMode()!=='timer';ui.reset.disabled=mediaMode()==='ending';stage(key);setText(ui.status,r.paused?'PAUSED':status);setText(ui.sub,r.paused?'TAKE YOUR TIME':sub);setText(ui.timer,fmt(Math.min(r.total,Math.max(0,r.deadline-t))));setText(ui.nowPlaying,playing);const percent=clamp((r.deadline-t)/r.total*100,0,100);const barWidth=(Math.round(percent*10)/10)+'%';if(ui.bar.style.width!==barWidth)ui.bar.style.width=barWidth;ui.bar.parentElement.setAttribute('aria-valuenow',String(Math.round(percent)));setPageTitle((liveMediaTitle?ui.timer.textContent:fmt(r.total)+' timer')+' · '+APP_NAME);
 }
 ui.resumeAudio.hidden=setupPaused||r.paused||(ctx.state==='running'&&!player.paused);if(!ui.resumeAudio.hidden)setText(ui.hint,'The timer is running. Reconnect audio.');
}
setInterval(render,100);setInterval(watchdog,1500);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pageshow',onVisibility);window.addEventListener('focus',onVisibility);document.addEventListener('pointerdown',()=>{if(ctx&&!run?.paused&&(ctx.state!=='running'||player.paused))recoverAudio();});
if(navigator.mediaDevices?.addEventListener)navigator.mediaDevices.addEventListener('devicechange',()=>recoverAudio(true));
if(!navigator.wakeLock)$('keepAwake').disabled=true;setupView();
