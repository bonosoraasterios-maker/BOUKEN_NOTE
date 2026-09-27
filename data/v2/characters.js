(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.characters = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFINITIONS_VERSION = '2026-09-26-1117';
  const characters = {
    sora: { id: 'sora', name: 'ソラ・アステリオス', role: 'protagonist', classId: 'swordsman', maxHp: null, maxSp: null, resources: [] },
    aria: { id: 'aria', name: 'アリア・ノクターン', role: 'supporter', classId: 'cleric', maxHp: 600, maxSp: 5, resources: ['debtBySourceId'] },
    elliott: { id: 'elliott', name: 'エリオット・レゾナ', role: 'supporter', classId: 'musician', maxHp: 700, maxSp: null, resources: ['pendingAttackerHits'] },
    irina: { id: 'irina', name: 'イリーナ・ノクターン', role: 'supporter', classId: 'military_strategist', maxHp: 800, maxSp: 5, resources: ['reinforcementUsageByCharacterId'] },
    ceres: { id: 'ceres', name: 'セレス・ルミナ', role: 'defender', classId: 'guardian', maxHp: 1200, maxSp: 5, resources: ['reserveHp', 'weeklyBarrierLoss'] },
    noel: { id: 'noel', name: 'ノエル・アーデン', role: 'defender', classId: 'apprentice_swordsman', maxHp: 650, maxSp: 5, resources: ['mealTicks'] },
    rg: { id: 'rg', name: 'レグルス・グランツ', role: 'defender', classId: 'rune_guard', maxHp: 1000, maxSp: 5, resources: ['runesByStatusId', 'reversalRune'] },
    linnet: { id: 'linnet', name: 'リネット・エトワール', role: 'attacker', classId: 'tamer', maxHp: 400, maxSp: 5, resources: ['tameRoster'] },
    sierra: { id: 'sierra', name: 'シエラ・ヴェイル', role: 'attacker', classId: 'sniper', maxHp: 850, maxSp: 5, resources: ['faceCoins', 'coinTossAudit', 'jackpot'] },
    myart: { id: 'myart', name: 'ミャート・ロックウェル', role: 'attacker', classId: 'scientist', maxHp: 500, maxSp: 5, resources: ['researchKits', 'weaknessMaterials', 'otherMaterials', 'reserveSp'] }
  };

  Object.values(characters).forEach(Object.freeze);
  return Object.freeze({ definitionsVersion: DEFINITIONS_VERSION, characters: Object.freeze(characters) });
});
