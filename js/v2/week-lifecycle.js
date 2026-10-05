(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./schema.js'):root.BOUKEN_NOTE_V2.schema,typeof module==='object'&&module.exports?require('./battle-events.js'):root.BOUKEN_NOTE_V2.battleEvents,typeof module==='object'&&module.exports?require('./mission-lifecycle.js'):root.BOUKEN_NOTE_V2.missionLifecycle);if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.weekLifecycle=api;})(typeof globalThis!=='undefined'?globalThis:this,function(schema,events,missionApi){
  'use strict';
  const fail=code=>{const error=new Error(code);error.code=code;throw error;};
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
  const id=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!['__proto__','prototype','constructor'].includes(v);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const empty=v=>plain(v)&&Object.keys(v).length===0;
  const safeInt=v=>Number.isSafeInteger(v)&&v>=0;
  const FORMAL=['poison','burn','freeze','bind','gravity','finalHour'];
  const knownResources={sora:[],aria:['debtBySourceId'],elliott:['pendingAttackerHits'],irina:['reinforcementUsageByCharacterId'],ceres:['reserveHp','weeklyBarrierLoss'],noel:['mealTicks'],rg:['runesByStatusId','reversalRune'],linnet:['tameRoster'],sierra:['faceCoins','coinTossAudit','jackpot'],myart:['researchKits','weaknessMaterials','otherMaterials','reserveSp']};
  function validateContext(context,state,date){
    if(!plain(context)||context.date!==date||!id(context.weekKey)||!id(context.areaId)||![1,2,3,4].includes(context.areaWeekIndex)||context.weekRole!==(context.areaWeekIndex===4?'areaBoss':'weekly'))fail('WEEK_CONTEXT_UNCONFIGURED');
    if(context.areaId!==state.profile.currentAreaId)fail(state.calendar.weekContext&&context.weekKey===state.calendar.weekKey?'WEEK_CONTEXT_CONFLICT':'AREA_TRANSITION_STAGE3B_HOLD');
    return context;
  }
  function currentWeekly(state,errorCode){
    if(!Array.isArray(state.enemyOrder)||!plain(state.enemiesById))fail(errorCode);
    const records=[];
    for(const enemyId of state.enemyOrder){
      if(!id(enemyId)||!own(state.enemiesById,enemyId))fail(errorCode);
      const record=state.enemiesById[enemyId];
      if(!plain(record)||record.instanceId!==enemyId)fail(errorCode);
      if(record.kind==='weekly')records.push(record);
    }
    if(records.length!==1||!plain(records[0].flags)||!id(records[0].flags.encounterDescriptorId))fail(errorCode);
    return records[0];
  }
  function sourceIdentity(state){
    // Hidden map records are not current battlefield authority.
    return currentWeekly(state,'DEGRADED_WEEKLY_SOURCE_UNRESOLVED').flags.encounterDescriptorId;
  }
  function persistent(context,source){return {weekKey:context.weekKey,areaId:context.areaId,areaWeekIndex:context.areaWeekIndex,weekRole:context.weekRole,degradedWeeklySourceEncounterDescriptorId:source};}
  function bind(state,context,definitions){
    validateContext(context,state,state.calendar.localDate);
    const old=state.calendar.weekContext;
    if(old!==undefined&&old!==null){
      if(!schema.validateWeekContext(state).ok||!['weekKey','areaId','areaWeekIndex','weekRole'].every(k=>old[k]===context[k]))fail('WEEK_CONTEXT_CONFLICT');
      return events.safeClone(state);
    }
    if(context.weekKey!==state.calendar.weekKey)fail('WEEK_CONTEXT_CONFLICT');
    // An old week-four State cannot establish its week-three provenance.
    if(context.areaWeekIndex===4)fail('DEGRADED_WEEKLY_SOURCE_UNRESOLVED');
    const record=currentWeekly(state,'CURRENT_WEEK_BOSS_UNRESOLVED');
    const definition=definitions&&definitions.enemies&&definitions.enemies.enemies&&own(definitions.enemies.enemies,record.definitionId)&&definitions.enemies.enemies[record.definitionId];
    if(!definition||definition.kind!=='weekly')fail('CURRENT_WEEK_BOSS_UNRESOLVED');
    const next=events.safeClone(state);next.calendar.weekContext=persistent(context,null);return next;
  }
  function resetCharacters(state,definitions){
    if(!schema.validateDefinitions(definitions).ok)fail('WEEK_CHARACTER_DEFINITION_UNRESOLVED');
    const next=events.safeClone(state);
    for(const [characterId,character] of Object.entries(next.charactersById)){
      const def=definitions.characters.characters[characterId];
      if(!def||(characterId==='sora'?(def.maxHp!==null||character.hp!==null):(!Number.isSafeInteger(def.maxHp)||def.maxHp<=0)))fail('WEEK_CHARACTER_DEFINITION_UNRESOLVED');
      if(!plain(character.resources)||!plain(character.flags)||!empty(character.weekly))fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');
      const r=character.resources,f=character.flags;
      for(const [key,value] of Object.entries(r))if(!(knownResources[characterId]||[]).includes(key)&&value!==null&&value!==false&&value!==0)fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');
      for(const [key,value] of Object.entries(f))if(!((characterId==='ceres'&&key==='recoveryLocked')||(characterId==='myart'&&key==='weaknessProtocolDeveloped'))&&value!==null&&value!==false)fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');
      const check=(key,predicate)=>{if(own(r,key)&&!predicate(r[key]))fail('WEEK_BOUNDARY_RESOURCE_INVALID');};
      if(characterId==='aria'){check('debtBySourceId',v=>plain(v)&&Object.values(v).every(plain));if(own(r,'debtBySourceId'))r.debtBySourceId={};}
      if(characterId==='irina'){check('reinforcementUsageByCharacterId',v=>plain(v)&&Object.entries(v).every(([k,val])=>id(k)&&definitions.characters.characters[k]&&val===true));if(own(r,'reinforcementUsageByCharacterId'))r.reinforcementUsageByCharacterId={};}
      if(characterId==='ceres'){for(const key of ['reserveHp','weeklyBarrierLoss']){check(key,safeInt);if(own(r,key))r[key]=0;}if(own(f,'recoveryLocked')){if(typeof f.recoveryLocked!=='boolean')fail('WEEK_BOUNDARY_RESOURCE_INVALID');f.recoveryLocked=false;}}
      if(characterId==='myart'){if(own(r,'reserveSp')&&r.reserveSp!==0&&r.reserveSp!==null)fail('DAY_BOUNDARY_EFFECT_UNRESOLVED');if(own(f,'weaknessProtocolDeveloped')){if(typeof f.weaknessProtocolDeveloped!=='boolean')fail('WEEK_BOUNDARY_RESOURCE_INVALID');f.weaknessProtocolDeveloped=false;}}
      if(characterId==='sierra'){
        check('faceCoins',safeInt);check('jackpot',v=>typeof v==='boolean');
        if(own(r,'coinTossAudit')&&r.coinTossAudit!==null&&!empty(r.coinTossAudit))fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');
        if(r.jackpot===true){if(!own(r,'faceCoins')||!safeInt(r.faceCoins)||!Number.isInteger(character.sp)||character.sp<0||character.sp>5)fail('WEEK_BOUNDARY_RESOURCE_INVALID');r.faceCoins=10;character.sp=5;}
        if(own(r,'jackpot'))r.jackpot=false;
      }
      if(characterId==='rg'){if(own(r,'reversalRune')&&r.reversalRune!==null)fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');if(own(r,'runesByStatusId')&&r.runesByStatusId!==null&&!empty(r.runesByStatusId))fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');}
      if(characterId==='elliott'&&own(r,'pendingAttackerHits'))fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');
      if(characterId==='noel'&&own(r,'mealTicks')&&r.mealTicks!==null&&r.mealTicks!==0)fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');
      character.hp=def.maxHp;character.barrier=null;character.statusIds=[];
    }
    if(Object.values(next.statusInstances).some(s=>!FORMAL.includes(s.statusId)))fail('WEEK_BOUNDARY_EFFECT_UNRESOLVED');
    next.statusInstances={};next.enemiesById={};next.enemyOrder=[];
    return next;
  }
  function validateTransition(before,after,definitions){
    const reset=before.calendar.weekKey!==after.calendar.weekKey;
    const expected=reset?resetCharacters(before,definitions):events.safeClone(before);
    if(!events.deepEqual(expected.charactersById,after.charactersById)||(!reset&&!events.deepEqual(before.statusInstances,after.statusInstances))||(reset&&Object.keys(after.statusInstances).length))fail('INVALID_STATE_TRANSITION');
    for(const key of ['profile','partySlots','leaderCarry'])if(!events.deepEqual(before[key],after[key]))fail('INVALID_STATE_TRANSITION');
    const a=events.safeClone(before.battleProgress),b=events.safeClone(after.battleProgress);delete a.pendingElliottHits;delete b.pendingElliottHits;
    if(!events.deepEqual(a,b)||!events.deepEqual(before.missions.special,after.missions.special))fail('INVALID_STATE_TRANSITION');
    return true;
  }
  function create(options){
    const mission=missionApi.create(options),definitions=options.definitions,provider=options.weeklyEncounterProvider;
    function spawnBoss(state,context,previousWeekKey){
      if(!provider||typeof provider.forWeek!=='function')fail('WEEKLY_ENCOUNTER_UNCONFIGURED');
      const d=provider.forWeek({weekKey:context.weekKey,startDate:context.date,areaId:context.areaId,previousWeekKey,state:events.safeClone(state)});
      if(!plain(d)||!id(d.instanceId)||!id(d.encounterDescriptorId)||!id(d.definitionId)||d.kind!==context.weekRole||d.spawnedOn!==context.date||!plain(d.enemy))fail('WEEKLY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const def=definitions.enemies.enemies[d.definitionId];if(!def||def.kind!==d.kind)fail('WEEKLY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      if(d.enemy.defeated!==false||!Number.isFinite(d.enemy.hp)||!Number.isFinite(d.enemy.maxHp)||d.enemy.hp<=0||d.enemy.maxHp<=0||d.enemy.hp>d.enemy.maxHp)fail('WEEKLY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const e=events.safeClone(d.enemy),keys=['instanceId','definitionId','kind','hp','maxHp','barrier','phase','statusIds','spawnedOn','defeated','flags'];
      if(!keys.every(k=>own(e,k))||!plain(e.flags)||!plain(e.phase)||typeof e.defeated!=='boolean'||!Array.isArray(e.statusIds)||e.statusIds.length||!['instanceId','definitionId','kind','spawnedOn'].every(k=>e[k]===d[k]))fail('WEEKLY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      if(e.flags.encounterDescriptorId!==undefined&&e.flags.encounterDescriptorId!==d.encounterDescriptorId)fail('WEEKLY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      e.flags.encounterDescriptorId=d.encounterDescriptorId;
      const next=events.safeClone(state);next.enemiesById={[e.instanceId]:e};next.enemyOrder=[e.instanceId];
      if(!schema.validateState(next).ok)fail('WEEKLY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');return next;
    }
    function transition(state,context){
      validateContext(context,state,context.date);
      const old=state.calendar.weekContext;
      if(!old||!schema.validateWeekContext(state).ok)fail('WEEK_CONTEXT_UNCONFIGURED');
      if(context.weekKey===old.weekKey){if(!['areaId','areaWeekIndex','weekRole'].every(k=>old[k]===context[k]))fail('WEEK_CONTEXT_CONFLICT');return events.safeClone(state);}
      if(context.areaWeekIndex!==old.areaWeekIndex+1||old.areaWeekIndex===4)fail('WEEK_CONTEXT_CONFLICT');
      mission.assertInitialized(state);
      const source=context.areaWeekIndex===4?sourceIdentity(state):null;
      let next=resetCharacters(state,definitions);
      const config=options.missionConfigurationProvider&&options.missionConfigurationProvider.forPeriod({kind:'weekly',weekKey:context.weekKey,date:context.date,areaId:context.areaId});
      next=mission.rolloverWeekly(next,context.weekKey,config);
      next.calendar.weekContext=persistent(context,source);
      return spawnBoss(next,context,old.weekKey);
    }
    return Object.freeze({bind:(state,context)=>bind(state,context,definitions),transition});
  }
  return Object.freeze({create,bind,validateContext,resetCharacters,validateTransition});
});
