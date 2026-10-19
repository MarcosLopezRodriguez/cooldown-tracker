async (page,config)=>{
  const passed=[];
  const until=async(fn,arg,timeout=15000,view=page)=>{const limit=Date.now()+timeout;while(Date.now()<limit){if(await view.evaluate(fn,arg))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('No se cumplió la condición de Chrome dentro del plazo');};

  const I='cooldown_site_timers_v1';
  const endAt=Date.now()+4000;
  await page.evaluate(async ({I,endAt})=>{
    const response=await chrome.runtime.sendMessage({type:'state-mutate',requestId:'suspend-'+endAt,command:{kind:'import',hasItems:true,items:[{id:'suspend',url:'https://suspend.example.test/',label:'Suspensión',mode:'cooldown',scope:'domain',durationMs:60000,endAt}],settings:{notificationsOn:true}}});
    if(!response.ok)throw Error(response.error);
    for(const id of Object.keys(await chrome.notifications.getAll()))await chrome.notifications.clear(id);
    const values=await chrome.storage.local.get(I);if(values[I][0].endAt!==endAt)throw Error('Temporizador no preparado');
  },{I,endAt});
  const cdp=await page.context().newCDPSession(page);
  const versions=[];
  cdp.on('ServiceWorker.workerVersionUpdated',event=>versions.push(...event.versions));
  await cdp.send('ServiceWorker.enable');
  for(let i=0;i<30&&!versions.some(version=>version.scriptURL.endsWith('/background.js'));i++)await new Promise(resolve=>setTimeout(resolve,50));
  const version=versions.findLast(version=>version.scriptURL.endsWith('/background.js'));
  if(!version)throw Error('No se encontró versión de service worker para suspender');
  await page.goto('about:blank');
  await cdp.send('ServiceWorker.stopWorker',{versionId:version.versionId});
  passed.push('service worker real detenido mediante CDP');
  const probe=await page.context().newPage();
  await probe.goto(config.extensionUrl.replace('index.html','blocked.html')+'?target='+encodeURIComponent('https://suspend.example.test/'));
  await until(I=>chrome.storage.local.get(I).then(values=>values[I]?.[0]?.endAt===null),I,15000,probe);
  const state=await probe.evaluate(async()=>({notices:await chrome.notifications.getAll(),state:await chrome.storage.local.get(null)}));
  const expected='cooldown-ready:suspend:'+endAt;
  if(Object.keys(state.notices).filter(id=>id===expected).length!==1)throw Error('Alarma perdida al reanudar el trabajador');
  passed.push('alarma despierta el trabajador y finaliza con popup cerrado','aviso tras reanudación con identidad estable');
  await page.goto(config.extensionUrl);await page.getByRole('heading',{name:'Suspensión',exact:true}).waitFor();
  await probe.close();await cdp.detach();
  const justAt=Date.now()+1500;
  await page.evaluate(async endAt=>{
    const result=await chrome.runtime.sendMessage({type:'state-mutate',requestId:'boundary-'+endAt,command:{kind:'import',hasItems:true,items:[{id:'boundary',label:'Al vencer',url:'https://boundary.example.test/',scope:'domain',mode:'cooldown',durationMs:60000,endAt}],settings:{notificationsOn:true}}});if(!result.ok)throw Error(result.error);
  },justAt);
  await page.goto('about:blank');await new Promise(resolve=>setTimeout(resolve,Math.max(0,justAt-Date.now()+5)));
  await page.goto(config.extensionUrl);await page.getByRole('heading',{name:'Al vencer',exact:true}).waitFor();
  await until(()=>chrome.storage.local.get('cooldown_site_timers_v1').then(values=>values.cooldown_site_timers_v1[0].endAt===null));
  const boundary=await page.evaluate(()=>chrome.notifications.getAll());
  if(!boundary['cooldown-ready:boundary:'+justAt])throw Error('Aviso omitido al abrir justo al vencer');
  passed.push('abrir justo al vencer conserva el aviso');
  return {passed,endAt,stoppedVersion:version.versionId,notificationIds:Object.keys(state.notices)};
}
