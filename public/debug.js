(() => {
  const out = document.getElementById('out');
  const consoleLogEl = document.getElementById('consoleLog');
  const apiKeyInput = document.getElementById('apiKey');

  // capture console.error/warn/log
  const captured = [];
  ['error','warn','log','info'].forEach(k => {
    const orig = console[k];
    console[k] = function(...a){
      try{ captured.push({level:k,msg:a.map(String).join(' '),time:Date.now()}); updateConsole(); }catch(e){}
      orig.apply(console,a);
    };
  });

  function updateConsole(){
    if(!consoleLogEl) return;
    if(captured.length===0) consoleLogEl.textContent='(none)';
    else consoleLogEl.textContent = captured.map(c=>`[${new Date(c.time).toISOString()}] ${c.level}: ${c.msg}`).join('\n');
  }

  function pretty(obj){
    try{ return JSON.stringify(obj,null,2); }catch(e){ return String(obj); }
  }

  async function gather(){
    const info = {};
    info.userAgent = navigator.userAgent;
    info.location = location.href;
    info.time = new Date().toISOString();
    info.localStorage = {};
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); info.localStorage[k]=localStorage.getItem(k); }
    try{ info.sw = await (async()=>{ if(!('serviceWorker' in navigator)) return 'not supported'; const regs = await navigator.serviceWorker.getRegistrations(); return regs.map(r=>({scope:r.scope,active:r.active&&r.active.scriptURL})); })(); }catch(e){ info.sw = 'error: '+e.message }

    // firebase defaults if present
    try{ info.__FIREBASE_DEFAULTS__ = window.__FIREBASE_DEFAULTS__ || null }catch(e){ info.__FIREBASE_DEFAULTS__ = 'error' }

    // try to detect any global firebase config-like objects
    try{
      info.globals = {};
      ['firebase','__FIREBASE_DEFAULTS__','JT','XT','JT','JT','JT'].forEach(k=>{ try{ info.globals[k]=window[k]||null }catch(e){info.globals[k]='error'} });
    }catch(e){}

    return info;
  }

  document.getElementById('btnDump').addEventListener('click', async ()=>{
    out.textContent = 'gathering...';
    const info = await gather();
    out.textContent = pretty(info);
  });

  document.getElementById('btnIdtk').addEventListener('click', async ()=>{
    const apiKey = apiKeyInput.value.trim() || (window.__FIREBASE_DEFAULTS__ && window.__FIREBASE_DEFAULTS__.config && window.__FIREBASE_DEFAULTS__.config.apiKey) || '';
    if(!apiKey){ alert('API key not found. Paste it into the API key field.'); return; }
    out.textContent = 'calling identitytoolkit with provided key...';
    try{
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,{
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({idToken:'INVALID_TOKEN_FOR_TEST'})
      });
      const text = await res.text();
      out.textContent = `status: ${res.status}\n\n${text}`;
    }catch(e){ out.textContent = 'fetch error: '+e.message }
  });

  document.getElementById('btnUnregSW').addEventListener('click', async ()=>{
    try{
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
      out.textContent = 'unregistered all service workers';
    }catch(e){ out.textContent = 'sw error: '+e.message }
  });

  document.getElementById('btnCopy').addEventListener('click', ()=>{
    const text = out.textContent || consoleLogEl.textContent || '';
    navigator.clipboard && navigator.clipboard.writeText(text).then(()=>alert('copied to clipboard'),()=>alert('copy failed'));
  });

  document.getElementById('btnClearLog').addEventListener('click', ()=>{ captured.length=0; updateConsole(); });

  // initial fill
  updateConsole();
  out.textContent='ready';
})();
