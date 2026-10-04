'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const load = relative => vm.runInThisContext(fs.readFileSync(path.join(__dirname, relative), 'utf8'), { filename:relative });
[
  '../../js/v2/save-repository.js','../../js/v2/battle-event-player.js','../../js/v2/battle-controller.js'
].forEach(load);
const v2 = globalThis.BOUKEN_NOTE_V2;
const repositoryApi = v2.saveRepository;
const playerApi = v2.battleEventPlayer;
const controllerApi = v2.battleController;
const battleEvents = v2.battleEvents;
const calculator = v2.battleCalculator;
const migration = v2.saveMigration;
const definitions = {
  characters:v2.characters,enemies:v2.enemies,skills:v2.skills,statusEffects:v2.statusEffects,
  battleRules:v2.battleRules,missions:v2.missions
};
const clone = value => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}\n${error.stack}\n`); process.exitCode = 1; }
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
function memoryStorage() {
  const map = new Map();
  return {
    map, failSetKey:null, failRemoveKey:null,
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key,value) { if (this.failSetKey === key) throw new Error('quota'); map.set(key,String(value)); },
    removeItem(key) { if (this.failRemoveKey === key) throw new Error('remove'); map.delete(key); }
  };
}
function setup(counter) {
  const storage = memoryStorage();
  const repository = repositoryApi.create(storage);
  repository.saveInitialState(legacyState());
  const calculate = (state,input,defs,seed) => { if (counter) counter.count += 1; return calculator.calculateBattle(state,input,defs,seed); };
  const controller = controllerApi.create({repository,calculateBattle:calculate});
  const input = {battleId:'phase-c-battle',battleDate:'2026-09-27',dailyResult:1,attackerSkillId:null,leaderCharacterId:null};
  return {storage,repository,controller,input};
}

test('normal playback commits the verified finalSnapshot', () => {
  const x=setup(); x.controller.attack(x.input,definitions,'phase-c-normal');
  const pending=x.repository.loadPending(); const final=x.controller.playAll();
  assert.equal(battleEvents.deepEqual(final,pending.finalSnapshot),true);
  assert.equal(x.repository.loadPending(),null);
});

test('skip and normal playback converge to the identical finalSnapshot', () => {
  const a=setup(), b=setup();
  a.controller.attack(a.input,definitions,'same-seed'); b.controller.attack(b.input,definitions,'same-seed');
  assert.equal(battleEvents.deepEqual(a.controller.playAll(),b.controller.skip()),true);
});

test('reload recovery at six interruption points never recalculates', () => {
  const requested = [0,0,1,'middle','last','complete'];
  requested.forEach((point,i) => {
    const counter={count:0}, x=setup(counter);
    x.input.battleId=`reload-${i}`;
    x.controller.attack(x.input,definitions,'reload-seed');
    const pending=x.repository.loadPending();
    let steps=point;
    if (point==='middle') steps=Math.floor(pending.events.length/2);
    if (point==='last') steps=pending.events.length-1;
    if (point==='complete') steps=pending.events.length;
    for(let n=0;n<steps;n++) x.controller.step();
    const reloaded=controllerApi.create({repository:x.repository,calculateBattle:()=>{ counter.count+=1; throw new Error('must not calculate'); }});
    const recovered=reloaded.recover();
    assert.ok(recovered);
    const final=reloaded.skip();
    assert.equal(battleEvents.deepEqual(final,pending.finalSnapshot),true);
    assert.equal(counter.count,1);
  });
});

test('double ATTACK and double pending commit are rejected', () => {
  const x=setup(); x.controller.attack(x.input,definitions,'double');
  assert.throws(()=>x.controller.attack(x.input,definitions,'double'),e=>e.code==='ATTACK_LOCKED');
  const id=x.repository.loadPending().battleId;
  x.controller.skip();
  assert.throws(()=>x.repository.commitPending(id),e=>e.code==='NO_PENDING_BATTLE');
});

test('malformed pendingBattle is rejected without recalculation', () => {
  const x=setup(); x.storage.map.set(repositoryApi.KEYS.pending,'{"version":1,"battleId":"x","events":[]}');
  let calls=0;
  const reloaded=controllerApi.create({repository:x.repository,calculateBattle:()=>{ calls+=1; }});
  assert.throws(()=>reloaded.recover(),e=>e.code==='MALFORMED_PENDING');
  assert.equal(calls,0);
});

test('state parse failure uses a valid backup and rejects when none exists', () => {
  const x=setup(); const valid=x.storage.map.get(repositoryApi.KEYS.state);
  x.storage.map.set(repositoryApi.KEYS.backup,valid); x.storage.map.set(repositoryApi.KEYS.state,'{broken');
  const loaded=x.repository.loadState(); assert.equal(loaded.recoveredFromBackup,true);
  x.storage.map.delete(repositoryApi.KEYS.backup);
  assert.throws(()=>x.repository.loadState(),e=>e.code==='STATE_PARSE_FAILED');
});

test('pending write failure preserves the existing authoritative state', () => {
  const counter={count:0}, x=setup(counter); const before=x.storage.map.get(repositoryApi.KEYS.state);
  x.storage.failSetKey=repositoryApi.KEYS.pending;
  assert.throws(()=>x.controller.attack(x.input,definitions,'quota'),e=>e.code==='STORAGE_WRITE_FAILED');
  assert.equal(x.storage.map.get(repositoryApi.KEYS.state),before);
  assert.equal(x.storage.map.has(repositoryApi.KEYS.pending),false);
});

test('reload finishes cleanup when final state write succeeded before interruption', () => {
  const x=setup(); x.controller.attack(x.input,definitions,'commit-interruption');
  const pending=x.repository.loadPending();
  x.storage.map.set(repositoryApi.KEYS.backup,x.storage.map.get(repositoryApi.KEYS.state));
  x.storage.map.set(repositoryApi.KEYS.state,JSON.stringify(pending.finalSnapshot));
  const reloaded=controllerApi.create({repository:x.repository,calculateBattle:()=>{ throw new Error('must not calculate'); }});
  reloaded.recover();
  const final=reloaded.skip();
  assert.equal(battleEvents.deepEqual(final,pending.finalSnapshot),true);
  assert.equal(x.repository.loadPending(),null);
});

test('event player callback exception stops safely before authoritative commit', () => {
  const x=setup(); const before=x.storage.map.get(repositoryApi.KEYS.state);
  const result=calculator.calculateBattle(legacyState(),x.input,definitions,'present-error');
  const pending=repositoryApi.createPending(legacyState(),result);
  const player=playerApi.create(pending,()=>{ throw new Error('renderer failed'); });
  const status=player.step(); assert.equal(status.stopped,true); assert.equal(status.index,0);
  assert.equal(x.storage.map.get(repositoryApi.KEYS.state),before);
});

test('pendingBattle has bounded, replayable saved fields only', () => {
  const x=setup(); x.controller.attack(x.input,definitions,'saved-example');
  const raw=x.storage.map.get(repositoryApi.KEYS.pending); const saved=JSON.parse(raw);
  assert.deepEqual(Object.keys(saved),['version','battleId','startSnapshot','events','finalSnapshot']);
  assert.ok(saved.events.length>0); assert.ok(raw.length<=repositoryApi.LIMITS.maxBytes);
  assert.equal(battleEvents.replayBattleEvents(saved.startSnapshot,saved.events,saved.finalSnapshot).matchesExpected,true);
});

test('Phase C source adds no network, dynamic code, random, timer, or dependency', () => {
  const files=['save-repository.js','battle-controller.js','battle-event-player.js'];
  const source=files.map(file=>fs.readFileSync(path.join(__dirname,'../../js/v2',file),'utf8')).join('\n');
  [ /\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/sendBeacon/,/\beval\s*\(/,/new\s+Function\b/,/Math\.random/,/setTimeout/,/setInterval/ ].forEach(pattern=>assert.equal(pattern.test(source),false));
  assert.equal(fs.existsSync(path.join(__dirname,'../../package-lock.json')),false);
});

process.on('exit',()=>{ if(!process.exitCode) process.stdout.write(`# ${passed} tests passed\n`); });
