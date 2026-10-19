async (page,config)=>{
  const passed=[];
  const until=async(fn,arg,timeout=15000,view=page)=>{const limit=Date.now()+timeout;while(Date.now()<limit){if(await view.evaluate(fn,arg))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('No se cumplió la condición de Chrome dentro del plazo');};

  await page.goto(config.extensionUrl.replace('index.html','blocked.html')+'?target='+encodeURIComponent('https://restart.example.test/'));
  await until(()=>chrome.storage.local.get('cooldown_site_timers_v1').then(v=>v.cooldown_site_timers_v1?.[0]?.id==='restart'&&v.cooldown_site_timers_v1[0].endAt===null));
  const result=await page.evaluate(async()=>({state:await chrome.storage.local.get(null),notifications:await chrome.notifications.getAll()}));
  if(!result.notifications['cooldown-ready:restart:'+config.endAt])throw Error('Reinicio perdió el aviso pendiente');
  passed.push('reinicio real de Chrome conserva y finaliza el temporizador','reinicio real crea el aviso pendiente');
  await page.goto(config.extensionUrl);await page.getByRole('heading',{name:'Tras reiniciar',exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Tras reiniciar',exact:true}).waitFor();
  const meta=await page.evaluate(()=>chrome.storage.local.get('cooldown_coordinator_v1'));
  if(meta.cooldown_coordinator_v1.completed.filter(key=>key==='restart:'+config.endAt).length!==1)throw Error('Finalización duplicada tras reiniciar');
  passed.push('recarga tras reinicio mantiene una sola finalización');
  return {passed,notificationIds:Object.keys(result.notifications)};
}
