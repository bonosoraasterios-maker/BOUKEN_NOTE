(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.battleRules = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return Object.freeze({
    definitionsVersion: '2026-09-26-1117',
    partySlots: Object.freeze(['protagonist', 'supporter', 'defender', 'attacker']),
    hate: Object.freeze({ supporter: 20, defender: 45, attacker: 30, randomBonusMin: 0, randomBonusMax: 5 }),
    maxSp: 5,
    maxActionCount: 5,
    normalDamage: 100,
    enemyLimits: Object.freeze({ total: 5, dailyWithBoss: 4, dailyWithoutBoss: 5 }),
    baseEnemyHp: Object.freeze({ daily: 800, weekly: 3000, areaBoss: 8000 }),
    enemyActions: Object.freeze({ daily: Object.freeze({ normal: 1, skill: 0 }), weekly: Object.freeze({ normal: 1, skill: 1 }), areaBoss: Object.freeze({ normal: 1, skill: 1 }) }),
    enemySkillDamage: Object.freeze({ stage1: Object.freeze({ single: 200, multi3: 70, all: 70 }), stage2: Object.freeze({ single: 250, multi3: 85, all: 85 }), enhancedStage2: Object.freeze({ single: 300, multi3: 100, all: 100 }) }),
    slots: Object.freeze([
      Object.freeze({ order: 0, id: 'preemptiveException' }),
      Object.freeze({ order: 1, id: 'normal', contents: Object.freeze(['protagonistNormal', 'enemyNormal']), ordering: 'random' }),
      Object.freeze({ order: 2, id: 'allyA' }),
      Object.freeze({ order: 3, id: 'enemySkill' }),
      Object.freeze({ order: 4, id: 'suPackage', fixed: true, contents: Object.freeze(['starRoadReconnection', 'leaderSkill', 'suOrOb']) })
    ]),
    su: Object.freeze({ earnedByDailyResult: Object.freeze([0, 1, 3, 5]), activationCost: 5, maxActivationsPerDay: 1, carryRemainderMin: 0, carryRemainderMax: 4, resetAtWeekStart: false }),
    unionHitsByWeeklyClearCount: Object.freeze([4, 6, 8, 10]),
    targetWeightsWithBoss: Object.freeze({ 0: Object.freeze({ daily: 0, boss: 100 }), 1: Object.freeze({ daily: 70, boss: 30 }), 2: Object.freeze({ daily: 75, boss: 25 }), 3: Object.freeze({ daily: 80, boss: 20 }), 4: Object.freeze({ daily: 85, boss: 15 }) }),
    rounding: Object.freeze({ multiplierResult: 'floor', multiHit: 'floorEachHit', minimumNonNullifiedDamage: 1, nullifiedDamage: 0 }),
    eventReplayPolicy: Object.freeze({
      authoritativeState: 'calculateBattle.finalSnapshot',
      presentationSnapshotStart: 'cloneOfBattleStartSnapshot',
      presentationUpdates: 'applyConfirmedEventsWithPureReducer',
      forbiddenInPlayer: Object.freeze(['random', 'targetReselection', 'damageRecalculation', 'statusReroll', 'authoritativeStateMutation']),
      finalInvariant: 'presentationSnapshotDeepEqualsFinalSnapshot',
      skipBehavior: 'renderFinalSnapshot'
    }),
    unresolved: Object.freeze(['burnMultiHitRoundingWording', 'gravityNonNumericSuccessfulActionConsumption', 'individualEnemyFinalStatsAndSkills'])
  });
});
