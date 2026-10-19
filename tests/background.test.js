import assert from "node:assert/strict";
import test from "node:test";
import { harness, rule } from "./helpers/chrome.js";
import { LS_KEY as ITEMS, LS_SETTINGS_KEY as SETTINGS } from "../src/lib/constants.js";
import { makeStatePatch } from "../extension/lib/operations.js";

const snapshot = h => ({items:structuredClone(h.data[ITEMS]),settings:structuredClone(h.data[SETTINGS])});

test("sin aceptación: instalación, arranque, cambios y navegación no inspeccionan pestañas", async () => {
  const h=harness(false,[rule(),rule({id:'timer',mode:'cooldown',endAt:2060000})]);
  await h.events.install(); await h.events.startup();
  await h.events.change({[ITEMS]:{newValue:h.data[ITEMS]}},'local');
  for(const name of ['navigate','history','fragment']) await h.events[name]({frameId:0,tabId:1,url:'https://example.com/'});
  assert.equal((await h.message({type:'open-site',siteId:'test'})).ok,false);
  for(const key of ['query','update','create','alarm','notify','write'])assert.equal(h.calls[key].length,0,key);
});
test("una alarma recibida sin aceptación no modifica datos ni notifica", async()=>{
  const h=harness(false,[rule({mode:'cooldown',endAt:1999000})]);
  await h.events.alarm({name:'cooldown:test:1999000'});
  assert.equal(h.calls.write.length,0);assert.equal(h.calls.notify.length,0);
});
test("activar bloquea y programa alarmas; revocar elimina solo las propias", async()=>{
  const h=harness(true,[rule(),rule({id:'timer',mode:'cooldown',endAt:2060000})]);
  await h.events.startup();
  assert.equal(h.calls.alarm.length,1);assert.equal(h.calls.query.length,1);
  assert.match(h.calls.update[0][1].url,/blocked.html\?ruleId=test/);
  h.alarms.set('unrelated',{});h.data[SETTINGS].privacyAccepted=false;
  await h.events.change({[SETTINGS]:{}},'local');
  assert.deepEqual([...h.alarms.keys()],['unrelated']);assert.equal(h.calls.query.length,1);
});
test("revocar durante una consulta pendiente evita redirecciones",async()=>{
  const h=harness(true);h.chrome.tabs.query=async()=>{h.data[SETTINGS].privacyAccepted=false;return[{id:1,url:'https://example.com/'}];};
  await h.events.startup();assert.equal(h.calls.update.length,0);
});
test("una lectura fallida en background no escribe ni bloquea",async()=>{
  const h=harness(true);h.chrome.storage.local.get=async()=>{throw Error('unavailable');};
  await h.events.startup();await h.events.navigate({frameId:0,tabId:1,url:'https://example.com/'});
  assert.equal(h.calls.write.length,0);assert.equal(h.calls.query.length,0);assert.equal(h.calls.update.length,0);
});
test("abrir desde la app concede paso en navegación normal, History API y hash",async()=>{
  const h=harness(true);
  assert.equal((await h.message({type:'open-site',siteId:'test'})).ok,true);
  for(const name of ['navigate','history','fragment']) await h.events[name]({frameId:0,tabId:2,url:'https://example.com/path#hash'});
  assert.equal(h.calls.update.length,1);assert.equal(h.calls.update[0][1].url,'https://example.com/');
});
test("dos alarmas concurrentes finalizan ambos temporizadores y notifican una vez",async()=>{
  const h=harness(true,[rule({id:'a',mode:'cooldown',endAt:1999000}),rule({id:'b',url:'https://other.test/',mode:'cooldown',endAt:1999000})]);
  await Promise.all([h.events.alarm({name:'cooldown:a:1999000'}),h.events.alarm({name:'cooldown:b:1999000'})]);
  assert.ok(h.data[ITEMS].every(item=>item.endAt===null));assert.equal(h.calls.notify.length,2);
  await h.events.startup();await h.message({type:'state-read'});
  await h.events.alarm({name:'cooldown:a:1999000'});assert.equal(h.calls.notify.length,2);
});
test("expirar simultáneamente a editar, añadir y borrar conserva las operaciones",async()=>{
  const h=harness(true,[rule({mode:'cooldown',endAt:1999000}),rule({id:'delete',url:'https://delete.test/'})]);
  const before=snapshot(h),after=structuredClone(before);
  after.items=after.items.filter(item=>item.id!=='delete');after.items[0].label='Editada';after.items.push(rule({id:'added',url:'https://added.test/'}));
  await Promise.all([h.events.alarm({name:'cooldown:test:1999000'}),h.controller.mutate(makeStatePatch(before,after))]);
  assert.equal(h.data[ITEMS][0].endAt,null);assert.equal(h.data[ITEMS][0].label,'Editada');
  assert.deepEqual(h.data[ITEMS].map(item=>item.id),['test','added']);
});
test("dos interfaces con snapshots antiguos conservan campos y reglas de ambas",async()=>{
  const h=harness(true);const before=snapshot(h),a=structuredClone(before),b=structuredClone(before);
  a.items[0].label='Ventana A';b.items[0].durationMs=120000;b.items.push(rule({id:'b',url:'https://b.test/'}));
  await Promise.all([h.controller.mutate(makeStatePatch(before,a)),h.controller.mutate(makeStatePatch(before,b))]);
  assert.equal(h.data[ITEMS][0].label,'Ventana A');assert.equal(h.data[ITEMS][0].durationMs,120000);assert.equal(h.data[ITEMS].length,2);
  const stale=structuredClone(before);stale.items[0].label='Stale';
  await h.controller.mutate({kind:'patch',deletes:['test']});
  await assert.rejects(h.controller.mutate(makeStatePatch(before,stale)),/staleSite/);
  assert.deepEqual(h.data[ITEMS].map(item=>item.id),['b']);
});
test("importar ajustes parciales conserva reglas actuales y consentimiento local",async()=>{
  const h=harness(true);await h.controller.mutate({kind:'import',hasItems:false,settings:{soundOn:false,privacyAccepted:false}});
  assert.equal(h.data[ITEMS].length,1);assert.equal(h.data[SETTINGS].privacyAccepted,true);
  h.data[SETTINGS].privacyAccepted=false;
  await h.controller.mutate({kind:'import',hasItems:true,items:[rule()],settings:{privacyAccepted:true}});
  assert.equal(h.data[SETTINGS].privacyAccepted,false);
});
test("reanudar tras suspensión finaliza vencidos una vez y respeta avisos desactivados",async()=>{
  const h=harness(true,[rule({mode:'cooldown',endAt:2060000})]);
  await h.events.startup();h.setTime(2100000);await h.events.startup();
  assert.equal(h.calls.notify.length,1);assert.equal(h.calls.notify[0][0],'cooldown-ready:test:2060000');
  await h.events.startup();assert.equal(h.calls.notify.length,1);
  const silent=harness(true,[rule({mode:'cooldown',endAt:1999000})]);silent.data[SETTINGS].notificationsOn=false;
  await silent.events.startup();assert.equal(silent.data[ITEMS][0].endAt,null);assert.equal(silent.calls.notify.length,0);
});
test("un requestId repetido no vuelve a aplicar una operación tras reintentar",async()=>{
  const h=harness(true);const command={kind:'patch',settings:{language:'en'}};
  await h.controller.mutate(command,'request-a');const count=h.calls.write.length;
  await h.controller.mutate(command,'request-a');assert.equal(h.calls.write.length,count);
});
test("los eventos internos de URL bloquean rutas exactas sin bucles en páginas de extensión",async()=>{
  const h=harness(true,[rule({scope:'exact',url:'https://example.com/blocked?q=1#hash'})]);
  for(const name of ['history','fragment'])await h.events[name]({frameId:0,tabId:1,url:'https://example.com/blocked?q=1#hash'});
  assert.equal(h.calls.update.length,1);
  await h.events.history({frameId:0,tabId:1,url:'https://example.com/blocked?q=2#hash'});
  await h.events.navigate({frameId:0,tabId:1,url:'chrome-extension://test/blocked.html'});
  assert.equal(h.calls.update.length,1);
});
