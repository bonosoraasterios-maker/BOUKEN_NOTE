'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const load = relative => vm.runInThisContext(fs.readFileSync(path.join(__dirname, relative), 'utf8'), { filename: relative });
[
  '../../data/v2/characters.js','../../data/v2/enemies.js','../../data/v2/skills.js',
  '../../data/v2/status-effects.js','../../data/v2/battle-rules.js','../../data/v2/missions.js',
  '../../js/v2/schema.js','../../js/v2/save-migration.js'
].forEach(load);
const schema = globalThis.BOUKEN_NOTE_V2.schema;
const migration = globalThis.BOUKEN_NOTE_V2.saveMigration;
const definitions = {
  characters: globalThis.BOUKEN_NOTE_V2.characters,
  enemies: globalThis.BOUKEN_NOTE_V2.enemies,
  skills: globalThis.BOUKEN_NOTE_V2.skills,
  statusEffects: globalThis.BOUKEN_NOTE_V2.statusEffects,
  battleRules: globalThis.BOUKEN_NOTE_V2.battleRules,
  missions: globalThis.BOUKEN_NOTE_V2.missions
};

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}\n${error.stack}\n`); process.exitCode = 1; }
}

const legacy = {
  coin: 27,
  dailyEnemies: [{ id: 4, hp: 321, day: '2026-09-26' }],
  weeklyHP: 2000,
  party: [550, 1000, 350],
  daily: [1, 0, 1], weekly: [1, 1, 0], special: [0, 0, 1],
  battlePts: 3, skillSP: 4,
  beast: { name: '旧個体', hp: 123 }, beastQueue: [{ name: '旧待機', hp: 200 }],
  bleed: [2, 0, 1], weeklyPhaseSkillUsed: true,
  loginDay: '2026-09-26', enemyDay: '2026-09-26', weekKey: '2026-09-21'
};
const bytes = JSON.stringify(legacy);
const options = { migratedAt: '2026-09-27T05:00:00+09:00' };

test('definition bundle matches the 1117 version and formal six statuses', () => {
  assert.deepEqual(schema.validateDefinitions(definitions), { ok: true, errors: [] });
});

test('weekly HP preserves progress ratio with ceil and clamp', () => {
  assert.equal(migration.weeklyHp(0), 0);
  assert.equal(migration.weeklyHp(-1), 0);
  assert.equal(migration.weeklyHp(1), 1);
  assert.equal(migration.weeklyHp(2000), 1500);
  assert.equal(migration.weeklyHp(3999), 3000);
  assert.equal(migration.weeklyHp(4000), 3000);
  assert.equal(migration.weeklyHp(5000), 3000);
});

test('migration is deterministic for identical bytes and explicit metadata', () => {
  const a = migration.migrateLegacyToV2(bytes, options);
  const b = migration.migrateLegacyToV2(bytes, options);
  assert.equal(a.ok, true);
  assert.deepEqual(a.candidate, b.candidate);
  assert.equal(JSON.stringify(a.candidate), JSON.stringify(b.candidate));
});

test('approved non-conversions remain audit-only', () => {
  const state = migration.migrateLegacyToV2(bytes, options).candidate;
  assert.equal(state.charactersById.aria.sp, 0);
  assert.equal(state.charactersById.ceres.sp, 0);
  assert.equal(state.charactersById.linnet.sp, 0);
  assert.equal(state.charactersById.sora.sp, null);
  assert.equal(state.battleProgress.suPoints, 0);
  assert.equal(state.battleProgress.dailySuUsedOn, null);
  assert.deepEqual(state.statusInstances, {});
  assert.deepEqual(state.charactersById.linnet.resources.tameRoster, []);
  assert.equal(state.migration.audit.sharedSkillSp.oldValue, 4);
  assert.equal(state.migration.audit.sharedSkillSp.converted, false);
  assert.equal(state.migration.audit.battlePts.oldValue, 3);
  assert.deepEqual(state.migration.audit.legacyUnsupported.bleed, [2, 0, 1]);
  assert.deepEqual(state.migration.audit.legacyTame.beast, legacy.beast);
  assert.equal(state.migration.audit.legacyTame.converted, false);
});

test('weekly HP audit stores old and converted values', () => {
  const audit = migration.migrateLegacyToV2(bytes, options).candidate.migration.audit.weeklyHp;
  assert.deepEqual(audit, { oldHp: 2000, oldMaxHp: 4000, newHp: 1500, newMaxHp: 3000, method: 'ceil-progress-ratio' });
});

test('storage preparation neither rewrites legacy bytes nor creates v2 save', () => {
  const map = new Map([[migration.LEGACY_KEY, bytes]]);
  const storage = {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: () => { throw new Error('Phase A migration must not write storage'); }
  };
  const result = migration.prepareFromStorage(storage, options);
  assert.equal(result.ok, true);
  assert.equal(result.legacyBytesUnchanged, true);
  assert.equal(result.wroteV2, false);
  assert.equal(map.get(migration.LEGACY_KEY), bytes);
  assert.equal(map.has(migration.V2_KEY), false);
});

test('schema rejection does not expose a candidate as saveable', () => {
  const migrated = migration.migrateLegacyToV2(bytes, options);
  const invalid = JSON.parse(JSON.stringify(migrated.candidate));
  invalid.battleProgress.suPoints = 5;
  assert.equal(schema.validateState(invalid).ok, false);
  const broken = migration.migrateLegacyToV2('{broken', options);
  assert.equal(broken.ok, false);
  assert.equal(broken.candidate, null);
});

test('feature flag remains false and main runtime has no Phase A integration', () => {
  const state = migration.migrateLegacyToV2(bytes, options).candidate;
  assert.deepEqual(state.featureFlags, { formalBattleV2: false });
});

test('Event Player correction permits only pure presentation replay', () => {
  const policy = definitions.battleRules.eventReplayPolicy;
  assert.equal(policy.presentationUpdates, 'applyConfirmedEventsWithPureReducer');
  assert.equal(policy.finalInvariant, 'presentationSnapshotDeepEqualsFinalSnapshot');
  assert.ok(policy.forbiddenInPlayer.includes('authoritativeStateMutation'));
  assert.ok(policy.forbiddenInPlayer.includes('random'));
  assert.ok(policy.forbiddenInPlayer.includes('targetReselection'));
});

test('SHA-256 audit fingerprint is stable', () => {
  assert.equal(migration.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

process.on('exit', () => {
  if (!process.exitCode) process.stdout.write(`# ${passed} tests passed\n`);
});
