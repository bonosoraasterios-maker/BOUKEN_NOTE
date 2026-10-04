'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const schedulerApi = require('../../js/v2/battle-presentation-scheduler.js');
const fx = require('../../js/v2/battle-fx-adapter.js');
const ui = require('../../js/v2/formal-battle-ui.js');
const bootstrap = require('../../js/v2/formal-battle-bootstrap.js');
const events = require('../../js/v2/battle-events.js');
const repositoryApi = require('../../js/v2/save-repository.js');
const controllerApi = require('../../js/v2/battle-controller.js');
const calculator = require('../../js/v2/battle-calculator.js');
const migration = require('../../js/v2/save-migration.js');
const characterBundle = require('../../data/v2/characters.js');
const characters = characterBundle.characters;
const skills = require('../../data/v2/skills.js');
const enemies = require('../../data/v2/enemies.js');
const statusEffects = require('../../data/v2/status-effects.js');
const battleRules = require('../../data/v2/battle-rules.js');
const missions = require('../../data/v2/missions.js');
const definitionBundle = {characters:characterBundle,enemies,skills,statusEffects,battleRules,missions};

let passed = 0;
const pending = [];
function test(name, fn) {
  pending.push(Promise.resolve().then(fn).then(() => { passed += 1; process.stdout.write(`ok - ${name}\n`); }).catch(error => {
    process.stderr.write(`not ok - ${name}\n${error.stack}\n`); process.exitCode = 1;
  }));
}
function payload(kind, eventType, index) {
  const target = kind ? `${kind}-enemy` : null;
  return {
    event:{eventId:`event-${index}`,slot:4,type:eventType,actor:'sora',target,payload:{},mutations:[]},
    snapshot:{enemiesById:kind ? {[target]:{instanceId:target,kind,defeated:eventType === 'ENEMY_DEFEATED'}} : {}},
    index
  };
}
function scriptedController(steps) {
  let cursor = 0, finalizations = 0, attacks = 0, recoveries = 0, skips = 0;
  return {
    attack() { attacks += 1; },
    recover() { recoveries += 1; return {done:false}; },
    step() { const next = steps[cursor++]; return Object.assign({stopped:false,snapshot:{cursor},lastPayload:null},next); },
    finalize() { finalizations += 1; return {final:true}; },
    skip() { skips += 1; return {skipped:true}; },
    counters:() => ({attacks,recoveries,skips,finalizations})
  };
}
class FakeNode {
  constructor(tag) { this.tagName=tag.toUpperCase(); this.children=[]; this.attributes={}; this.style={}; this.listeners={}; this.parentNode=null; this.className=''; this.textContent=''; this.disabled=false; }
  appendChild(node) { node.parentNode=this; this.children.push(node); return node; }
  removeChild(node) { this.children.splice(this.children.indexOf(node),1); node.parentNode=null; return node; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(name,value) { this.attributes[name]=String(value); }
  addEventListener(type,fn) { this.listeners[type]=fn; }
}
const document = { createElement:tag => new FakeNode(tag) };
function memoryStorage() {
  const map = new Map();
  return { map, getItem:key=>map.has(key) ? map.get(key) : null, setItem:(key,value)=>map.set(key,String(value)), removeItem:key=>map.delete(key) };
}
function legacyState() {
  const source = { coin:20,dailyEnemies:[{id:1,hp:800,day:'2026-09-27'}],weeklyHP:0,party:[600,1200,400],daily:[1,0,0],weekly:[0,0,0],special:[0,0,0],battlePts:0,skillSP:0,beast:null,beastQueue:[],bleed:[0,0,0],weeklyPhaseSkillUsed:false,loginDay:'2026-09-27',enemyDay:'2026-09-27',weekKey:'2026-09-21' };
  const state = migration.migrateLegacyToV2(JSON.stringify(source), {migratedAt:'2026-09-27T05:00:00+09:00'}).candidate;
  assert.equal(state.missions.daily.resultCount,1);
  assert.deepEqual(state.missions.daily.completedIds,['daily_1']);
  assert.equal(state.missions.daily.date,'2026-09-27');
  assert.equal(state.calendar.localDate,'2026-09-27');
  assert.equal(state.calendar.timezone,'Asia/Tokyo');
  return state;
}

test('scheduler preserves event order and holds Daily and Boss defeat FX for their adopted durations', async () => {
  const controller=scriptedController([
    {done:false,lastPayload:payload('daily','ENEMY_DEFEATED',0)},
    {done:true,lastPayload:payload('weekly','ENEMY_DEFEATED',1)}
  ]);
  const waits=[]; const seen=[];
  const scheduler=schedulerApi.create({controller,wait:milliseconds=>{ waits.push(milliseconds); return Promise.resolve(); },onState:state=>seen.push(state)});
  const final=await scheduler.run();
  assert.deepEqual(final,{final:true});
  assert.deepEqual(waits,[2500,6000]);
  assert.equal(controller.counters().finalizations,1);
  assert.equal(scheduler.isRunning(),false);
  assert.ok(seen.some(item=>item.running));
});

test('ATTACK flows Controller to Event Player to Formal UI and commits only after presentation reaches finalSnapshot', async () => {
  const storage=memoryStorage(); const repository=repositoryApi.create(storage); const initial=legacyState(); repository.saveInitialState(initial);
  const host=new FakeNode('main'); const instance=ui.create({document,host,definitions:{characters,skills}});
  const controller=controllerApi.create({repository,calculateBattle:calculator.calculateBattle});
  controller.setPresenter(instance.present);
  const scheduler=schedulerApi.create({controller,wait:()=>Promise.resolve(),onState:state=>instance.setLocked(state.running || controller.isLocked())});
  const input={battleId:'phase-g-pipeline',battleDate:'2026-09-27',dailyResult:1,attackerSkillId:null,leaderCharacterId:null};
  const final=await scheduler.attack(input,definitionBundle,'phase-g-seed');
  assert.equal(events.deepEqual(final,repository.loadState().state),true);
  assert.equal(repository.loadPending(),null);
  assert.equal(controller.isLocked(),false);
  assert.equal(instance.registry.attack.disabled,false);
});

test('ATTACK enters the scheduler once and duplicate scheduling is rejected', async () => {
  let release; const controller=scriptedController([{done:true,lastPayload:payload(null,'DAMAGE',0)}]);
  const scheduler=schedulerApi.create({controller,wait:()=>new Promise(resolve=>{release=resolve;})});
  const running=scheduler.attack({id:'input'},{},'seed');
  assert.equal(controller.counters().attacks,1);
  assert.throws(()=>scheduler.run(),error=>error.code==='SCHEDULER_RUNNING');
  release(); await running;
  assert.equal(controller.counters().finalizations,1);
});

test('skip cancels the current visual wait and converges through the controller skip gate', async () => {
  let release; const controller=scriptedController([{done:false,lastPayload:payload('daily','ENEMY_DEFEATED',0)}]);
  const scheduler=schedulerApi.create({controller,wait:()=>new Promise(resolve=>{release=resolve;})});
  const running=scheduler.run();
  const final=scheduler.skip();
  assert.deepEqual(final,{skipped:true});
  release();
  assert.equal(await running,null);
  assert.equal(controller.counters().skips,1);
  assert.equal(controller.counters().finalizations,0);
});

test('reload recovery resumes a pending presentation without calling attack or calculator paths', async () => {
  const controller=scriptedController([{done:true,lastPayload:payload(null,'STARLIGHT_UNION',0)}]);
  const scheduler=schedulerApi.create({controller,wait:()=>Promise.resolve()});
  assert.deepEqual(await scheduler.recover(),{final:true});
  assert.deepEqual(controller.counters(),{attacks:0,recoveries:1,skips:0,finalizations:1});
});

test('a stopped event player rejects safely before final commit', async () => {
  const controller=scriptedController([{done:false,stopped:true,error:new Error('fx failed'),lastPayload:null}]);
  const scheduler=schedulerApi.create({controller,wait:()=>Promise.resolve()});
  await assert.rejects(scheduler.run(),error=>error.code==='PLAYER_STOPPED');
  assert.equal(controller.counters().finalizations,0);
});

test('formal UI presentation returns visual cues without mutating the supplied snapshot', () => {
  const host=new FakeNode('main');
  const instance=ui.create({document,host,definitions:{characters,skills},fxAdapter:{present:entry=>Object.freeze({cues:[entry.event.type]})}});
  const state={partySlots:{},charactersById:{},enemyOrder:[],enemiesById:{}};
  const before=events.safeClone(state,'$',0);
  assert.deepEqual(instance.present({event:{type:'DAMAGE'},snapshot:state,index:0}),{cues:['DAMAGE']});
  assert.equal(events.deepEqual(state,before),true);
});

test('feature flag remains false by default and a v2 mount needs explicit verification mode', () => {
  assert.equal(bootstrap.DEFAULT_CONFIG.formalBattleV2,false);
  assert.equal(bootstrap.start({document,host:new FakeNode('main'),config:{formalBattleV2:true,verificationMode:false}}),null);
  assert.ok(bootstrap.start({document,host:new FakeNode('main'),config:{formalBattleV2:true,verificationMode:true},definitions:{characters,skills}}));
});

test('candidate artwork remains absent by default and may only be selected by the explicit preview option', () => {
  const registry={resolve:key=>key === 'portrait.sora' ? {key,path:'assets/sora.webp',sourcePath:'assets/sora.webp',approval:'candidate'} : null};
  const defaultHost=new FakeNode('main'); const previewHost=new FakeNode('main');
  const snapshot={partySlots:{protagonist:{characterId:'sora'}},charactersById:{sora:{statusIds:[],resources:{}}},enemyOrder:[],enemiesById:{}};
  const defaults=ui.create({document,host:defaultHost,definitions:{characters,skills},assetRegistry:registry}); defaults.render(snapshot,{locked:false});
  const preview=ui.create({document,host:previewHost,definitions:{characters,skills},assetRegistry:registry,allowNonFormalPreviewAssets:true}); preview.render(snapshot,{locked:false});
  const find = node => [node].concat(node.children.flatMap(find));
  assert.equal(find(defaults.root).some(node=>node.tagName==='IMG'),false);
  assert.equal(find(preview.root).some(node=>node.tagName==='IMG'),true);
});

test('scheduler is the only Phase G runtime holder of timers and adds no network or dependency', () => {
  const schedulerSource=fs.readFileSync(path.join(__dirname,'../../js/v2/battle-presentation-scheduler.js'),'utf8');
  const core=['battle-calculator.js','battle-controller.js','battle-event-player.js','save-repository.js'].map(file=>fs.readFileSync(path.join(__dirname,'../../js/v2',file),'utf8')).join('\n');
  assert.ok(/setTimeout/.test(schedulerSource));
  assert.equal(/setTimeout|setInterval/.test(core),false);
  [ /Math\.random/,/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/sendBeacon/,/\beval\s*\(/,/new\s+Function\b/,/innerHTML/,/https?:\/\// ].forEach(pattern=>assert.equal(pattern.test(schedulerSource),false));
  assert.equal(fs.existsSync(path.join(__dirname,'../../package-lock.json')),false);
});

test('scheduler cue timing is derived from the already-determined event payload only', () => {
  assert.equal(schedulerApi.durationFor(payload('daily','ENEMY_DEFEATED',0)),2500);
  assert.equal(schedulerApi.durationFor(payload('areaBoss','ENEMY_DEFEATED',0)),6000);
  assert.equal(schedulerApi.durationFor(payload(null,'STAR_ROAD_RECONNECTION',0)),1100);
  assert.equal(schedulerApi.durationFor({event:null,snapshot:{}}),0);
  assert.equal(typeof fx.cuesFor,'function');
});

Promise.all(pending).then(() => {
  if (!process.exitCode) process.stdout.write(`# ${passed} Phase G tests passed\n`);
});
