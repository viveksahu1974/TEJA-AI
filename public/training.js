/* TEJA Training Studio — developed by VIVEK SAHU */
(()=>{
 const $=id=>document.getElementById(id);
 const shell=document.querySelector('.sidebar');
 if(!shell)return;
 const launch=document.createElement('button');launch.id='tejaTrainerButton';
 launch.type='button';launch.textContent='🧠 Training Studio — Voice + Text';
 launch.className='tejaTrainerLaunch';
 const after=shell.querySelector('.new');
 after?.insertAdjacentElement('afterend',launch);
 const modal=document.createElement('div');modal.id='tejaTrainingOverlay';modal.className='tejaTrainingOverlay';modal.hidden=true;
 modal.innerHTML=`
 <div class="tejaTrainingDialog" role="dialog" aria-modal="true" aria-label="TEJA AI Training Studio">
 <header class="tejaTrainerHeader"><div><h2>🧠 TEJA AI Training Studio</h2><p>Train by text or voice • Saved on this computer • Developer: VIVEK SAHU</p></div><button type="button" id="tejaTrainingClose" aria-label="Close">✕</button></header>
 <div class="tejaTrainingColumns"><section>
 <h3 id="trainerFormTitle">Create Training Rule</h3>
 <label for="trainerType">Rule type</label><select id="trainerType">
 <option value="instruction">How TEJA should behave</option>
 <option value="prefer">Preferred word or phrase</option>
 <option value="avoid">Avoid a word or phrase</option>
 <option value="replace">Replace word/phrase</option>
 <option value="correction">Correct a question's answer</option>
 <option value="greeting">Custom Hello response</option></select>
 <label for="trainerPrimary" id="trainerPrimaryLabel">Rule / phrase / question</label>
 <textarea id="trainerPrimary" maxlength="500" rows="4" placeholder="E.g. Baat karte waqt respect se aap bolo."></textarea>
 <button type="button" id="trainerMic" class="tejaButtonSecondary">🎙 Dictate first field</button>
 <div id="trainerSecondaryWrap"><label for="trainerSecondary">Replacement / corrected reply</label><textarea id="trainerSecondary" maxlength="1600" rows="4"></textarea>
 <button type="button" id="trainerMic2" class="tejaButtonSecondary">🎙 Dictate reply</button></div>
 <div class="tejaTrainingActions"><button type="button" id="trainerSave" class="tejaButtonPrimary">💾 Save Training</button>
 <button type="button" id="trainerReset" class="tejaButtonSecondary">Clear</button></div>
 <p class="tejaTrainingHelp">Voice dictation converts speech to text; confirm before saving. This is behavior guidance, not model-weight fine-tuning.</p>
 <p id="trainerStatus" role="status"></p>
 </section><section><div class="tejaTrainingSavedHeader"><h3>Saved Rules <span id="trainerCount">0</span></h3><a id="trainerBackup" href="/api/training/export">⬇ Backup</a></div>
 <div id="trainerRules" class="tejaTrainingRuleList"></div></section></div></div>
`;
 document.body.appendChild(modal);
 const type=$('trainerType'),first=$('trainerPrimary'),second=$('trainerSecondary');
 const status=$('trainerStatus');let editing=null;let dictation=null;let rules=[];
 function hint(text,bad=false){status.textContent=text;status.classList.toggle('error',bad);}
 function updateForm(){const t=type.value;$('trainerSecondaryWrap').hidden=!['replace','correction'].includes(t);
 $('trainerPrimaryLabel').textContent=t==='greeting'?'What TEJA should say on Hello':t==='correction'?'Exact question to correct':t==='replace'?'Phrase to replace':'Rule / phrase';
 }
 function reset(){editing=null;type.value='instruction';first.value='';second.value='';$('trainerFormTitle').textContent='Create Training Rule';$('trainerSave').textContent='💾 Save Training';updateForm();}
 async function api(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await r.json();if(!r.ok)throw Error(json.error||'Request failed');return json;}
 async function refresh(){
   const r=await fetch('/api/training',{cache:'no-store'});const data=await r.json();
   if(!r.ok||!Array.isArray(data.rules))throw Error(data.error||'Cannot load training');
   rules=data.rules;$('trainerCount').textContent=String(rules.length);const list=$('trainerRules');list.replaceChildren();
   if(!rules.length){const p=document.createElement('p');p.textContent='No rules saved yet.';list.append(p);return;}
   rules.forEach(rule=>{
    const box=document.createElement('div');box.className='tejaTrainingRule';
    const top=document.createElement('div');top.className='tejaRuleTop';
    const name=document.createElement('strong');name.textContent=rule.type.toUpperCase();
    const check=document.createElement('input');check.type='checkbox';check.checked=!!rule.enabled;
    check.title='Enable/disable rule';check.onchange=async()=>{try{await api('/api/training/save',{rule:{...rule,enabled:check.checked}});await refresh();}catch(e){hint(e.message,true)}};
    top.append(name,check);
    const primary=document.createElement('p');primary.textContent=rule.trigger;
    box.append(top,primary);
    if(rule.response){const secondary=document.createElement('small');secondary.textContent='→ '+rule.response;box.append(secondary);}
    const controls=document.createElement('div');controls.className='tejaRuleControls';
    const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.onclick=()=>{editing=rule.id;type.value=rule.type;first.value=rule.trigger;second.value=rule.response;$('trainerFormTitle').textContent='Edit Rule';$('trainerSave').textContent='💾 Update Rule';updateForm();first.focus();};
    const del=document.createElement('button');del.type='button';del.textContent='Delete';del.onclick=async()=>{if(!confirm('Delete this training rule?'))return;try{await api('/api/training/delete',{id:rule.id});await refresh();hint('Training rule deleted.');if(editing===rule.id)reset();}catch(e){hint(e.message,true)}};
    controls.append(edit,del);box.append(controls);list.append(box);
   });
 }
 launch.onclick=async()=>{modal.hidden=false;reset();hint('');try{await refresh();}catch(e){hint(e.message,true)}};
 $('tejaTrainingClose').onclick=()=>{modal.hidden=true;dictation?.stop()};
 modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)modal.hidden=true});
 type.onchange=updateForm;$('trainerReset').onclick=reset;
 $('trainerSave').onclick=async()=>{
  if(!first.value.trim()){hint('Enter a rule first.',true);return;}
  const rule={type:type.value,trigger:first.value.trim(),response:second.value.trim(),enabled:true};
  if(editing){rule.id=editing;rule.enabled=rules.find(x=>x.id===editing)?.enabled??true;}
  try{await api('/api/training/save',{rule});await refresh();reset();hint('✓ Training permanently saved on this computer.');}catch(e){hint(e.message,true)}
 };
 function dictate(target){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R){hint('Browser speech recognition unavailable; use Chrome/Edge or type.',true);return;}
  if(dictation){dictation.stop();dictation=null;return;}
  const recog=new R();dictation=recog;
  let l=document.getElementById('langSel')?.value||'hi-IN';recog.lang=(l==='auto'?'hi-IN':l);
  recog.onresult=e=>{target.value=(target.value.trim()+' '+e.results[0][0].transcript).trim().slice(0,target.maxLength);hint('Transcript captured. Please review and save.');};
  recog.onerror=e=>hint('Microphone error: '+e.error,true);
  recog.onend=()=>{dictation=null};
  try{recog.start();hint('Listening… speak the training rule.');}catch{dictation=null;hint('Microphone could not start.',true)}
 }
 $('trainerMic').onclick=()=>dictate(first);$('trainerMic2').onclick=()=>dictate(second);
 updateForm();
})();