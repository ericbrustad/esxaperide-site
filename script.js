let TEST_MODE = true;
(function(){ const p=new URLSearchParams(location.search); if(p.has('test')) TEST_MODE = p.get('test')!=='0'; })();

let map, userMarker, watchId=null, geofences=[], targetMarker=null;
let nextOrder=1, visited=new Set(), lastTriggerAt=0;
const COOLDOWN_MS = 30*1000;

const BP_KEY = 'backpackItems';
function loadBackpack(){ try{ return JSON.parse(localStorage.getItem(BP_KEY) || '[]'); }catch{return []} }
function saveBackpack(items){ localStorage.setItem(BP_KEY, JSON.stringify(items)); }
function addToBackpack(item){
  const items = loadBackpack();
  if(items.some(x => x.id === item.id)) return;
  items.push(item);
  saveBackpack(items);
}
function youTubeId(url){
  try{
    const u = new URL(url);
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    return u.searchParams.get('v') || '';
  }catch{ return ''; }
}
function bpThumb(url){
  const id = youTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

function updateModeBadge(){ const b=document.getElementById('modeBadge'); if(b) b.textContent = TEST_MODE ? 'TEST MODE' : 'LIVE MODE'; }

const RedIcon = new L.Icon({ iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', shadowSize:[41,41], className:'target-red' });
(function(){ const s=document.createElement('style'); s.textContent=`.target-red{ filter:hue-rotate(-90deg) saturate(2); }`; document.head.appendChild(s); })();

async function loadData(){ const r=await fetch('data.json?cachebust='+Date.now()); geofences=await r.json(); }
function initMap(){
  map=L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
  if(geofences.length){ map.setView([geofences[0].lat, geofences[0].lng], 17); } else { map.setView([44.9778,-93.2650], 12); }
  renderObjectiveList(); renderTargetOnly(); updateModeBadge();
  if(TEST_MODE){
    map.on('click', ()=>{
      const g=getNextTarget(); if(!g) return;
      const now=Date.now(); if(now-lastTriggerAt<COOLDOWN_MS) return;
      lastTriggerAt=now; handleCheckpoint(g);
    });
  }
}

function renderObjectiveList(){
  const list=document.getElementById('checkpointList'); if(!list) return;
  list.innerHTML='';
  const g=getNextTarget();
  const li=document.createElement('li');
  li.innerHTML=g?`<strong>${g.title}</strong><br><small>${g.radius_m} m radius</small>`:'All objectives complete.';
  list.appendChild(li);
}
function getNextTarget(){ const ordered=[...geofences].sort((a,b)=>(a.order??0)-(b.order??0)); return ordered.find(g=>(g.order??0)===nextOrder); }
function renderTargetOnly(){
  if(targetMarker){ map.removeLayer(targetMarker); targetMarker=null; }
  const g=getNextTarget(); if(!g) return;
  L.circle([g.lat,g.lng],{radius:g.radius_m,color:'#ef4444',weight:1,fillOpacity:0.12}).addTo(map);
  targetMarker=L.marker([g.lat,g.lng],{icon:RedIcon}).addTo(map).bindPopup(`<b>${g.title}</b><br>${g.clue_text}`);
}
function setStatus(t){ const el=document.getElementById('status'); if(el) el.textContent=t; }
function updateUserMarker(pos){ const latlng=[pos.coords.latitude,pos.coords.longitude]; if(!userMarker){ const div=L.divIcon({className:'pulse-dot'}); userMarker=L.marker(latlng,{icon:div,title:'You'}).addTo(map); } else userMarker.setLatLng(latlng); }
function metersBetween(a,b){ const R=6371000,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lng-a.lng)*Math.PI/180,lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180; const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function inTarget(pos){ const g=getNextTarget(); if(!g) return null; const here={lat:pos.coords.latitude,lng:pos.coords.longitude}; return metersBetween(here,{lat:g.lat,lng:g.lng})<=g.radius_m?g:null; }

let ytApiReadyPromise=null, activePlayer=null;
function loadYouTubeAPI(){ if(ytApiReadyPromise) return ytApiReadyPromise; ytApiReadyPromise=new Promise((resolve)=>{ const tag=document.createElement('script'); tag.src='https://www.youtube.com/iframe_api'; const first=document.getElementsByTagName('script')[0]; first.parentNode.insertBefore(tag,first); window.onYouTubeIframeAPIReady=()=>resolve(); }); return ytApiReadyPromise; }

function handleCheckpoint(g){
  addToBackpack({ id:g.id, title:g.title, clue_text:g.clue_text||'', video_url:g.video_url||'', thumb_url:bpThumb(g.video_url||''), ts:Date.now() });
  showVideoOverlay(g.video_url || '');
  advanceSequence(g);
}

async function showVideoOverlay(url){
  const ch=document.getElementById('chime'); ch && ch.play().catch(()=>{});
  const overlay=document.getElementById('videoOverlay'); const wrap=document.getElementById('videoWrap');
  if(!overlay||!wrap){ alert('Video overlay missing'); return; }
  overlay.style.display='block'; wrap.innerHTML='';
  let vidId=''; try{ const u=new URL(url); vidId=u.searchParams.get('v')||(u.hostname.includes('youtu.be')?u.pathname.slice(1):''); }catch{}
  if(vidId){
    await loadYouTubeAPI();
    const div=document.createElement('div'); div.id='yt-'+Math.random().toString(36).slice(2); wrap.appendChild(div);
    activePlayer=new YT.Player(div.id,{videoId:vidId,playerVars:{autoplay:1,controls:1,rel:0,modestbranding:1,playsinline:1},
      events:{onReady:(e)=>{ try{ e.target.unMute(); e.target.setVolume(100); e.target.playVideo(); }catch{} },
              onStateChange:(e)=>{ if(e.data===YT.PlayerState.UNSTARTED||e.data===YT.PlayerState.PAUSED){ showTapToPlay(()=>{ try{ e.target.unMute(); e.target.playVideo(); }catch{} }); } }}});
  } else if(url){
    const v=document.createElement('video'); v.src=url; v.autoplay=true; v.playsInline=true; v.controls=true; v.muted=false; wrap.appendChild(v); v.play().catch(()=>{ showTapToPlay(()=>v.play().catch(()=>{})); });
  } else {
    wrap.innerHTML='<div style="color:#eee;padding:20px;text-align:center">No video URL.</div>';
  }
  const el=wrap.firstElementChild; if(el&&el.requestFullscreen){ el.requestFullscreen().catch(()=>{}); }
}
function showTapToPlay(action){ const b=document.createElement('button'); b.textContent='▶ Tap to play with sound'; b.style='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 16px;border:1px solid #2a3242;background:#121a28;color:#e6e6e6;border-radius:12px;z-index:10002'; b.addEventListener('click',()=>{ b.remove(); action&&action(); }); document.getElementById('videoOverlay').appendChild(b); }
function closeOverlay(){ const overlay=document.getElementById('videoOverlay'); const wrap=document.getElementById('videoWrap'); if(activePlayer&&activePlayer.destroy){ try{ activePlayer.destroy(); }catch{} } activePlayer=null; wrap.innerHTML=''; overlay.style.display='none'; }
function advanceSequence(g){ if(!visited.has(g.id)){ visited.add(g.id); nextOrder=(g.order??nextOrder)+1; renderObjectiveList(); renderTargetOnly(); } }

function wireMusicToggle(){ const btn=document.getElementById('musicToggle'); const bed=document.getElementById('music2'); const label=()=>{ btn.textContent = bed.paused ? 'Music: Off' : 'Music: On'; }; btn.addEventListener('click', async ()=>{ if(bed.paused){ try{ await bed.play(); }catch{} } else { bed.pause(); } label(); }); label(); }

function openBackpack(){
  const modal=document.getElementById('bpModal'); const list=document.getElementById('bpList');
  const items=loadBackpack().sort((a,b)=>a.ts-b.ts);
  list.innerHTML='';
  if(!items.length){
    const empty=document.createElement('div'); empty.className='bpEmpty'; empty.textContent='No items collected yet.'; list.appendChild(empty);
  } else {
    for(const it of items){
      const row=document.createElement('div'); row.className='bpItem';
      const img=document.createElement('img'); img.src=it.thumb_url || ''; img.alt='';
      const meta=document.createElement('div'); meta.className='meta';
      const title=document.createElement('div'); title.className='title'; title.textContent=it.title || 'Unknown';
      const clue=document.createElement('div'); clue.className='clue'; clue.textContent=it.clue_text || '';
      const link=document.createElement('a'); link.href=it.video_url || '#'; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent='Open video';
      meta.appendChild(title); if(clue.textContent) meta.appendChild(clue); meta.appendChild(link);
      row.appendChild(img); row.appendChild(meta);
      img.addEventListener('click', ()=>{ if(it.video_url) window.open(it.video_url, '_blank'); });
      list.appendChild(row);
    }
  }
  modal.style.display='block';
}
function closeBackpack(){ const modal=document.getElementById('bpModal'); modal.style.display='none'; }

async function begin(){
  localStorage.setItem('backpackItems', '[]'); // This line clears the backpack for a new mission
  await loadData();
  initMap();
  visited.clear();
  nextOrder=1;
  lastTriggerAt=0;
  updateModeBadge();
  try{ await document.getElementById('stingMission').play(); }catch{}
  document.getElementById('backpackBtn').addEventListener('click', openBackpack);
  document.getElementById('bpClose').addEventListener('click', closeBackpack);
  wireMusicToggle();
  if(TEST_MODE){
    setStatus('Test mode: click map to trigger objectives.'); document.getElementById('beginBtn').disabled=true; document.getElementById('stopBtn').disabled=false; return;
  }
  if(!navigator.geolocation){ setStatus('Geolocation not supported.'); return; }
  setStatus('Locating…'); document.getElementById('beginBtn').disabled=true; document.getElementById('stopBtn').disabled=false;
  watchId=navigator.geolocation.watchPosition((pos)=>{
    updateUserMarker(pos);
    setStatus(`Lat ${pos.coords.latitude.toFixed(5)}, Lng ${pos.coords.longitude.toFixed(5)}, acc ±${Math.round(pos.coords.accuracy)} m`);
    const now=Date.now(); if(now-lastTriggerAt<COOLDOWN_MS) return;
    const g=inTarget(pos); if(g){ lastTriggerAt=now; handleCheckpoint(g); }
  },(err)=>{ setStatus('Location error: '+err.message); },{enableHighAccuracy:true, maximumAge:3000, timeout:20000});
}
function stopWatch(){ if(watchId!==null){ navigator.geolocation.clearWatch(watchId); watchId=null; } document.getElementById('beginBtn').disabled=false; document.getElementById('stopBtn').disabled=true; setStatus('Stopped.'); }

document.addEventListener('DOMContentLoaded', ()=>{
  const beginBtn=document.getElementById('beginBtn'); if(beginBtn) beginBtn.addEventListener('click', begin);
  const stopBtn=document.getElementById('stopBtn'); if(stopBtn) stopBtn.addEventListener('click', stopWatch);
  const closeBtn=document.getElementById('overlayClose'); if(closeBtn) closeBtn.addEventListener('click', closeOverlay);
});