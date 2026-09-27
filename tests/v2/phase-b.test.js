'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const load = relative => vm.runInThisContext(fs.readFileSync(path.join(__dirname, relative), 'utf8'), { filename: relative });
[
  '../../data/v2/characters.js','../../data/v2/enemies.js','../../data/v2/skills.js',
  '../../data/v2/status-effects.js','../../data/v2/battle-rules.js','../../data/v2/missions.js',
  '../../js/v2/schema.js','../../js/v2/save-migration.js','../../js/v2/seeded-rng.js',
  '../../js/v2/battle-events.js','../../js/v2/battle-calculator.js'
].forEach(load);
const migration = globalThis.BOUKEN_NOTE_V2.saveMigration;
const events = globalThis.BOUKEN_NOTE_V2.battleEvents;
const calculator = globalThis.BOUKEN_NOTE_V2.battleCalculator;
const rng = globalThis.BOUKEN_NOTE_V2.seededRng;

const sourceDefinitions = {
  characters: globalThis.BOUKEN_NOTE_V2.characters,
  enemies: globalThis.BOUKEN_NOTE_V2.enemies,
  skills: globalThis.BOUKEN_NOTE_V2.skills,
  statusEffects: globalThis.BOUKEN_NOTE_V2.statusEffects,
  battleRules: globalThis.BOUKEN_NOTE_V2.battleRules,
  missions: globalThis.BOUKEN_NOTE_V2.missions
};
const clone = value => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}\n${error.stack}\n`); process.exitCode = 1; }
}
function expectCode(fn, code) {
  assert.throws(fn, error => error && error.code === code);
}
function baseState(options) {
  const legacy = {
    coin: 20, dailyEnemies: [{ id:1, hp:800, day:'2026-09-27' }], weeklyHP:0,
    party:[600,1200,400], daily:[0,0,0], weekly:[0,0,0], special:[0,0,0],
    battlePts:0, skillSP:0, beast:null, beastQueue:[], bleed:[0,0,0], weeklyPhaseSkillUsed:false,
    loginDay:'2026-09-27', enemyDay:'2026-09-27', weekKey:'2026-09-21'
  };
  const result = migration.migrateLegacyToV2(JSON.stringify(legacy), { migratedAt:'2026-09-27T05:00:00+09:00' });
  assert.equal(result.ok, true);
  const state = result.candidate;
  if (options && options.weekly) {
    const weekly = state.enemiesById.legacy_weekly_current;
    weekly.hp = 3000; weekly.defeated = false;
    state.enemyOrder.unshift('legacy_weekly_current');
  }
  return state;
}
function definitions(options) {
  const defs = clone(sourceDefinitions);
  if (options && options.weeklyProfile) defs.enemies.enemies.weekly_base.skillProfileId = options.weeklyProfile;
  return defs;
}
function input(overrides) {
  return Object.assign({ battleId:'test-battle', battleDate:'2026-09-27', dailyResult:0, attackerSkillId:null, leaderCharacterId:null }, overrides || {});
}
function addCharacterStatus(state, characterId, statusId, counters, payload) {
  const id = `existing-${statusId}`;
  state.statusInstances[id] = {
    instanceId:id,statusId,ownerType:'character',ownerId:characterId,sourceType:'enemy',sourceId:'legacy_daily_1',
    severity:sourceDefinitions.statusEffects.effects[statusId].severity,appliedBattleId:'earlier',
    counters:Object.assign({ticksRemaining:null,attemptsRemaining:null,spBlockRemaining:null,spentSpToClearRemaining:null,numericActionsRemaining:null,mainActionMarks:null,triggerAt:null},counters||{}),
    payload:payload||{},persistsAcrossBattle:true,clearsAtWeekStart:statusId==='finalHour'
  };
  state.charactersById[characterId].statusIds.push(id);
}

test('seeded RNG is deterministic and finite', () => {
  const a = rng.createSeededRng('same-seed'), b = rng.createSeededRng('same-seed');
  assert.deepEqual([a.next(),a.next(),a.int(1,100)], [b.next(),b.next(),b.int(1,100)]);
  assert.throws(() => rng.createSeededRng(Infinity));
});

test('same snapshot/input/definitions/seed produces byte-identical result', () => {
  const state = baseState(), defs = definitions();
  const a = calculator.calculateBattle(state, input(), defs, 'deterministic');
  const b = calculator.calculateBattle(state, input(), defs, 'deterministic');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(state.enemiesById.legacy_daily_1.hp, 800);
});

test('different seeds alter only seeded decisions while preserving valid replay', () => {
  const state = baseState({weekly:true}), defs = definitions({weeklyProfile:'stage1Single'});
  const a = calculator.calculateBattle(state, input(), defs, 'seed-A');
  const b = calculator.calculateBattle(state, input(), defs, 'seed-B');
  assert.notEqual(JSON.stringify(a.events), JSON.stringify(b.events));
  assert.equal(events.replayBattleEvents(state, a.events, a.finalSnapshot).matchesExpected, true);
  assert.equal(events.replayBattleEvents(state, b.events, b.finalSnapshot).matchesExpected, true);
});

test('event replay exactly equals finalSnapshot', () => {
  const state = baseState();
  state.charactersById.linnet.sp = 1;
  state.charactersById.linnet.resources.tameRoster = [{id:'t1'},{id:'t2'},{id:'t3'},{id:'t4'},{id:'t5'}];
  const result = calculator.calculateBattle(state, input({dailyResult:3,attackerSkillId:'linnet_a_tame_attack'}), definitions(), 'replay');
  const replay = events.replayBattleEvents(state, result.events, result.finalSnapshot);
  assert.equal(replay.matchesExpected, true);
  assert.equal(events.deepEqual(replay.snapshot, result.finalSnapshot), true);
});

test('slot 4 remains Star Road -> Leader -> SU/OB', () => {
  const state = baseState();
  state.battleProgress.suPoints = 4;
  const result = calculator.calculateBattle(state, input({dailyResult:1,leaderCharacterId:'aria'}), definitions(), 'slot-four');
  const types = result.events.map(event => event.type);
  const star = types.indexOf('STAR_ROAD_RECONNECTION');
  const leader = types.indexOf('LEADER_SKILL');
  const union = types.findIndex(type => type === 'STARLIGHT_UNION' || type === 'OVERBREAK');
  assert.ok(star >= 0 && star < leader && leader < union);
  assert.equal(result.finalSnapshot.battleProgress.suPoints, 0);
  assert.equal(result.finalSnapshot.battleProgress.dailySuUsedOn, '2026-09-27');
});

test('Barrier absorbs a whole hit and discards overflow', () => {
  const state = baseState();
  state.charactersById.ceres.hp = 0;
  state.charactersById.linnet.hp = 0;
  state.charactersById.aria.barrier = {current:50,maxDisplayReferenceHp:600};
  const result = calculator.calculateBattle(state, input(), definitions(), 'barrier');
  const absorbed = result.events.find(event => event.type === 'BARRIER_ABSORBED' && event.target === 'aria');
  assert.ok(absorbed);
  assert.equal(result.finalSnapshot.charactersById.aria.hp, 600);
  assert.equal(result.finalSnapshot.charactersById.aria.barrier.current, 0);
});

test('configured status attack applies one formal status without duplication', () => {
  const state = baseState({weekly:true});
  state.enemyOrder = ['legacy_weekly_current'];
  const defs = definitions({weeklyProfile:'stage1Single'});
  defs.enemies.skillProfiles.stage1Single.statusId = 'poison';
  defs.enemies.skillProfiles.stage1Single.damagePerHit = 150;
  defs.enemies.skillProfiles.stage1Single.dotDamage = 40;
  const result = calculator.calculateBattle(state, input(), defs, 'poison');
  const statusEvents = result.events.filter(event => event.type === 'STATUS_APPLIED');
  assert.equal(statusEvents.length, 1);
  assert.equal(Object.values(result.finalSnapshot.statusInstances)[0].statusId, 'poison');
});

test('poison ticks after an Attacker skill attempt and persists with one tick left', () => {
  const state = baseState();
  state.charactersById.linnet.sp=1;
  state.charactersById.linnet.resources.tameRoster=[{id:'t1'}];
  addCharacterStatus(state,'linnet','poison',{ticksRemaining:2},{dotDamage:40,pureDamage:200});
  const result=calculator.calculateBattle(state,input({dailyResult:1,attackerSkillId:'linnet_a_tame_attack'}),definitions(),'poison-tick');
  assert.equal(result.finalSnapshot.charactersById.linnet.hp,360);
  assert.equal(result.finalSnapshot.statusInstances['existing-poison'].counters.ticksRemaining,1);
});

test('burn increases the next direct hit by ten percent and is removed', () => {
  const state=baseState();
  state.charactersById.ceres.hp=0; state.charactersById.linnet.hp=0;
  addCharacterStatus(state,'aria','burn',{directHitsRemaining:1},{});
  const result=calculator.calculateBattle(state,input(),definitions(),'burn-hit');
  assert.equal(result.finalSnapshot.charactersById.aria.hp,490);
  assert.equal(result.finalSnapshot.charactersById.aria.statusIds.includes('existing-burn'),false);
});

test('freeze consumes one of two A-attempt checks whether success or disable', () => {
  const state=baseState();
  state.charactersById.linnet.sp=1;
  state.charactersById.linnet.resources.tameRoster=[{id:'t1'}];
  addCharacterStatus(state,'linnet','freeze',{attemptsRemaining:2},{});
  const result=calculator.calculateBattle(state,input({dailyResult:1,attackerSkillId:'linnet_a_tame_attack'}),definitions(),'freeze-check');
  assert.equal(result.finalSnapshot.statusInstances['existing-freeze'].counters.attemptsRemaining,1);
});

test('bind blocks incoming SP before actual SP gain', () => {
  const state=baseState();
  state.battleProgress.suPoints=4;
  addCharacterStatus(state,'aria','bind',{spBlockRemaining:2,spentSpToClearRemaining:2},{});
  const result=calculator.calculateBattle(state,input({dailyResult:1,leaderCharacterId:'linnet'}),definitions(),'bind-sp');
  assert.equal(result.finalSnapshot.charactersById.aria.sp,0);
  assert.equal(result.finalSnapshot.charactersById.ceres.sp,1);
  assert.equal(result.finalSnapshot.statusInstances['existing-bind'].counters.spBlockRemaining,1);
});

test('gravity halves the next successful numeric A action once', () => {
  const state=baseState();
  state.charactersById.linnet.sp=1;
  state.charactersById.linnet.resources.tameRoster=[{id:'t1'},{id:'t2'},{id:'t3'},{id:'t4'},{id:'t5'}];
  addCharacterStatus(state,'linnet','gravity',{numericActionsRemaining:2},{});
  const result=calculator.calculateBattle(state,input({dailyResult:3,attackerSkillId:'linnet_a_tame_attack'}),definitions(),'gravity-a');
  const aDamage=result.events.find(event=>event.type==='ALLY_A_SKILL').payload.damage;
  assert.equal(aDamage,125);
  assert.equal(result.finalSnapshot.statusInstances['existing-gravity'].counters.numericActionsRemaining,1);
});

test('final hour resolves after the eighth complete main action mark', () => {
  const state=baseState();
  addCharacterStatus(state,'aria','finalHour',{mainActionMarks:7,triggerAt:8},{damageToSource:0});
  const result=calculator.calculateBattle(state,input(),definitions(),'final-hour');
  assert.equal(result.finalSnapshot.charactersById.aria.hp,0);
  assert.equal(result.finalSnapshot.charactersById.aria.statusIds.includes('existing-finalHour'),false);
  assert.ok(result.events.some(event=>event.type==='FINAL_HOUR_TRIGGERED'));
});

test('malformed, non-finite, unknown and excessive snapshot data is rejected', () => {
  const defs = definitions();
  const nanState = baseState(); nanState.charactersById.aria.hp = NaN;
  expectCode(() => calculator.calculateBattle(nanState,input(),defs,'x'),'INVALID_SNAPSHOT');
  const infState = baseState(); infState.charactersById.aria.hp = Infinity;
  expectCode(() => calculator.calculateBattle(infState,input(),defs,'x'),'INVALID_SNAPSHOT');
  const unknownCharacter = baseState(); unknownCharacter.charactersById.unknown = clone(unknownCharacter.charactersById.aria); unknownCharacter.charactersById.unknown.characterId='unknown';
  expectCode(() => calculator.calculateBattle(unknownCharacter,input(),defs,'x'),'UNKNOWN_CHARACTER_ID');
  const unknownEnemy = baseState(); unknownEnemy.enemiesById.legacy_daily_1.definitionId='unknown';
  expectCode(() => calculator.calculateBattle(unknownEnemy,input(),defs,'x'),'UNKNOWN_ENEMY_ID');
  const tooLong = baseState(); tooLong.enemyOrder = Array(257).fill('legacy_daily_1');
  expectCode(() => calculator.calculateBattle(tooLong,input(),defs,'x'),'INVALID_SNAPSHOT');
});

test('unknown status and prototype-pollution keys are rejected', () => {
  const defs = definitions();
  const unknown = baseState();
  unknown.statusInstances.s1={instanceId:'s1',statusId:'notFormal',ownerType:'character',ownerId:'aria',sourceType:'enemy',sourceId:'legacy_daily_1',severity:'light',appliedBattleId:'old',counters:{},payload:{},persistsAcrossBattle:true,clearsAtWeekStart:false};
  unknown.charactersById.aria.statusIds=['s1'];
  expectCode(() => calculator.calculateBattle(unknown,input(),defs,'x'),'INVALID_SNAPSHOT');
  const polluted = baseState();
  polluted.charactersById.aria.resources = JSON.parse('{"constructor":{"prototype":{"polluted":true}}}');
  expectCode(() => calculator.calculateBattle(polluted,input(),defs,'x'),'INVALID_SNAPSHOT');
  assert.equal({}.polluted, undefined);
  const unexpected = baseState(); unexpected.surprise = true;
  expectCode(() => calculator.calculateBattle(unexpected,input(),defs,'x'),'INVALID_SNAPSHOT');
});

test('event reducer rejects unsafe paths, unexpected keys and oversized event lists', () => {
  const state=baseState();
  const unsafe={eventId:'event-0',slot:1,type:'DAMAGE',actor:'x',target:'aria',payload:{},mutations:[{op:'set',path:['charactersById','aria','__proto__'],before:null,after:{polluted:true}}]};
  assert.throws(()=>events.applyBattleEvent(state,unsafe,0));
  const extra={eventId:'event-0',slot:1,type:'DAMAGE',actor:'x',target:'aria',payload:{},mutations:[],extra:true};
  assert.throws(()=>events.applyBattleEvent(state,extra,0));
  assert.throws(()=>events.replayBattleEvents(state,Array(events.LIMITS.maxEvents+1).fill(null)));
});

test('unconfigured individual enemy skill fails explicitly', () => {
  const state = baseState({weekly:true});
  expectCode(() => calculator.calculateBattle(state,input(),definitions(),'x'),'UNCONFIGURED_ENEMY_ACTION');
});

test('calculator source has no network, browser runtime, timer or dynamic-code dependency', () => {
  const files = ['battle-calculator.js','battle-events.js','seeded-rng.js'];
  const source = files.map(file => fs.readFileSync(path.join(__dirname,'../../js/v2',file),'utf8')).join('\n');
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /\bdocument\b/, /\bwindow\b/,
    /localStorage/, /sessionStorage/, /\bAudio\b/, /setTimeout/, /setInterval/, /Date\.now/, /Math\.random/,
    /\beval\s*\(/, /new\s+Function\b/
  ];
  forbidden.forEach(pattern => assert.equal(pattern.test(source), false, `forbidden dependency matched ${pattern}`));
});

test('Phase B event and action limits are finite', () => {
  assert.equal(calculator.LIMITS.maxActions, 64);
  assert.equal(calculator.LIMITS.maxHits, 100);
  assert.equal(calculator.LIMITS.maxEvents, 2048);
});

process.on('exit', () => {
  if (!process.exitCode) process.stdout.write(`# ${passed} Phase B tests passed\n`);
});
