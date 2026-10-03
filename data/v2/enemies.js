(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.enemies = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const enemies = {
    daily_base: { id: 'daily_base', kind: 'daily', name: null, baseMaxHp: 800, normalActions: 1, skillActions: 0, assetKey: 'enemy.legacyDailyCore' },
    weekly_base: { id: 'weekly_base', kind: 'weekly', name: null, baseMaxHp: 3000, normalActions: 1, skillActions: 1, skillProfileId: null, assetKey: 'enemy.legacyWeeklyCelestia' },
    area_boss_base: {
      id: 'area_boss_base', kind: 'areaBoss', name: null, baseMaxHp: 8000,
      normalActions: 1, skillActions: 1, skillProfileId: null, assetKey: null,
      phaseRules: { initialSkill: 1, initialSkill2Threshold: 0.30, rgSkill2Threshold: 0.50, rgEnhancedThreshold: 0.30, appliesFrom: 'nextEnemySkillSlot' }
    }
  };
  const skillProfiles = {
    stage1Single: { id:'stage1Single', stage:1, pattern:'single', damagePerHit:200, pureDamage:200, statusId:null },
    stage1Multi3: { id:'stage1Multi3', stage:1, pattern:'multi3', damagePerHit:70, pureDamage:210, statusId:null },
    stage1All: { id:'stage1All', stage:1, pattern:'all', damagePerHit:70, pureDamage:210, statusId:null },
    stage2Single: { id:'stage2Single', stage:2, pattern:'single', damagePerHit:250, pureDamage:250, statusId:null },
    stage2Multi3: { id:'stage2Multi3', stage:2, pattern:'multi3', damagePerHit:85, pureDamage:255, statusId:null },
    stage2All: { id:'stage2All', stage:2, pattern:'all', damagePerHit:85, pureDamage:255, statusId:null },
    enhancedStage2Single: { id:'enhancedStage2Single', stage:'enhanced2', pattern:'single', damagePerHit:300, pureDamage:300, statusId:null },
    enhancedStage2Multi3: { id:'enhancedStage2Multi3', stage:'enhanced2', pattern:'multi3', damagePerHit:100, pureDamage:300, statusId:null },
    enhancedStage2All: { id:'enhancedStage2All', stage:'enhanced2', pattern:'all', damagePerHit:100, pureDamage:300, statusId:null }
  };
  Object.values(enemies).forEach(Object.freeze);
  Object.values(skillProfiles).forEach(Object.freeze);
  return Object.freeze({ definitionsVersion: '2026-09-26-1117', enemies: Object.freeze(enemies), skillProfiles: Object.freeze(skillProfiles) });
});
