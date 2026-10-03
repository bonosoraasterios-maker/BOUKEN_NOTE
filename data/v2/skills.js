(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.skills = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const skill = (id, ownerId, kind, name, spCost, extra) => Object.freeze(Object.assign({ id, ownerId, kind, name, spCost, source: 'BOUKEN_NOTE_SPEC_2026-09-26_1117' }, extra || {}));
  const skills = [
    skill('sora_normal_attack','sora','normal','通常攻撃',0,{hudSlot:'通常攻撃',hudLabel:'通常攻撃',hudOrder:1}),
    skill('sora_starlight_union','sora','union','スターライトユニオン',0,{hudSlot:'スターライトユニオン',hudLabel:'スターライトユニオン',hudOrder:2}),
    skill('aria_passive_healing_light','aria','passive','癒しの光',0,{trigger:'battleEnd',healPerLivingAlly:20,hudSlot:'Passive',hudOrder:1}),
    skill('aria_s_heal','aria','S','ヒール',1,{repeatable:true,target:'lowestHpRatioAtOrBelow50',healMaxHpRatio:0.30,hudSlot:'S',hudOrder:2}),
    skill('aria_d_margin','aria','D','聖典の余白',1,{createsDebt:true}),
    skill('aria_a_sanctuary','aria','A','サンクチュアリ',null,{activationSpCost:5,ongoingSpCost:0,activationFrequency:'firstEffectiveUseOfWeek',validEnemyFamily:'spirit'}),
    skill('elliott_passive_stance','elliott','passive','奏楽の構え',null,{spIndependent:true}),
    skill('elliott_s_resonance','elliott','S','レゾナンス・アンセム',null,{spIndependent:true}),
    skill('elliott_d_diminuendo','elliott','D','ディミヌエンド・アンセム',null,{spIndependent:true}),
    skill('elliott_a_brave','elliott','A','ブレイブ・アンセム',null,{spIndependent:true}),
    skill('ceres_passive_majesty','ceres','passive','守護者の威光',0,{hudSlot:'Passive',hudOrder:1}),
    skill('ceres_s_life_reserve','ceres','S','ライフ・リザーブ',0,{reserveMaxHpRatioByDailyResult:[0,0.01,0.03,0.05]}),
    skill('ceres_d_holy_field','ceres','D','ホーリーフィールド',1,{defense:'completeGuard',hudSlot:'D',hudOrder:2}),
    skill('ceres_a_sacred_stigma','ceres','A','セイクリッド・スティグマ',1),
    skill('linnet_passive_tame','linnet','passive','テイム',0,{creates:'tameRosterEntry',hudSlot:'Passive',hudOrder:1}),
    skill('linnet_passive_tame_guard','linnet','passive','潜在テイムガード',0,{cost:{tame:1},defense:'completeGuardSelf'}),
    skill('linnet_s_tame_support','linnet','S','テイムサポート',1,{oncePerDay:true,temporarySp:1}),
    skill('linnet_d_tame_guard','linnet','D','テイムガード',0,{cost:{tamePerProtectedAlly:1},defense:'completeGuard'}),
    skill('linnet_a_tame_attack','linnet','A','テイムアタック',1,{damageByDailyResult:[0,50,150,250],hudSlot:'A',hudOrder:2}),
    skill('sierra_passive_coin_toss','sierra','passive','コイントス',0,{persistentResource:'faceCoins'}),
    skill('sierra_s_target_mark','sierra','S','ターゲットマーク',0,{nextAttackerFinalDamageMultiplier:1.5}),
    skill('sierra_d_intercept','sierra','D','迎撃',1,{firstDailyCoinCost:1,reductionByDailyResult:[0,0.10,0.20,0.30]}),
    skill('sierra_a_sniper_rifle','sierra','A','スナイパーライフル',5,{cost:{faceCoins:5},baseDamage:1200,oncePerBattle:true,directBossTarget:true,penetratesBarrier:true}),
    skill('irina_passive_analysis','irina','passive','戦況分析',0),
    skill('irina_s_command','irina','S','号令',0,{trigger:'battleStart',optimizesSlots:[1,2,3]}),
    skill('irina_d_retreat','irina','D','退避命令',1,{defense:'evadeWholeEnemyAction'}),
    skill('irina_a_reinforcement','irina','A','援軍要請',1,{sameCharacterLimitPerWeek:1}),
    skill('noel_passive_courage','noel','passive','……怖い。でも、逃げたくない！',0),
    skill('noel_s_meal','noel','S','ご飯できました',1,{healPerTick:20,ticksByDailyResult:[0,1,2,3]}),
    skill('noel_d_parry','noel','D','パリィ',1,{spCostUnit:'protectedLivingAllyPerEnemyAction',defense:'completeGuard'}),
    skill('noel_a_swing','noel','A','振り回す',1,{hits:5,normalDamage:100,criticalDamage:200,criticalChance:0.05}),
    skill('rg_passive_rune_armor','rg','passive','ルーンアーマー',0,{statusHarmImmune:true}),
    skill('rg_s_rune_reverse','rg','S','ルーンリバース',2,{maxActive:1,persistsAcrossWeekIfUnused:true}),
    skill('rg_d_rune_shift','rg','D','ルーンシフト',1,{spCostUnit:'protectedAllyPerEnemyAction'}),
    skill('rg_a_rune_fist','rg','A','ルーンフィスト',1,{damageByRuneCount:{1:200,2:300,3:400,4:750,5:1200,6:2100},copiesWeakenedStatuses:true}),
    skill('myart_passive_harvest','myart','passive','素材採取',0,{drawsByDailyResult:[0,1,2,3]}),
    skill('myart_s_resource_allocation','myart','S','リソース・アロケーション',0,{movesDailySpAndRemainingActions:true}),
    skill('myart_d_phase_barrier','myart','D','フェイズ・バリア',5,{oncePerWeek:true,cost:{weaknessMaterialSets:1},barrierMaxHpRatio:0.50}),
    skill('myart_a_weakness_protocol','myart','A','ウィークネス・プロトコル',null,{initialSpCost:5,ongoingSpCost:0,initialCost:{weaknessMaterials:2,researchKits:3},ongoingCost:{researchKits:1},damagePerEnemyFormula:'200*N'})
  ];
  const byId = Object.freeze(Object.fromEntries(skills.map(v => [v.id, v])));
  return Object.freeze({ definitionsVersion: '2026-09-26-1117', skills: Object.freeze(skills), byId });
});
