// Engine v1 migration target. v1.2 terminology: class / job / potentialAbility / skill.
window.BOUKEN_NOTE_DATA = window.BOUKEN_NOTE_DATA || {};
window.BOUKEN_NOTE_DATA.characters = [
  {
    characterId: 'aria', name: 'アリア', classId: 'support', classLabel: 'サポーター',
    jobId: 'cleric', jobLabel: 'クレリック', maxHp: 600,
    art: 'images/characters/aria.webp',
    potentialAbility: 'healing_light', skill: 'heal'
  },
  {
    characterId: 'ceres', name: 'セレス', classId: 'defender', classLabel: 'ディフェンダー',
    jobId: 'guardian', jobLabel: 'ガーディアン', maxHp: 1200,
    art: 'images/characters/ceres.webp',
    potentialAbility: 'holy_guard', skill: 'holy_field'
  },
  {
    characterId: 'linnet', name: 'リネット', classId: 'attacker', classLabel: 'アタッカー',
    jobId: 'tamer', jobLabel: 'テイマー', maxHp: 400,
    art: 'images/characters/linnet.webp',
    potentialAbility: 'tame', skill: 'tame_guard'
  }
];
