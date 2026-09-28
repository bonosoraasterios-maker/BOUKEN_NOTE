(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.formalBattleAssets = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Asset metadata is implementation-only. It does not grant old repository
  // art formal approval and it never participates in battle rules.
  const APPROVAL = Object.freeze({ formal:'formal', candidate:'candidate', legacyPlaceholder:'legacyPlaceholder', missing:'missing' });
  const ASSETS = Object.freeze({
    'background.legacyBattlefield': Object.freeze({ path:'images/backgrounds/battlefield_clean.webp', usage:'battlefieldPreview', approval:APPROVAL.legacyPlaceholder, sourcePath:'images/backgrounds/battlefield_clean.webp' }),
    'portrait.sora': Object.freeze({ path:'images/characters/protagonist.webp', usage:'hudPortrait', approval:APPROVAL.candidate, sourcePath:'images/characters/protagonist.webp' }),
    'portrait.aria': Object.freeze({ path:'images/characters/aria.webp', usage:'hudPortrait', approval:APPROVAL.candidate, sourcePath:'images/characters/aria.webp' }),
    'portrait.ceres': Object.freeze({ path:'images/characters/ceres.webp', usage:'hudPortrait', approval:APPROVAL.candidate, sourcePath:'images/characters/ceres.webp' }),
    'portrait.linnet': Object.freeze({ path:'images/characters/linnet.webp', usage:'hudPortrait', approval:APPROVAL.candidate, sourcePath:'images/characters/linnet.webp' }),
    'enemy.legacyDailyCore': Object.freeze({ path:'images/enemies/daily_enemy.webp', usage:'enemyPreview', approval:APPROVAL.legacyPlaceholder, sourcePath:'images/enemies/daily_enemy.webp' }),
    'enemy.legacyWeeklyCelestia': Object.freeze({ path:'images/enemies/weekly_enemy.webp', usage:'enemyPreview', approval:APPROVAL.legacyPlaceholder, sourcePath:'images/enemies/weekly_enemy.webp' }),
    'fx.starlightUnionCandidate': Object.freeze({ path:'images/effects/starlight_union.webp', usage:'unionFxPreview', approval:APPROVAL.candidate, sourcePath:'images/effects/starlight_union.webp' })
  });

  function validKey(value) { return typeof value === 'string' && Object.hasOwn(ASSETS, value) ? value : null; }
  function resolve(key, fallbackKey) {
    const resolved = validKey(key) || validKey(fallbackKey);
    return resolved ? Object.freeze({ key:resolved, path:ASSETS[resolved].path, usage:ASSETS[resolved].usage, approval:ASSETS[resolved].approval, sourcePath:ASSETS[resolved].sourcePath }) : null;
  }
  function fallbackEnemyKey(kind) {
    if (kind === 'daily') return 'enemy.legacyDailyCore';
    if (kind === 'weekly') return 'enemy.legacyWeeklyCelestia';
    // No Area Boss material is approved in the repository at this point.
    return null;
  }
  return Object.freeze({ APPROVAL, ASSETS, resolve, fallbackEnemyKey });
});
