const $ = id => document.getElementById(id);
const localFilePreview = location.protocol === 'file:';
function showLaunchHelp(){ $('setupNotice').hidden = false; }

const modeNames = {
  teja:'TEJA AI Mode', general:'All-rounder AI', study:'Study & Learning', code:'Code Assistant',
  write:'Writing Studio', translate:'Translator', ideas:'Idea Lab'
};
const providerNames = {teja:'TEJA AI Smart', openai:'ChatGPT', gemini:'Gemini', claude:'Claude', deepseek:'DeepSeek'};
let mode = 'teja', chats = [], active = '', attachment = null, busy = false;
let provider = localStorage.getItem('teja_provider') || 'teja';
let autoSpeak = localStorage.getItem('teja_speak') === '1';
let webSearch = localStorage.getItem('teja_websearch') === '1';
let statusInfo = null;

try { chats = JSON.parse(localStorage.getItem('teja_chats') || '[]'); if(!Array.isArray(chats)) chats=[]; } catch { chats = []; }
function save(){ try{ localStorage.setItem('teja_chats', JSON.stringify(chats.slice(0,35))); }catch(e){ console.warn('Chat history storage unavailable'); } }
function current(){ return chats.find(x => x.id === active); }
function newChat(){ active=''; attachment=null; $('attachment').hidden=true; $('messages').innerHTML=''; $('welcome').hidden=false; $('input').value=''; renderHistory(); }
function renderHistory(){ $('history').replaceChildren(); chats.forEach(chat => { const b=document.createElement('button'); b.textContent='◷  '+chat.title; b.onclick=()=>{ active=chat.id; mode=chat.mode||'general'; renderMode(); renderMessages(); $('sidebar').classList.remove('open'); }; $('history').appendChild(b); }); }
function renderMode(){ $('activeLabel').textContent=modeNames[mode]; document.querySelectorAll('.modes [data-mode]').forEach(b=>b.classList.toggle('selected', b.dataset.mode===mode)); }
function updateToggles(){ $('providerSel').value=provider; $('webSearch').checked=webSearch; $('speakToggle').classList.toggle('active', autoSpeak); }
function updateStatusBar(){
  const p = providerNames[provider] || 'Model';
  const ready = !!(statusInfo?.providers?.[provider]?.ready);
  $('statusDot').classList.toggle('live', ready);
  $('statusText').textContent = ready ? `${p} connected` : `${p} demo mode`;
  let extra = ready ? (statusInfo.providers[provider].model || '') : (provider === 'teja' ? 'Connect any one API key for live replies' : `Set ${provider.toUpperCase()} API key`);
  if(webSearch) extra += statusInfo?.google_search ? ' · Google search ready' : ' · Google search not configured';
  $('statusSub').textContent = extra;
  $('versionPill').textContent = `${ready ? '⚡' : '🐺'} ${p}`;
}
function speakText(text){
  if(!autoSpeak || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleaned = text.replace(/[`*#>-]/g,' ').replace(/\s+/g,' ').trim().slice(0,1200);
  const u = new SpeechSynthesisUtterance(cleaned);
  u.rate = 1; u.pitch = 1;
  if(/[\u0900-\u097f]/.test(cleaned)) u.lang = 'hi-IN'; else u.lang = 'en-IN';
  window.speechSynthesis.speak(u);
}
function addMessage(role,text,meta=''){
  const div=document.createElement('div'); div.className='message '+role;
  const avatar=document.createElement('div'); avatar.className='avatar';
  if(role==='assistant'){
    avatar.classList.add('assistant-avatar');
    const logo=document.createElement('img'); logo.src='./teja-icon.png'; logo.alt='TEJA'; avatar.appendChild(logo);
  } else { avatar.textContent='◉'; }
  const content=document.createElement('div'); content.className='bubble'; content.textContent=text;
  if(meta){ const metaDiv=document.createElement('div'); metaDiv.className='meta'; metaDiv.textContent=meta; content.appendChild(metaDiv); }
  div.append(avatar,content); $('messages').appendChild(div); $('scroll').scrollTop=$('scroll').scrollHeight; return div;
}
function renderMessages(){ $('messages').replaceChildren(); const chat=current(); $('welcome').hidden=!!chat?.messages?.length; if(chat) chat.messages.forEach(m=>addMessage(m.role,m.content,m.meta||'')); renderHistory(); }
async function send(text){
  text=(text||'').trim(); if(!text||busy) return;
  busy=true; $('send').disabled=true;
  let chat=current();
  if(!chat){ chat={id:String(Date.now()),title:text.slice(0,38),mode,provider,messages:[]}; chats.unshift(chat); active=chat.id; }
  chat.mode=mode; chat.provider=provider;
  chat.messages.push({role:'user',content:text}); $('welcome').hidden=true; addMessage('user',text); $('input').value=''; $('input').style.height='auto';
  const placeholder=addMessage('assistant','TEJA is thinking…');
  const image=attachment?.image||null; attachment=null; $('attachment').hidden=true;
  try{
    if(localFilePreview) throw new Error('local-file-preview');
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,provider,webSearch,messages:chat.messages.map(({role,content})=>({role,content})),image})});
    const result=await response.json(); placeholder.remove();
    const reply=result.error ? '⚠ '+result.error : (result.reply || 'No response');
    const meta=[result.provider_label||providerNames[provider], result.model, result.demo?'Demo mode':'Live AI', result.search_note].filter(Boolean).join(' · ');
    chat.messages.push({role:'assistant',content:reply,meta}); addMessage('assistant',reply,meta); speakText(reply);
  }catch(e){
    placeholder.remove();
    const reply=localFilePreview
      ? '⚠ You opened index.html directly. To activate chat, double-click START_TEJA_AI.bat in the extracted teja-ai folder, then visit http://127.0.0.1:8000/'
      : '⚠ Unable to reach TEJA AI server. Start it with START_TEJA_AI.bat or python server.py, then refresh.';
    showLaunchHelp(); chat.messages.push({role:'assistant',content:reply}); addMessage('assistant',reply);
  }finally{ save(); renderHistory(); busy=false; $('send').disabled=false; $('input').focus(); }
}

$('newChat').onclick=newChat; $('clear').onclick=newChat; $('toggle').onclick=()=>$('sidebar').classList.toggle('open');
document.querySelectorAll('.modes [data-mode]').forEach(b=>b.onclick=()=>{ mode=b.dataset.mode; renderMode(); newChat(); $('sidebar').classList.remove('open'); });
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.prompt));
$('send').onclick=()=>send($('input').value);
$('input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send($('input').value); } });
$('input').oninput=()=>{ $('input').style.height='auto'; $('input').style.height=Math.min($('input').scrollHeight,140)+'px'; };
$('providerSel').onchange=e=>{ provider=e.target.value; localStorage.setItem('teja_provider',provider); updateStatusBar(); };
$('webSearch').onchange=e=>{ webSearch=e.target.checked; localStorage.setItem('teja_websearch', webSearch?'1':'0'); updateStatusBar(); };
$('speakToggle').onclick=()=>{ autoSpeak=!autoSpeak; localStorage.setItem('teja_speak', autoSpeak?'1':'0'); if(!autoSpeak && 'speechSynthesis' in window) window.speechSynthesis.cancel(); updateToggles(); };

$('attach').onclick=()=>$('file').click();
$('file').onchange=async e=>{
  const file=e.target.files?.[0]; if(!file) return;
  if(file.size>4_000_000){ alert('Choose a file smaller than 4 MB.'); return; }
  if(file.type.startsWith('image/')){
    const img=await new Promise(resolve=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.readAsDataURL(file); });
    attachment={name:file.name,image:img};
  } else {
    const allowed=['txt','md','csv','json']; if(!allowed.includes(file.name.split('.').pop().toLowerCase())){ alert('Unsupported file format'); return; }
    const txt=await file.text(); attachment={name:file.name,text:txt.slice(0,12000)};
  }
  $('attachment').hidden=false; $('attachment').replaceChildren();
  const name=document.createElement('span'); name.textContent='📎 '+file.name;
  const remove=document.createElement('button'); remove.textContent='✕'; remove.onclick=()=>{ attachment=null; $('attachment').hidden=true; };
  $('attachment').append(name,remove);
  if(attachment.text) $('input').value=($('input').value+'\n\nAttached file '+file.name+':\n'+attachment.text).trim();
  $('file').value='';
};
$('mic').onclick=()=>{
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R){ alert('Speech recognition is not supported in this browser. Try Chrome.'); return; }
  const recog=new R(); recog.lang=/[\u0900-\u097f]/.test($('input').value)?'hi-IN':'en-IN'; recog.interimResults=false;
  recog.onresult=e=>{ $('input').value+=(' '+e.results[0][0].transcript); $('input').focus(); $('input').dispatchEvent(new Event('input')); };
  recog.start();
};

if(localFilePreview){
  $('statusText').textContent='Preview only'; $('statusSub').textContent='Use START_TEJA_AI.bat'; showLaunchHelp();
}else{
  fetch('/api/status').then(r=>{ if(!r.ok) throw Error('Server unavailable'); return r.json(); }).then(s=>{ statusInfo=s; updateToggles(); updateStatusBar(); }).catch(()=>{ $('statusText').textContent='Server offline'; $('statusSub').textContent='Run START_TEJA_AI.bat'; showLaunchHelp(); updateToggles(); });
}
renderMode(); updateToggles(); newChat();
