'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fx = require('../../js/v2/battle-fx-adapter.js');
const player = require('../../js/v2/battle-event-player.js');
const events = require('../../js/v2/battle-events.js');
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}\n${error.stack}\n`); process.exitCode = 1; }
}
function snapshot(kind) { return { enemiesById:{ target:{ instanceId:'target', kind, defeated:true } } }; }
function event(type, id) { return { eventId:id || 'event-0', slot:4, type, actor:'sora', target:'target', payload:{}, mutations:[] }; }

test('the same event sequence maps to the same visual cue sequence without mutating its snapshot',()=>{
  const state=snapshot('daily'); const before=events.safeClone(state,'$',0);
  const list=[event('DAMAGE','event-0'),event('BARRIER_ABSORBED','event-1'),event('ENEMY_DEFEATED','event-2')];
  const first=list.flatMap(item=>fx.cuesFor({event:item,snapshot:state}).map(cue=>cue.type));
  const second=list.flatMap(item=>fx.cuesFor({event:item,snapshot:state}).map(cue=>cue.type));
  assert.deepEqual(first,['damage','vitalChange','barrierAbsorbed','vitalChange','dailyDefeat']);
  assert.deepEqual(second,first); assert.equal(events.deepEqual(state,before),true);
});
test('daily and weekly or area boss defeat choose their adopted presentation-only cues',()=>{
  assert.equal(fx.cuesFor({event:event('ENEMY_DEFEATED'),snapshot:snapshot('daily')})[0].type,'dailyDefeat');
  ['weekly','areaBoss'].forEach(kind=>assert.equal(fx.cuesFor({event:event('ENEMY_DEFEATED'),snapshot:snapshot(kind)})[0].type,'bossDefeat'));
  assert.equal(fx.CUE_TYPES.dailyDefeat.durationMs,2500); assert.equal(fx.CUE_TYPES.bossDefeat.durationMs,6000);
});
test('barrier, status, knockout, and vital events have explicit visual-only cues',()=>{
  assert.deepEqual(fx.cuesFor({event:event('BARRIER_ABSORBED'),snapshot:snapshot('daily')}).map(x=>x.type),['barrierAbsorbed','vitalChange']);
  assert.equal(fx.cuesFor({event:event('STATUS_APPLIED'),snapshot:snapshot('daily')})[0].type,'statusApplied');
  assert.equal(fx.cuesFor({event:event('STATUS_REMOVED'),snapshot:snapshot('daily')})[0].type,'statusRemoved');
  assert.equal(fx.cuesFor({event:event('KNOCKOUT'),snapshot:snapshot('daily')})[0].type,'knockout');
});
test('star road, leader, and union or overbreak retain the received event order',()=>{
  const ordered=['STAR_ROAD_RECONNECTION','LEADER_SKILL','STARLIGHT_UNION','OVERBREAK'];
  const mapped=ordered.map((type,index)=>fx.cuesFor({event:event(type,`event-${index}`),snapshot:snapshot('daily')})[0]);
  assert.deepEqual(mapped.map(item=>item.type),['starRoad','leader','union','overbreak']);
  assert.equal(mapped[0].label,'――《星路再結》――');
});
test('skip presents the already verified final snapshot without re-running events or changing it',()=>{
  const start={ enemiesById:{} }; const record={ version:1,battleId:'skip',startSnapshot:start,events:[{eventId:'event-0',slot:0,type:'BATTLE_STARTED',actor:null,target:null,payload:{},mutations:[]}],finalSnapshot:start };
  const received=[]; const p=player.create(record,payload=>received.push(payload)); const status=p.skip();
  assert.equal(status.done,true); assert.equal(events.deepEqual(status.snapshot,record.finalSnapshot),true);
  assert.equal(received.length,1); assert.equal(received[0].skipped,true); assert.equal(received[0].event,null);
});
test('FX renderer exception stops the event player before any controller commit can occur',()=>{
  const start={ enemiesById:{} }; const record={ version:1,battleId:'fx-error',startSnapshot:start,events:[{eventId:'event-0',slot:0,type:'DAMAGE',actor:null,target:null,payload:{},mutations:[]}],finalSnapshot:start };
  const adapter=fx.create({renderCue:()=>{ throw new Error('fx failed'); }}); const p=player.create(record,payload=>adapter.present(payload));
  const status=p.step(); assert.equal(status.stopped,true); assert.equal(status.index,0);
});
test('repeated FX presentation has no commit path and leaves the authoritative snapshot unchanged',()=>{
  const state=snapshot('daily'); const before=events.safeClone(state,'$',0); let rendered=0;
  const adapter=fx.create({renderCue:()=>{ rendered+=1; }}); const payload={event:event('DAMAGE'),snapshot:state};
  adapter.present(payload); adapter.present(payload);
  assert.equal(rendered,4); // DAMAGE always produces the same two presentation-only cues.
  assert.equal(events.deepEqual(state,before),true);
  assert.deepEqual(Object.keys(adapter),['present']);
  assert.equal(typeof adapter.commit,'undefined');
  assert.equal(typeof adapter.commitPending,'undefined');
  const adapterSource=fs.readFileSync(path.join(__dirname,'../../js/v2/battle-fx-adapter.js'),'utf8');
  assert.equal(/commitPending|saveInitialState|persistPending/.test(adapterSource),false);
  // Phase C owns the single commit gate; the adapter is deliberately absent from it.
  const controllerSource=fs.readFileSync(path.join(__dirname,'../../js/v2/battle-controller.js'),'utf8');
  assert.ok(/repository\.commitPending\(active\.record\.battleId\)/.test(controllerSource));
});
test('adapter source adds no RNG, unsafe HTML, network, dynamic code, or external dependency',()=>{
  const adapter=fx.create({renderCue:()=>{}}); assert.equal(typeof adapter.commit,'undefined');
  const source=fs.readFileSync(path.join(__dirname,'../../js/v2/battle-fx-adapter.js'),'utf8');
  [ /Math\.random/,/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/sendBeacon/,/\beval\s*\(/,/new\s+Function\b/,/innerHTML/,/insertAdjacentHTML/,/outerHTML/,/https?:\/\//,/\brequire\s*\(/,/^\s*import\s/m ].forEach(pattern=>assert.equal(pattern.test(source),false));
  assert.equal(fs.existsSync(path.join(__dirname,'../../package-lock.json')),false);
});
test('local viewport fixture loads the adapter before the formal UI',()=>{
  const fixture=fs.readFileSync(path.join(__dirname,'formal-battle-viewport.html'),'utf8');
  assert.ok(fixture.indexOf('battle-fx-adapter.js') < fixture.indexOf('formal-battle-ui.js'));
});
process.on('exit',()=>{ if(!process.exitCode) process.stdout.write(`# ${passed} Phase E tests passed\n`); });
