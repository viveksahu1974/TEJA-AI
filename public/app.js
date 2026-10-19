const $ = id => document.getElementById(id);
const localFilePreview = location.protocol === 'file:';
const modeNames = {
  teja:'TEJA AI Mode', general:'All-rounder AI', study:'Study & Learning', code:'Code Assistant',
  write:'Writing Studio', translate:'Translator', ideas:'Idea Lab'
};
const providerNames = {
  teja:'TEJA AI Smart', ollama:'TEJA Local (Ollama)', openai:'ChatGPT',
  gemini:'Gemini', claude:'Claude', deepseek:'DeepSeek'
};
let mode='teja', chats=[], active='', attachment=null, busy=false;
let provider=localStorage.getItem('teja_provider')||'teja';
let autoSpeak=localStorage.getItem('teja_speak')==='1';
let webSearch=localStorage.getItem('teja_websearch')==='1';
let speechLang=localStorage.getItem('teja_lang')||'auto';
let speechVoice=localStorage.getItem('teja_voice')||'';
let speechRate=Number(localStorage.getItem('teja_rate')||'1');
let ttsEngine=localStorage.getItem('teja_tts_engine')||'online';
let ttsSpeaker=localStorage.getItem('teja_tts_speaker')||'female';
let activeAudio=null, activeAudioUrl=null;
let statusInfo=null, recognizer=null, serverHistoryAvailable=false;
let historyWriteQueue=Promise.resolve();
let historyReady;
try { const old=JSON.parse(localStorage.getItem('teja_chats')||'[]'); if(Array.isArray(old)) chats=old; } catch {}

function showLaunchHelp(){ $('setupNotice').hidden=false; }
function sortChats(){ chats.sort((a,b)=>(b.updatedAt||Number(b.id)||0)-(a.updatedAt||Number(a.id)||0)); }
function saveBrowser(){
  try { localStorage.setItem('teja_chats',JSON.stringify(chats.slice(0,80))); }
  catch { $('historyStatus').textContent=serverHistoryAvailable?'Saved on device (browser cache full)':'History storage unavailable'; }
}
function current(){ return chats.find(c=>c.id===active); }
function queueHistoryRequest(path,data){
  if(!serverHistoryAvailable) return Promise.resolve();
  historyWriteQueue=historyWriteQueue.catch(()=>{}).then(async()=>{
    const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!r.ok) throw Error('History could not be saved');
    $('historyStatus').textContent='✓ Saved on this device';
  }).catch(()=>{ $('historyStatus').textContent='⚠ History save failed; browser backup only'; });
  return historyWriteQueue;
}
function persistChat(chat){
  chat.updatedAt=Date.now();
  saveBrowser(); renderHistory();
  // Snapshot the payload so queued writes preserve ordering and do not mutate behind the scenes.
  queueHistoryRequest('/api/history',{chat:JSON.parse(JSON.stringify(chat))});
}
async function initializeHistory(){
  if(localFilePreview){ $('historyStatus').textContent='Preview only — run the server'; renderHistory(); return; }
  const localChats=chats.slice();
  try {
    const response=await fetch('/api/history',{cache:'no-store'});
    if(!response.ok) throw Error('History service unavailable');
    const data=await response.json();
    if(!Array.isArray(data.chats)) throw Error('Invalid history response');
    serverHistoryAvailable=true;
    const serverIds=new Set(data.chats.map(c=>c.id));
    const unsynced=localChats.filter(c=>c && typeof c.id==='string' && !serverIds.has(c.id) && Array.isArray(c.messages));
    chats=data.chats.concat(unsynced);
    sortChats(); saveBrowser(); renderHistory();
    $('historyStatus').textContent='✓ Saved on this device';
    for(const chat of unsynced){
      if(!chat.updatedAt) chat.updatedAt=Date.now();
      queueHistoryRequest('/api/history',{chat:JSON.parse(JSON.stringify(chat))});
    }
  } catch(e){
    serverHistoryAvailable=false;
    $('historyStatus').textContent='⚠ Browser-only history (server unavailable)';
    renderHistory();
  }
}
function newChat(){
  if(busy) return;
  active=''; attachment=null; $('attachment').hidden=true;
  $('messages').replaceChildren(); $('welcome').hidden=false; $('input').value=''; renderHistory();
}
function renderHistory(){
  const list=$('history'); list.replaceChildren(); sortChats();
  $('historyCount').textContent=chats.length ? `(${chats.length})` : '';
  if(!chats.length){
    const empty=document.createElement('p'); empty.className='historyEmpty';
    empty.textContent='No conversations yet. Send a message to save your first chat.';
    list.appendChild(empty); return;
  }
  chats.slice(0,80).forEach(chat=>{
    const row=document.createElement('div'); row.className='historyRow'+(chat.id===active?' current':'');
    const b=document.createElement('button'); b.className='historyChat'; b.textContent='◷  '+(chat.title||'Conversation');
    b.title=chat.title||'Conversation';
    b.onclick=()=>{
      if(busy) return;
      active=chat.id; mode=chat.mode||'teja';
      if(chat.provider && providerNames[chat.provider]) provider=chat.provider;
      renderMode(); renderMessages(); updateToggles(); updateStatusBar();
      $('sidebar').classList.remove('open');
    };
    const del=document.createElement('button'); del.className='historyDelete'; del.textContent='×';
    del.title='Delete conversation'; del.setAttribute('aria-label','Delete '+(chat.title||'conversation'));
    del.onclick=()=>{
      if(busy || !confirm('Delete this conversation permanently from TEJA AI history?')) return;
      chats=chats.filter(c=>c.id!==chat.id);
      if(active===chat.id){ active=''; $('messages').replaceChildren(); $('welcome').hidden=false; }
      saveBrowser(); renderHistory(); queueHistoryRequest('/api/history/delete',{id:chat.id});
    };
    row.append(b,del); list.appendChild(row);
  });
}
function renderMode(){
  $('activeLabel').textContent=modeNames[mode]||'TEJA AI';
  document.querySelectorAll('.modes [data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
}
function updateToggles(){
  $('providerSel').value=provider; $('webSearch').checked=webSearch;
  $('speakToggle').classList.toggle('active',autoSpeak);
  $('speakToggle').title=autoSpeak?'Automatically speak replies (ON)':'Automatically speak replies (OFF)';
  $('langSel').value=speechLang; $('rateSel').value=String(speechRate);
  $('ttsEngine').value=ttsEngine; $('ttsSpeaker').value=ttsSpeaker;
  $('ttsSpeaker').disabled=ttsEngine!=='online';
  $('voiceSel').disabled=ttsEngine==='online';
}
function updateStatusBar(){
  if(!statusInfo) return;
  const p=providerNames[provider]||'Model';
  const ready=!!statusInfo.providers?.[provider]?.ready;
  $('statusDot').classList.toggle('live',ready);
  $('statusText').textContent=ready?`${p} connected`:`${p} demo mode`;
  let extra=ready?(statusInfo.providers[provider].model||''):((provider==='teja'||provider==='ollama')?'Install Ollama + ollama pull qwen2.5:3b':`Set ${provider.toUpperCase()} API key`);
  if(webSearch) extra+=statusInfo.google_search?' · Google search ready':' · Google search not configured';
  $('statusSub').textContent=extra; $('versionPill').textContent=`${ready?'⚡':'🐺'} ${p}`;
}
function addMessage(role,text,meta=''){
  const div=document.createElement('div'); div.className='message '+role;
  const avatar=document.createElement('div'); avatar.className='avatar';
  if(role==='assistant'){
    avatar.classList.add('assistant-avatar');
    const logo=document.createElement('img'); logo.src='./teja-icon.png'; logo.alt='TEJA'; avatar.appendChild(logo);
  } else avatar.textContent='◉';
  const content=document.createElement('div'); content.className='bubble';
  const body=document.createElement('span'); body.textContent=text; content.append(body);
  if(role==='assistant' && text && !text.includes('TEJA is thinking')){
    const replay=document.createElement('button'); replay.className='playReply'; replay.textContent='🔉 Listen';
    replay.title='Read this reply aloud'; replay.onclick=()=>speakText(text,true);
    content.appendChild(replay);
  }
  if(meta){ const info=document.createElement('div'); info.className='meta'; info.textContent=meta; content.appendChild(info); }
  div.append(avatar,content); $('messages').appendChild(div); $('scroll').scrollTop=$('scroll').scrollHeight;
  return div;
}
function renderMessages(){
  $('messages').replaceChildren(); const chat=current();
  $('welcome').hidden=!!chat?.messages?.length;
  if(chat) chat.messages.forEach(m=>addMessage(m.role,m.content,m.meta||''));
  renderHistory();
}
async function send(text){
  text=(text||'').trim(); if(!text||busy) return;
  busy=true; $('send').disabled=true;
  await historyReady;
  let chat=current();
  if(!chat){
    const id=String(Date.now())+'_'+Math.random().toString(36).slice(2,8);
    chat={id,title:text.slice(0,48),mode,provider,messages:[],updatedAt:Date.now()};
    chats.unshift(chat); active=chat.id;
  }
  chat.mode=mode; chat.provider=provider;
  chat.messages.push({role:'user',content:text});
  persistChat(chat); // Save the question immediately, even if Ollama/API later fails.
  $('welcome').hidden=true; addMessage('user',text);
  $('input').value=''; $('input').style.height='auto';
  const placeholder=addMessage('assistant','TEJA is thinking…');
  const image=attachment?.image||null; attachment=null; $('attachment').hidden=true;
  try {
    if(localFilePreview) throw Error('local file preview');
    const response=await fetch('/api/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode,provider,webSearch,messages:chat.messages.map(({role,content})=>({role,content})),image})
    });
    const result=await response.json(); placeholder.remove();
    const reply=result.error?'⚠ '+result.error:(result.reply||'No response');
    const meta=[result.provider_label||providerNames[provider],result.model,result.demo?'Demo mode':'Live AI',result.search_note].filter(Boolean).join(' · ');
    chat.messages.push({role:'assistant',content:reply,meta});
    persistChat(chat); addMessage('assistant',reply,meta); speakText(reply,false);
  } catch(e){
    placeholder.remove();
    const reply=localFilePreview?'⚠ Open TEJA through START_TEJA_AI.bat, not index.html directly.':'⚠ TEJA server is unavailable. Start it with START_TEJA_AI.bat, then refresh.';
    if(localFilePreview) showLaunchHelp();
    chat.messages.push({role:'assistant',content:reply}); persistChat(chat); addMessage('assistant',reply);
  } finally {
    busy=false; $('send').disabled=false; $('input').focus();
  }
}

// Browser-supported multilingual text-to-speech and speech recognition.
const languageSamples={
  hi:'Hindi', en:'English', bn:'Bengali', ta:'Tamil', te:'Telugu', mr:'Marathi',
  gu:'Gujarati', kn:'Kannada', ml:'Malayalam', pa:'Punjabi', ur:'Urdu', or:'Odia',
  ne:'Nepali', ar:'Arabic', es:'Spanish', fr:'French', de:'German', ja:'Japanese',
  ko:'Korean', zh:'Chinese', ru:'Russian', pt:'Portuguese'
};
function detectLanguage(text){
  if(/[\u0900-\u097f]/.test(text)) return 'hi-IN';
  if(/[\u0980-\u09ff]/.test(text)) return 'bn-IN';
  if(/[\u0b80-\u0bff]/.test(text)) return 'ta-IN';
  if(/[\u0c00-\u0c7f]/.test(text)) return 'te-IN';
  if(/[\u0a80-\u0aff]/.test(text)) return 'gu-IN';
  if(/[\u0c80-\u0cff]/.test(text)) return 'kn-IN';
  if(/[\u0d00-\u0d7f]/.test(text)) return 'ml-IN';
  if(/[\u0a00-\u0a7f]/.test(text)) return 'pa-IN';
  if(/[\u0b00-\u0b7f]/.test(text)) return 'or-IN';
  if(/[\u0600-\u06ff]/.test(text)) return 'ar-SA';
  if(/[\u3040-\u30ff]/.test(text)) return 'ja-JP';
  if(/[\uac00-\ud7af]/.test(text)) return 'ko-KR';
  if(/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if(/[\u0400-\u04ff]/.test(text)) return 'ru-RU';
  return 'en-IN';
}
function targetLanguage(text){ return speechLang==='auto'?detectLanguage(text):speechLang; }
// If user previously selected English but reply is clearly in a different script,
// prefer native-script pronunciation rather than misreading Hindi as English.
function actualVoiceLanguage(text){
  const detected=detectLanguage(text);
  if(ttsEngine==='online' && speechLang.startsWith('en') && detected!=='en-IN') return detected;
  return targetLanguage(text);
}
function availableVoices(){ return 'speechSynthesis' in window?window.speechSynthesis.getVoices():[]; }
function refreshVoices(){
  const select=$('voiceSel'), voices=availableVoices();
  select.replaceChildren(new Option('Automatic voice',''));
  for(const v of voices){ select.add(new Option(`${v.name} · ${v.lang}${v.localService?' · device':''}`,v.voiceURI)); }
  if(voices.some(v=>v.voiceURI===speechVoice)) select.value=speechVoice;
  else { speechVoice=''; select.value=''; }
  updateSpeechStatus();
}
function updateSpeechStatus(){
  const text=$('voiceStatus');
  if(!('speechSynthesis' in window)){ text.textContent='Voice playback not supported in this browser.'; return; }
  if(ttsEngine==='online'){
    const installed=!!statusInfo?.tts_online_installed;
    text.textContent=installed
      ? 'Multilingual online engine ready (internet required). Click ▶ Test voice.'
      : 'Install online voices: run INSTALL_MULTILINGUAL_VOICE.bat, then restart TEJA AI.';
    return;
  }
  const lang=targetLanguage($('input').value||'Hello');
  const voices=availableVoices();
  if(!voices.length){ text.textContent='Browser voice list unavailable. Try Edge/Chrome and Windows Speech settings.'; return; }
  if(speechLang!=='auto' && !voices.some(v=>v.lang.toLowerCase().split('-')[0]===lang.split('-')[0])){
    text.textContent=`No installed ${languageSamples[lang.split('-')[0]]||lang} voice detected — audio may fall back to another language.`;
  } else text.textContent='Voice availability depends on installed browser/Windows voices.';
}
// Keep speech playback resilient when an Edge online voice fails to load.
// Each session gets a unique token so a Stop click or a new reply cancels
// fallback retries safely, without accidentally speaking the old message.
let speechSession=0;
function clearAudioPlayback(){
  if(activeAudio){
    activeAudio.pause();
    activeAudio.onended=null; activeAudio.onerror=null;
    activeAudio.removeAttribute('src'); activeAudio.load();
    activeAudio=null;
  }
  if(activeAudioUrl){ URL.revokeObjectURL(activeAudioUrl); activeAudioUrl=null; }
}
function stopSpeaking(){
  speechSession++;
  clearAudioPlayback();
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  $('voiceStatus').textContent='Voice stopped.';
}
function speechChunks(text,maxLength=240){
  const words=text.split(/\s+/).filter(Boolean), chunks=[];
  let buffer='';
  for(const word of words){
    // Long code/URLs may contain no spaces; do not send huge synthesis chunks.
    const parts=word.match(new RegExp(`.{1,${maxLength}}`,'g'))||[];
    for(const part of parts){
      if(buffer && buffer.length+part.length+1>maxLength){ chunks.push(buffer);buffer=''; }
      buffer+=(buffer?' ':'')+part;
      if(/[।.!?]$/.test(part) && buffer.length>=80){chunks.push(buffer);buffer='';}
    }
  }
  if(buffer) chunks.push(buffer);
  return chunks;
}
function browserSpeakText(text,force=false){
  if(!autoSpeak&&!force) return;
  if(!('speechSynthesis' in window)){
    $('voiceStatus').textContent='This browser does not support speech playback.';
    return;
  }
  const cleaned=text.replace(/```[\s\S]*?```/g,' Code block omitted. ')
    .replace(/[`*_#>]/g,' ').replace(/\s+/g,' ').trim().slice(0,4000);
  if(!cleaned) return;
  const synth=window.speechSynthesis;
  const session=++speechSession;
  synth.cancel();
  const desired=targetLanguage(cleaned);
  const language=desired.split('-')[0].toLowerCase();
  const voices=availableVoices();
  const candidates=[];
  const addCandidate=(v)=>{ if(v && !candidates.some(x=>x?.voiceURI===v.voiceURI)) candidates.push(v); };
  const chosen=voices.find(v=>v.voiceURI===speechVoice);
  if(chosen && chosen.lang.toLowerCase().split('-')[0]===language) addCandidate(chosen);
  // Prefer installed/local voices to avoid online voices failing on a blocked network.
  voices.filter(v=>v.localService && v.lang.toLowerCase()===desired.toLowerCase()).forEach(addCandidate);
  voices.filter(v=>v.localService && v.lang.toLowerCase().split('-')[0]===language).forEach(addCandidate);
  voices.filter(v=>v.lang.toLowerCase()===desired.toLowerCase()).forEach(addCandidate);
  voices.filter(v=>v.lang.toLowerCase().split('-')[0]===language).forEach(addCandidate);
  // Automatic browser voice is a last resort. It may not speak the requested language.
  candidates.push(null);
  const chunks=speechChunks(cleaned);
  let chunkIndex=0;
  function sayNextChunk(){
    if(session!==speechSession) return;
    if(chunkIndex>=chunks.length){
      $('voiceStatus').textContent=`✓ Spoken (${desired}).`;
      return;
    }
    let attempt=0;
    let lastReason='unknown';
    function tryVoice(){
      if(session!==speechSession) return;
      if(attempt>=candidates.length){
        const installed=voices.filter(v=>v.localService && v.lang.toLowerCase().split('-')[0]===language).length;
        $('voiceStatus').textContent=`Voice error: ${lastReason}. ` +
          (installed ? 'Try another installed voice or check volume/output.' :
          `No installed ${language} voice found. Install a Windows language voice, or test English.`);
        return;
      }
      const v=candidates[attempt++];
      const u=new SpeechSynthesisUtterance(chunks[chunkIndex]);
      u.lang=desired; u.rate=speechRate; u.pitch=1; u.volume=1;
      if(v) u.voice=v;
      u.onstart=()=>{
        if(session===speechSession){
          $('voiceStatus').textContent=`Speaking ${desired} using ${v?v.name:'automatic voice'} (${chunkIndex+1}/${chunks.length})…`;
        }
      };
      u.onend=()=>{if(session===speechSession){chunkIndex++;sayNextChunk();}};
      u.onerror=e=>{
        if(session!==speechSession || e.error==='interrupted' || e.error==='canceled') return;
        lastReason=e.error||'unknown';
        // Denied browser permission needs user action, not automatic retries.
        if(lastReason==='not-allowed'){
          $('voiceStatus').textContent='Voice blocked by browser. Click Test Voice again, and check site sound permissions.';
          return;
        }
        $('voiceStatus').textContent=`Voice ${v?v.name:'automatic'} failed (${lastReason}); trying another…`;
        setTimeout(()=>{if(session!==speechSession)return; synth.cancel(); tryVoice();},150);
      };
      try{synth.speak(u);}catch(e){lastReason=e.message||'synthesis error';tryVoice();}
    }
    tryVoice();
  }
  sayNextChunk();
}
// Independent multilingual online TTS; no Windows Hindi voice installation required.
// Uses optional edge-tts on local Python server and needs an internet connection.
async function speakText(text,force=false){
  if(!autoSpeak&&!force) return;
  if(ttsEngine==='browser') return browserSpeakText(text,force);
  const cleaned=text.replace(/```[\s\S]*?```/g,' Code block omitted. ')
    .replace(/[`*_#>]/g,' ').replace(/\s+/g,' ').trim().slice(0,1800);
  if(!cleaned) return;
  const lang=actualVoiceLanguage(cleaned);
  const session=++speechSession;
  clearAudioPlayback();
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  $('voiceStatus').textContent=`Generating online voice (${lang})…`;
  try{
    const response=await fetch('/api/tts',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:cleaned,language:lang,speed:speechRate,speaker:ttsSpeaker})
    });
    if(session!==speechSession) return;
    if(!response.ok){
      let error='Online voice failed';
      try{ const details=await response.json(); error=details.error||error; }catch{}
      if(session===speechSession) $('voiceStatus').textContent='⚠ '+error;
      return;
    }
    const audioData=await response.blob();
    if(session!==speechSession) return;
    const url=URL.createObjectURL(audioData);
    const audio=new Audio(url);
    activeAudio=audio; activeAudioUrl=url;
    audio.onended=()=>{
      if(session!==speechSession) return;
      clearAudioPlayback(); $('voiceStatus').textContent=`✓ Online ${lang} speech finished.`;
    };
    audio.onerror=()=>{
      if(session!==speechSession) return;
      clearAudioPlayback(); $('voiceStatus').textContent='⚠ Audio playback failed. Check browser site sound, volume and output device.';
    };
    try{
      await audio.play();
      if(session===speechSession) $('voiceStatus').textContent=`▶ Speaking in ${lang} (online voice)…`;
    }catch(e){
      if(session!==speechSession)return;
      clearAudioPlayback();
      $('voiceStatus').textContent='⚠ Browser blocked audio. Click ▶ Test voice directly and allow sound on this page.';
    }
  }catch(e){
    if(session===speechSession) $('voiceStatus').textContent='⚠ Could not reach TEJA voice server. Check server and Internet.';
  }
}

function testSelectedVoice(){
  const lang=speechLang==='auto'?'hi-IN':speechLang;
  const samples={hi:'नमस्ते। मैं तेजा एआई हूँ। क्या आप मेरी आवाज़ सुन पा रहे हैं?',en:'Hello, I am TEJA AI. Can you hear my voice?',bn:'নমস্কার, আমি তেজা এআই।',ta:'வணக்கம், நான் தேஜா ஏஐ.',te:'నమస్కారం, నేను తేజా ఏఐ.'};
  const sample=samples[lang.split('-')[0]] || 'Hello, TEJA AI voice test.';
  // Explicit language is set for the duration of the click only; user setting is unchanged.
  const original=speechLang;
  speechLang=lang;
  speakText(sample,true);
  speechLang=original;
}
function startListening(){
  const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRec){ alert('Voice recognition is not supported here. Try latest Chrome/Edge and allow microphone access.'); return; }
  if(recognizer){ recognizer.stop(); return; }
  recognizer=new SpeechRec();
  recognizer.lang=targetLanguage($('input').value||'Hello');
  recognizer.interimResults=false;
  $('mic').classList.add('recording'); $('voiceStatus').textContent=`Listening (${recognizer.lang})…`;
  recognizer.onresult=e=>{
    $('input').value=($('input').value+' '+e.results[0][0].transcript).trim();
    $('input').dispatchEvent(new Event('input')); $('input').focus();
  };
  recognizer.onerror=e=>{ $('voiceStatus').textContent='Mic error: '+e.error+'. Check browser permissions and selected language.'; };
  recognizer.onend=()=>{ recognizer=null; $('mic').classList.remove('recording'); updateSpeechStatus(); };
  try { recognizer.start(); } catch { recognizer=null; $('mic').classList.remove('recording'); }
}

$('newChat').onclick=newChat; $('clear').onclick=newChat;
$('toggle').onclick=()=>$('sidebar').classList.toggle('open');
document.querySelectorAll('.modes [data-mode]').forEach(b=>b.onclick=()=>{ if(busy) return; mode=b.dataset.mode; renderMode(); newChat(); $('sidebar').classList.remove('open'); });
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.prompt));
$('send').onclick=()=>send($('input').value);
$('input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send($('input').value);} });
$('input').oninput=()=>{ $('input').style.height='auto'; $('input').style.height=Math.min($('input').scrollHeight,140)+'px'; };
$('providerSel').onchange=e=>{ provider=e.target.value; localStorage.setItem('teja_provider',provider); updateStatusBar(); };
$('webSearch').onchange=e=>{ webSearch=e.target.checked; localStorage.setItem('teja_websearch',webSearch?'1':'0'); updateStatusBar(); };
$('speakToggle').onclick=()=>{
  autoSpeak=!autoSpeak; localStorage.setItem('teja_speak',autoSpeak?'1':'0');
  if(!autoSpeak) stopSpeaking(); updateToggles();
};
$('langSel').onchange=e=>{ speechLang=e.target.value; localStorage.setItem('teja_lang',speechLang); updateSpeechStatus(); };
$('ttsEngine').onchange=e=>{ stopSpeaking(); ttsEngine=e.target.value;localStorage.setItem('teja_tts_engine',ttsEngine);updateToggles();updateSpeechStatus(); };
$('ttsSpeaker').onchange=e=>{ ttsSpeaker=e.target.value;localStorage.setItem('teja_tts_speaker',ttsSpeaker); };
$('voiceSel').onchange=e=>{ speechVoice=e.target.value; localStorage.setItem('teja_voice',speechVoice); updateSpeechStatus(); };
$('rateSel').onchange=e=>{ speechRate=Number(e.target.value)||1; localStorage.setItem('teja_rate',String(speechRate)); };
$('stopVoice').onclick=stopSpeaking;
$('testVoice').onclick=testSelectedVoice;
$('mic').onclick=startListening;
$('exportHistory').onclick=()=>{
  if(serverHistoryAvailable){window.location.href='/api/history/export';return;}
  const blob=new Blob([JSON.stringify({format:'teja-ai-history-v1',chats},null,2)],{type:'application/json'});
  const link=document.createElement('a');const href=URL.createObjectURL(blob);
  link.href=href; link.download='teja-ai-history.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(href),1000);
};
$('clearHistory').onclick=()=>{
  if(busy || !chats.length || !confirm('Delete ALL TEJA AI chat history from this device? This cannot be undone.')) return;
  chats=[]; active=''; saveBrowser();renderHistory();newChat();
  queueHistoryRequest('/api/history/clear',{confirm:true});
};

$('attach').onclick=()=>$('file').click();
$('file').onchange=async e=>{
  const file=e.target.files?.[0]; if(!file) return;
  if(file.size>4_000_000){alert('Choose a file smaller than 4 MB.');return;}
  if(file.type.startsWith('image/')){
    const img=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
    attachment={name:file.name,image:img};
  } else {
    const allowed=['txt','md','csv','json']; if(!allowed.includes(file.name.split('.').pop().toLowerCase())){alert('Unsupported file format');return;}
    const txt=await file.text();attachment={name:file.name,text:txt.slice(0,12000)};
  }
  $('attachment').hidden=false;$('attachment').replaceChildren();
  const name=document.createElement('span');name.textContent='📎 '+file.name;
  const remove=document.createElement('button');remove.textContent='✕';remove.onclick=()=>{attachment=null;$('attachment').hidden=true;};
  $('attachment').append(name,remove);
  if(attachment.text)$('input').value=($('input').value+'\n\nAttached file '+file.name+':\n'+attachment.text).trim();
  $('file').value='';
};

if(localFilePreview){
  $('statusText').textContent='Preview only'; $('statusSub').textContent='Use START_TEJA_AI.bat';showLaunchHelp();
} else {
  fetch('/api/status').then(r=>{if(!r.ok) throw Error('Server unavailable');return r.json();})
    .then(s=>{statusInfo=s;updateStatusBar();updateSpeechStatus();})
    .catch(()=>{$('statusText').textContent='Server offline';$('statusSub').textContent='Run START_TEJA_AI.bat';showLaunchHelp();});
}
renderMode();updateToggles();renderHistory();
historyReady=initializeHistory();
refreshVoices();
if('speechSynthesis' in window)window.speechSynthesis.onvoiceschanged=refreshVoices;
