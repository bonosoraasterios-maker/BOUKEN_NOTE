(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.enemies = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const enemies = {
    dailyBase: { id: 'daily_base', kind: 'daily', name: null, baseMaxHp: 800, normalActions: 1, skillActions: 0, assetKey: null },
    weeklyBase: { id: 'weekly_base', kind: 'weekly', name: null, baseMaxHp: 3000, normalActions: 1, skillActions: 1, assetKey: null },
    areaBossBase: {
      id: 'area_boss_base', kind: 'areaBoss', name: null, baseMaxHp: 8000,
      normalActions: 1, skillActions: 1, assetKey: null,
      phaseRules: { initialSkill: 1, initialSkill2Threshold: 0.30, rgSkill2Threshold: 0.50, rgEnhancedThreshold: 0.30, appliesFrom: 'nextEnemySkillSlot' }
    }
  };
  Object.values(enemies).forEach(Object.freeze);
  return Object.freeze({ definitionsVersion: '2026-09-26-1117', enemies: Object.freeze(enemies) });
});
