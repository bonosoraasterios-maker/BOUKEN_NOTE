(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.statusEffects = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const effects = {
    poison: { id: 'poison', name: '毒症', severity: 'light', initialHitMultiplier: 0.75, counters: { ticksRemaining: 2 }, effect: { trigger: 'afterSkillAttemptConsumingAction', dotMultiplier: 0.20 }, duplicatePolicy: 'ignore', persistsAcrossBattle: true, clearsAtWeekStart: false, assetKey: null },
    burn: { id: 'burn', name: '火傷', severity: 'light', initialHitMultiplier: 0.85, counters: { directHitsRemaining: 1 }, effect: { trigger: 'nextDirectAttackReceived', finalDamageMultiplier: 1.10, ignoresDot: true }, duplicatePolicy: 'ignore', persistsAcrossBattle: true, clearsAtWeekStart: false, assetKey: null },
    freeze: { id: 'freeze', name: '凍結', severity: 'medium', initialHitMultiplier: 0.60, counters: { attemptsRemaining: 2 }, effect: { disableChance: { S: 0.30, D: 0.30, A: 0.20 }, consumeCounterOnSuccessOrFailure: true }, duplicatePolicy: 'ignore', persistsAcrossBattle: true, clearsAtWeekStart: false, assetKey: null },
    bind: { id: 'bind', name: '呪縛', severity: 'medium', initialHitMultiplier: 0.70, counters: { spBlockRemaining: 2, spentSpToClearRemaining: 2 }, effect: { blocksNewSpOnly: true, elliottRetainsStatus: false }, duplicatePolicy: 'ignore', persistsAcrossBattle: true, clearsAtWeekStart: false, assetKey: null },
    gravity: { id: 'gravity', name: '重力', severity: 'advanced', initialHitMultiplier: 0.50, counters: { numericActionsRemaining: 2 }, effect: { successfulNumericOutputMultiplier: 0.50, failedAttemptConsumesCounter: false }, duplicatePolicy: 'ignore', persistsAcrossBattle: true, clearsAtWeekStart: false, assetKey: null },
    finalHour: { id: 'finalHour', name: '終刻', severity: 'advanced', initialHitMultiplier: 0.40, counters: { mainActionMarks: 0, triggerAt: 8 }, effect: { resultAtTrigger: 'knockout', sourceDamageToClearMaxHpRatio: 0.20, clearOnSourceDefeat: true }, duplicatePolicy: 'ignore', persistsAcrossBattle: true, clearsAtWeekStart: true, assetKey: null }
  };
  Object.values(effects).forEach(Object.freeze);
  return Object.freeze({
    definitionsVersion: '2026-09-26-1117',
    severityOrder: Object.freeze(['light', 'medium', 'advanced']),
    statusIds: Object.freeze(['poison', 'burn', 'freeze', 'bind', 'gravity', 'finalHour']),
    mainActionMarks: Object.freeze(['protagonistNormal', 'enemyNormal', 'allyA', 'enemySkill', 'suOrOb']),
    effects: Object.freeze(effects)
  });
});
