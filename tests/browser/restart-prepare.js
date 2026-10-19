async (page)=>{
  const endAt=Date.now()+4000;
  await page.evaluate(async endAt=>{
    for(const id of Object.keys(await chrome.notifications.getAll()))await chrome.notifications.clear(id);
    const result=await chrome.runtime.sendMessage({type:'state-mutate',requestId:'restart-'+endAt,command:{kind:'import',hasItems:true,items:[{id:'restart',label:'Tras reiniciar',url:'https://restart.example.test/',scope:'domain',mode:'cooldown',durationMs:60000,endAt}],settings:{notificationsOn:true}}});if(!result.ok)throw Error(result.error);
  },endAt);
  return {endAt};
}
