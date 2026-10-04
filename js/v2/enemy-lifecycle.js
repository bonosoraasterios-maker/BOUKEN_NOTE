(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./schema.js'):root.BOUKEN_NOTE_V2.schema,typeof module==='object'&&module.exports?require('./battle-events.js'):root.BOUKEN_NOTE_V2.battleEvents,typeof module==='object'&&module.exports?require('./calendar-lifecycle.js'):root.BOUKEN_NOTE_V2.calendarLifecycle);if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.enemyLifecycle=api;})(typeof globalThis!=='undefined'?globalThis:this,function(schema,events,calendar){
  'use strict';
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  const id=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!['__proto__','constructor','prototype'].includes(v);
  function create(options){
    const provider=options&&options.dailyEncounterProvider,definitions=options&&options.definitions;
    function spawn(state){
      if(!provider||typeof provider.forDate!=='function')fail('DAILY_ENCOUNTER_UNCONFIGURED');
      if(!schema.validateDefinitions(definitions).ok)fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const date=state.calendar.localDate;
      if(!calendar.validDate(date))fail('DAILY_SPAWN_LEDGER_CONFLICT');
      const descriptor=provider.forDate({date,areaId:state.profile.currentAreaId,state:events.safeClone(state)});
      if(!descriptor||!id(descriptor.instanceId)||!id(descriptor.encounterDescriptorId)||!id(descriptor.definitionId)||descriptor.kind!=='daily'||descriptor.spawnedOn!==date||!descriptor.enemy)fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const definition=definitions&&definitions.enemies&&definitions.enemies.enemies&&definitions.enemies.enemies[descriptor.definitionId];
      if(!definition||definition.kind!==descriptor.kind)fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const record=events.safeClone(descriptor.enemy);
      const fields=['instanceId','encounterDescriptorId','definitionId','kind','hp','maxHp','barrier','phase','statusIds','spawnedOn','defeated','flags'];
      if(!fields.every(key=>Object.prototype.hasOwnProperty.call(record,key))||typeof record.defeated!=='boolean'||!record.phase||typeof record.phase!=='object'||!record.flags||typeof record.flags!=='object')fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      for(const key of ['instanceId','encounterDescriptorId','definitionId','kind','spawnedOn'])if(record[key]!==descriptor[key])fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const isolated=events.safeClone(state);isolated.enemiesById={[record.instanceId]:record};isolated.enemyOrder=[record.instanceId];
      if(!schema.validateState(isolated).ok)fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const bound=Object.values(state.enemiesById).find(e=>e.spawnedOn===date&&e.encounterDescriptorId===descriptor.encounterDescriptorId&&e.instanceId!==descriptor.instanceId);
      if(bound)fail('ENCOUNTER_INSTANCE_CONFLICT');
      const existing=state.enemiesById[descriptor.instanceId];
      if(existing){
        if(!['instanceId','spawnedOn','kind','encounterDescriptorId','definitionId'].every(k=>existing[k]===descriptor[k]))fail('ENCOUNTER_INSTANCE_CONFLICT');
        if(state.calendar.enemySpawnDate!==date||!state.enemyOrder.includes(descriptor.instanceId))fail('DAILY_SPAWN_LEDGER_CONFLICT');
        return events.safeClone(state);
      }
      if(state.calendar.enemySpawnDate===date||(state.calendar.enemySpawnDate!==null&&!calendar.validDate(state.calendar.enemySpawnDate))||state.calendar.enemySpawnDate>date)fail('DAILY_SPAWN_LEDGER_CONFLICT');
      if(!Array.isArray(record.statusIds)||record.statusIds.some(ref=>!state.statusInstances[ref]||state.statusInstances[ref].ownerId!==record.instanceId||state.statusInstances[ref].ownerType!=='enemy'))fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      const next=events.safeClone(state);next.enemiesById[record.instanceId]=record;next.enemyOrder.push(record.instanceId);
      function living(){return next.enemyOrder.map(k=>next.enemiesById[k]).filter(e=>e&&!e.defeated);}
      while(true){
        const all=living(),boss=all.filter(e=>e.kind==='weekly'||e.kind==='areaBoss'),daily=all.filter(e=>e.kind==='daily');
        if(all.length<=5&&daily.length<=(boss.length?4:5))break;
        if(!daily.length||daily.some(e=>!calendar.validDate(e.spawnedOn)))fail('ENEMY_ORDER_UNRESOLVED');
        const oldest=daily.map(e=>e.spawnedOn).sort()[0],candidates=daily.filter(e=>e.spawnedOn===oldest);
        if(candidates.length!==1)fail('ENEMY_ORDER_UNRESOLVED');
        const remove=candidates[0];
        if(Object.values(next.statusInstances).some(s=>(s.sourceType==='enemy'&&s.sourceId===remove.instanceId)||(s.ownerType==='enemy'&&s.ownerId===remove.instanceId)))fail('ENEMY_EVICTION_SOURCE_STATUS_UNRESOLVED');
        delete next.enemiesById[remove.instanceId];next.enemyOrder=next.enemyOrder.filter(k=>k!==remove.instanceId);
      }
      next.calendar.enemySpawnDate=date;
      if(!schema.validateState(next).ok)fail('DAILY_ENCOUNTER_DESCRIPTOR_UNSUPPORTED');
      return next;
    }
    return Object.freeze({spawn});
  }
  return Object.freeze({create});
});
