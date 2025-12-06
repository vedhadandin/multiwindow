
// Multi-window Healthy Habit Tracker (Approach A)
// Simple SPA router + floating window manager + basic habit logic (localStorage + alarms)

const STORAGE = 'hh_multi_v1';
let data = { habits: [] };

const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav-btn');
const floatContainer = document.getElementById('float-container');
const floatingTemplate = document.getElementById('floating-template');
const installBtn = document.getElementById('installBtn');

function todayISO(){ return new Date().toISOString().slice(0,10); }
function log(msg){ console.log(msg); }

// Load / Save
function load(){ const raw = localStorage.getItem(STORAGE); if(raw) data = JSON.parse(raw); renderHabits(); }
function save(){ localStorage.setItem(STORAGE, JSON.stringify(data)); }

// Router
function navigate(route){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const target = document.getElementById('view-' + route);
  if(target) target.classList.add('active');
  navButtons.forEach(b=>b.classList.toggle('active', b.dataset.route === route));
}
document.querySelectorAll('[data-route]').forEach(btn=> btn.addEventListener('click', ()=> navigate(btn.dataset.route)));
navButtons.forEach(b=> b.addEventListener('click', ()=> navigate(b.dataset.route)));

// Floating window manager
function openFloating(title, html){
  const tpl = document.getElementById('floating-template');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.fw-title').textContent = title;
  node.querySelector('.fw-body').innerHTML = html;
  floatContainer.appendChild(node);
  node.style.left = Math.random()*20 + 10 + '%';
  node.style.top = Math.random()*20 + 10 + '%';
  node.querySelector('.fw-close').addEventListener('click', ()=> node.remove());
  node.querySelector('.fw-minimize').addEventListener('click', ()=> node.style.display = 'none');
  // make draggable (pointer events)
  makeDraggable(node);
  return node;
}

function makeDraggable(el){
  let startX=0, startY=0, origX=0, origY=0, dragging=false;
  const header = el.querySelector('.fw-header');
  header.addEventListener('pointerdown', (e)=>{
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  header.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.transform = `translate(${dx + origX}px, ${dy + origY}px)`;
  });
  header.addEventListener('pointerup', (e)=>{
    dragging = false;
    // update origin from transform
    const tr = el.style.transform;
    if(tr && tr.startsWith('translate(')){
      const vals = tr.replace('translate(','').replace(')','').split(',');
      origX = parseFloat(vals[0]) || 0;
      origY = parseFloat(vals[1]) || 0;
    }
  });
}

// Habits UI
const habitsList = document.getElementById('habitsList');
const noHabits = document.getElementById('noHabits');
function renderHabits(){
  habitsList.innerHTML = '';
  if(!data.habits || data.habits.length===0){ noHabits.style.display='block'; return; } else noHabits.style.display='none';
  data.habits.forEach(h=>{
    const div = document.createElement('div'); div.className='habit';
    const left = document.createElement('div'); left.textContent = h.name + (h.time?(' • '+h.time):'');
    const right = document.createElement('div');
    const mark = document.createElement('button'); mark.className='btn'; const doneToday = h.history && h.history[todayISO()];
    if(doneToday){ mark.textContent='Done'; mark.disabled=true; } else { mark.textContent='Mark'; mark.addEventListener('click', ()=>{ if(!h.history) h.history={}; h.history[todayISO()] = true; save(); renderHabits(); }); }
    const detail = document.createElement('button'); detail.className='btn'; detail.textContent='Open'; detail.addEventListener('click', ()=> openHabitDetail(h.id));
    const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.addEventListener('click', ()=>{ if(confirm('Delete?')){ data.habits = data.habits.filter(x=>x.id!==h.id); save(); renderHabits(); }});
    right.appendChild(mark); right.appendChild(detail); right.appendChild(del);
    div.appendChild(left); div.appendChild(right);
    habitsList.appendChild(div);
  });
}

// Habit detail floating window
function openHabitDetail(id){
  const h = data.habits.find(x=>x.id===id);
  if(!h) return;
  const html = `
    <h3>${h.name}</h3>
    <p class="muted">Reminder: ${h.time || 'none'}</p>
    <div class="row">
      <button id="fwMark" class="btn primary">Mark Done</button>
      <button id="fwSnooze" class="btn">Snooze 10m</button>
    </div>
  `;
  const win = openFloating(h.name, html);
  win.querySelector('#fwMark').addEventListener('click', ()=>{
    if(!h.history) h.history = {};
    h.history[todayISO()] = true; save(); renderHabits(); win.remove();
  });
  win.querySelector('#fwSnooze').addEventListener('click', ()=>{
    setTimeout(()=>{ triggerReminder(h); }, 10*60*1000);
    win.remove();
  });
}

// Add habit floating form when user clicks + New
document.getElementById('openAddFloating').addEventListener('click', ()=>{
  const html = `
    <form id="fwForm">
      <input id="fwName" placeholder="Habit name" required/>
      <label>Reminder</label>
      <input id="fwTime" type="time"/>
      <div class="row"><button class="btn primary" type="submit">Save</button></div>
    </form>
  `;
  const win = openFloating('Add Habit', html);
  const form = win.querySelector('#fwForm');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = win.querySelector('#fwName').value.trim();
    const time = win.querySelector('#fwTime').value;
    if(!name) return alert('Enter name');
    data.habits.push({ id: Date.now().toString(), name, time, history: {} });
    save(); renderHabits(); win.remove();
  });
});

// Trigger reminder (play beep + SW notif)
function playBeep(d=700,f=880,v=0.08){ try{ const ctx = new (window.AudioContext||window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sine'; o.frequency.value=f; g.gain.value=v; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{ o.stop(); try{ ctx.close(); }catch(e){} }, d); }catch(e){ console.warn('beep failed', e); } }
function triggerReminder(h){
  playBeep();
  if(navigator.serviceWorker && navigator.serviceWorker.controller){
    navigator.serviceWorker.controller.postMessage({ type:'show-notification', title:'Habit: '+h.name, body: 'Time to do '+h.name });
  } else if(Notification.permission === 'granted'){
    new Notification('Habit: '+h.name, { body: 'Time to do '+h.name });
  } else {
    alert('Reminder: '+h.name);
  }
}

// Alarm checker
function checkAlarms(){
  const now = new Date(); const cur = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  data.habits.forEach(h=>{
    if(h.time && h.time === cur){
      if(!h._last || h._last !== cur){
        h._last = cur; save(); triggerReminder(h);
      }
    }
  });
}

// Service worker register
if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js').then(()=>log('SW reg')).catch(e=>console.warn(e)); }

// Install prompt
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredInstall = e; installBtn.style.display = 'inline-block'; });
installBtn.addEventListener('click', async ()=>{ if(!deferredInstall) return; deferredInstall.prompt(); const choice = await deferredInstall.userChoice; deferredInstall = null; installBtn.style.display = 'none'; });

// Boot
load();
setInterval(checkAlarms, 20000);

// handle messages from SW (notification clicks)
navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', event=>{
  const d = event.data;
  if(d && d.type === 'notification-action'){
    console.log('Notif action', d.action);
  }
});
