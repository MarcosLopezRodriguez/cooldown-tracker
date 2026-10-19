async (page, config) => {
  const passed=[];
  const until=async(fn,arg,timeout=15000,view=page)=>{const limit=Date.now()+timeout;while(Date.now()<limit){if(await view.evaluate(fn,arg))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('No se cumplió la condición de Chrome dentro del plazo');};

  const checkpoint=async(...labels)=>{passed.push(...labels);await page.evaluate(notes=>{window.browserTestProgress=notes;},passed);};
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const I='cooldown_site_timers_v1',S='cooldown_settings_v1';
  const context=page.context();
  let serial=0;
  const command=async(cmd,view=page)=>view.evaluate(async ({command,requestId})=>{
    const response=await chrome.runtime.sendMessage({type:'state-mutate',command,requestId});
    if(!response.ok)throw new Error(response.error);return response.state;
  },{command:cmd,requestId:'browser-'+Date.now()+'-'+(++serial)});
  const site=(id,label,extra={})=>({id,label,url:config.baseUrl+'/'+id,scope:'domain',mode:'cooldown',durationMs:60000,endAt:null,...extra});
  const worker=context.serviceWorkers()[0];const beforeNotices=config.contextData.beforeNotices;const target=context.pages().find(p=>p!==page&&p.url().includes('/blocked.html'));
  await page.getByRole('heading',{name:'Revisar importación'}).waitFor();
  await page.getByRole('button',{name:'Confirmar importación'}).focus();await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'Fin uno',exact:true}).waitFor();
  check(await page.evaluate(S=>chrome.storage.local.get(S).then(v=>v[S].privacyAccepted),S)===true,'Importar alteró aceptación local');await checkpoint('importación por teclado conserva sitios y aceptación');
  await page.getByRole('button',{name:'Abrir configuración'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'duplicadas.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({items:[site('dup-a','Duplicada A'),site('dup-b','Duplicada B')]}))});
  await page.getByRole('alert').filter({hasText:'La fila 2 repite el ámbito de otra regla.'}).waitFor();
  await checkpoint('importación rechaza reglas con el mismo ámbito sin sustituir datos');
  await page.keyboard.press('Escape');
  check(await page.getByRole('button',{name:'Abrir configuración'}).evaluate(el=>el===document.activeElement),'Escape no devuelve foco en popup');await checkpoint('Escape retorna al activador en popup');
  await command({kind:'import',hasItems:true,items:[site('silent','Sin avisos',{endAt:Date.now()+2000})],settings:{notificationsOn:false}});
  await until(I=>chrome.storage.local.get(I).then(v=>v[I][0]?.endAt===null),I);
  check((await page.evaluate(()=>chrome.notifications.getAll()))['cooldown-ready:silent:']===undefined,'Aviso silencioso inesperado');
  check(await worker.evaluate(()=>globalThis.checkCounts.notify)===beforeNotices,'Avisos desactivados ignorados');await checkpoint('avisos desactivados se respetan');
  // Real extension storage read failure must not write defaults.
  const original=await page.evaluate(()=>chrome.storage.local.get(null));
  const fault=await context.newPage();await fault.addInitScript(()=>{
    const get=chrome.storage.local.get.bind(chrome.storage.local),set=chrome.storage.local.set.bind(chrome.storage.local);window.testWrites=0;
    chrome.storage.local.get=()=>{throw Error('read failure');};chrome.storage.local.set=(...args)=>{window.testWrites++;return set(...args);};window.restoreGet=()=>{chrome.storage.local.get=get;};
  });
  await fault.goto(config.extensionUrl);await fault.getByText(/No se pueden leer los datos guardados/).waitFor();
  check(await fault.evaluate(()=>window.testWrites)===0,'Lectura fallida escribió defaults');
  check(JSON.stringify(await page.evaluate(()=>chrome.storage.local.get(null)))===JSON.stringify(original),'Lectura fallida cambió estado');
  await fault.evaluate(()=>window.restoreGet());await fault.getByRole('button',{name:'Reintentar',exact:true}).click();await fault.getByRole('heading',{name:'Sin avisos',exact:true}).waitFor();await fault.close();await checkpoint('error de lectura real conserva originales y permite recuperar');
  // Store screenshots use only deterministic demonstration data.
  await command({kind:'import',hasItems:true,items:[site('video','Pausa de vídeos',{url:'https://www.youtube.com/',endAt:Date.now()+1800000,durationMs:1800000}),site('news','Noticias',{url:'https://news.ycombinator.com/',mode:'always'}),site('wiki','Lectura pendiente',{url:'https://es.wikipedia.org/'})],settings:{}});
  await page.getByRole('heading',{name:'Pausa de vídeos',exact:true}).waitFor();
  const capture=await context.newPage();await capture.goto(config.extensionUrl);await capture.setViewportSize({width:1280,height:800});
  await capture.evaluate(url=>{
    delete document.documentElement.dataset.shell;
    document.body.style.cssText='width:1280px;height:800px;margin:0;background:#f4f7f6;color:#111827;overflow:hidden;font-family:Segoe UI,Arial,sans-serif';
    document.body.innerHTML='<header style="max-width:920px;margin:22px auto 16px"><h1 style="font-size:28px;margin:0 0 5px;font-weight:650">Cooldown Tracker</h1><p style="margin:0;color:#526277;font-size:15px">Bloqueos y ajustes locales · Dos vistas de la extensión</p></header><main style="display:flex;gap:44px;justify-content:center"><section><p style="font-size:13px;color:#526277;margin:0 0 8px">TUS SITIOS</p><iframe id="overview-frame" title="Vista de sitios" style="width:420px;height:640px;border:1px solid #dce5e7;border-radius:12px;background:white"></iframe></section><section><p style="font-size:13px;color:#526277;margin:0 0 8px">CONFIGURACIÓN</p><iframe id="settings-frame" title="Vista de configuración" style="width:420px;height:640px;border:1px solid #dce5e7;border-radius:12px;background:white"></iframe></section></main>';
    for(const frame of document.querySelectorAll('iframe'))frame.src=url;
  },config.extensionUrl);
  await capture.frameLocator('#overview-frame').getByRole('heading',{name:'Pausa de vídeos',exact:true}).waitFor();
  const settingsView=capture.frameLocator('#settings-frame');
  await settingsView.getByRole('button',{name:'Abrir configuración'}).click();
  await settingsView.getByRole('heading',{name:'Configuración',exact:true}).waitFor();
  await capture.screenshot({path:config.output+'/extension-overview.png',animations:'disabled'});
  await settingsView.getByRole('button',{name:'Importar datos',exact:true}).scrollIntoViewIfNeeded();
  await capture.screenshot({path:config.output+'/extension-settings.png',animations:'disabled'});
  await capture.close();
  await target.close();
  return {passed};
}
