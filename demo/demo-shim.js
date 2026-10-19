/* TEJA AI GitHub Pages demo-only transport. No AI provider, keys, or user chat
   data leave the browser. This is explicitly not an AI inference service. */
(()=>{
  'use strict';
  const originalFetch = window.fetch.bind(window);
  const storedLang='teja_tts_engine';
  // Online TTS requires the local Python server; browser voice is suitable for this preview.
  localStorage.setItem(storedLang,'browser');
  const voiceOnline = document.getElementById('ttsEngine');
  if (voiceOnline) { const o=voiceOnline.querySelector('option[value="online"]'); if (o) o.disabled=true; }
  const status={
    connected:false,
    providers:Object.fromEntries(Object.entries({teja:'TEJA AI Smart',ollama:'TEJA Local (Ollama)',openai:'ChatGPT',gemini:'Gemini',claude:'Claude',deepseek:'DeepSeek'}).map(([k,v])=>[k,{ready:false,label:v,model:'Sample demo only'}])),
    google_search:false,tts_online_installed:false,tts_online_languages:[]
  };
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  const cleaned = text=>String(text??'').replace(/\s+/g,' ').trim().slice(0,220);
  function answer(q,mode){
    const text=cleaned(q);
    const t=text.toLowerCase();
    if(/[\u0900-\u097f]/u.test(text) || /\bhindi\b|\bhinglish\b|\bkaise\b|\bky[au]\b|\bmujhe\b/iu.test(t)) return 'नमस्ते! यह TEJA AI का डेमो है। आप यहाँ चैट हिस्ट्री, इंटरफ़ेस और ब्राउज़र में उपलब्ध हिंदी आवाज़ का परीक्षण कर सकते हैं। यह उत्तर पहले से लिखा हुआ नमूना है, असली AI उत्तर नहीं।';
    if(/^(hi|hello|hey|namaste)([! .,?]|$)/iu.test(t))return 'Namaste! 👋 Main TEJA AI ka interactive demo hoon. Aap interface, modes, chat history aur browser voice test kar sakte ho. Real AI responses ke liye Ollama ya configured AI backend zaroori hai.';
    if (/python|javascript|code|program|function|html|css|debug|error/.test(t) || mode==='code')return 'Code Assistant demo: Here is a sample Python snippet:\n\nprint("Hello from TEJA AI!")\n\nFor real code generation and debugging, connect Ollama locally or a secured cloud AI provider.';
    if (/study|exam|learn|science|school|explain|class/.test(t) || mode==='study')return 'Study Mode demo: An example is “Photosynthesis is the process by which green plants make food using sunlight, water and carbon dioxide.”\n\nReal answers to your exact questions require an AI backend.';
    if (/write|email|letter|paragraph|story|essay/.test(t) || mode==='write')return 'Writing Studio demo: “Dear Teacher, I am writing to request permission for the school activity. Thank you for considering my request.”\n\nThis is only an example, not a personalized AI-generated draft.';
    if (/translate|translation/.test(t) || mode==='translate')return 'Translator demo: “Good morning” → “सुप्रभात” (Hindi).\n\nFor arbitrary translation, a connected model is required.';
    if (/idea|project|innovation|brainstorm/.test(t) || mode==='ideas')return 'Idea Lab demo: Example project — Smart Attendance Tracker, a system that helps teachers record attendance and review trends.\n\nReal AI brainstorming needs an AI backend.';
    return 'You wrote: “'+text+'”\n\nThis is the interactive TEJA AI website preview, not a real AI answer. You can explore its chat interface, switch workspaces, test browser-supported voice and save demo history in this browser. For real chat, use Ollama or connect a secure hosted AI backend.';
  }
  window.fetch=async (input,init)=>{
    const path=typeof input==='string'?input:input?.url;
    if(typeof path==='string' && /^\/api\/status(?:[?#]|$)/.test(path))return json(status);
    if(typeof path==='string' && /^\/api\/chat(?:[?#]|$)/.test(path)){
      let data={};try{data=JSON.parse(init?.body||'{}');}catch{}
      const messages=Array.isArray(data.messages)?data.messages:[];
      const last=messages[messages.length-1]||{};
      return json({reply:answer(last.content,data.mode),demo:true,provider:data.provider||'teja',provider_label:'TEJA AI Browser Preview',model:'Sample replies — no model connected'});
    }
    if(typeof path==='string' && /^\/api\/tts(?:[?#]|$)/.test(path)) return json({error:'Online speech requires the local Python server. Please select Windows / Browser voice in this preview.'},503);
    return originalFetch(input,init);
  };
})();
