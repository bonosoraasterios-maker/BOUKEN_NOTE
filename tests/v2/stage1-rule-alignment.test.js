'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
[
  'data/v2/characters.js', 'data/v2/enemies.js', 'data/v2/skills.js',
  'data/v2/status-effects.js', 'data/v2/battle-rules.js', 'data/v2/missions.js',
  'js/v2/schema.js', 'js/v2/save-migration.js', 'js/v2/seeded-rng.js',
  'js/v2/battle-events.js', 'js/v2/battle-calculator.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), { filename: file }));
const v2 = globalThis.BOUKEN_NOTE_V2;
const definitions = { characters:v2.characters, enemies:v2.enemies, skills:v2.skills,
  statusEffects:v2.statusEffects, battleRules:v2.battleRules, missions:v2.missions };
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; process.stdout.write(`ok - ${name}\n`); }
  catch (error) { process.exitCode = 1; process.stderr.write(`not ok - ${name}\n${error.stack}\n`); }
}
test('Stage 1 definition changes are exactly the approved mapping and unresolved removal', () => {
  assert.deepEqual(plain(v2.battleRules.unionHitsByWeeklyClearCount), [4,6,8,10]);
  assert.deepEqual(plain(v2.battleRules.unresolved), [
    'burnMultiHitRoundingWording', 'gravityNonNumericSuccessfulActionConsumption', 'individualEnemyFinalStatsAndSkills'
  ]);
});
// Reuse the Phase B Daily-only migration fixture; do not supply new combat definitions.
for (const [clearCount, hits] of [[0,4],[1,6],[2,8],[3,10],[4,10]]) {
  test(`Stage 1 Calculator Weekly clearCount ${clearCount} produces ${hits} HIT`, () => {
    const legacy = { coin:20, dailyEnemies:[{id:1,hp:800,day:'2026-09-27'}], weeklyHP:0,
      party:[600,1200,400], daily:[0,0,0], weekly:[0,0,0], special:[0,0,0],
      battlePts:0, skillSP:0, beast:null, beastQueue:[], bleed:[0,0,0], weeklyPhaseSkillUsed:false,
      loginDay:'2026-09-27', enemyDay:'2026-09-27', weekKey:'2026-09-21' };
    const migrated = v2.saveMigration.migrateLegacyToV2(JSON.stringify(legacy), {migratedAt:'2026-09-27T05:00:00+09:00'});
    assert.equal(migrated.ok, true);
    const state = migrated.candidate;
    state.battleProgress.suPoints = 4;
    state.missions.weekly.clearCount = clearCount;
    const result = v2.battleCalculator.calculateBattle(state, {
      battleId:'stage1-mapping', battleDate:'2026-09-27', dailyResult:1,
      attackerSkillId:null, leaderCharacterId:'aria'
    }, definitions, 'slot-four');
    const union = result.events.find(event => event.type === 'STARLIGHT_UNION' || event.type === 'OVERBREAK');
    assert.ok(union);
    assert.equal(union.payload.hits, hits);
  });
}
process.stdout.write(`Stage 1: ${passed}/6 passed\n`);
