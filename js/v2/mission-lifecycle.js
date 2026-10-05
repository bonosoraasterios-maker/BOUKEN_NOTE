(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./schema.js'):root.BOUKEN_NOTE_V2.schema,typeof module==='object'&&module.exports?require('./battle-events.js'):root.BOUKEN_NOTE_V2.battleEvents);if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.missionLifecycle=api;})(typeof globalThis!=='undefined'?globalThis:this,function(schema,events){
  'use strict';
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  const clone=value=>events.safeClone(value);
  function create(options){
    const policy=options&&options.assignmentRefPolicy;
    const archive=new Map();
    function verifySlot(slot){
      if(!policy||typeof policy.resolveImmutable!=='function')fail('MISSION_ASSIGNMENT_REF_POLICY_UNCONFIGURED');
      // The provider is an immutable revision archive, never a latest-setting
      // lookup. Its contract must reject redefined references across reloads.
      const provided=policy.resolveImmutable(slot.assignmentRef);
      if(!provided||provided.immutable!==true)fail('MISSION_ASSIGNMENT_REF_NOT_IMMUTABLE');
      const resolved=clone(provided);
      if(!resolved||resolved.immutable!==true)fail('MISSION_ASSIGNMENT_REF_NOT_IMMUTABLE');
      if(resolved.redefined===true||resolved.pointValue!==slot.pointValue)fail('MISSION_ASSIGNMENT_REF_REDEFINED');
      if(archive.has(slot.assignmentRef)&&!events.deepEqual(archive.get(slot.assignmentRef),resolved))fail('MISSION_ASSIGNMENT_REF_REDEFINED');
      archive.set(slot.assignmentRef,resolved);
      if(!Number.isSafeInteger(slot.pointValue))fail('MISSION_POINT_UNSAFE');
    }
    function assertInitialized(state){
      const result=schema.validateMissions(state);
      if(!result.initialized||!state.profile||state.profile.currentAreaId===null)fail('MISSION_LIFECYCLE_UNINITIALIZED');
      if(!Number.isSafeInteger(state.profile.points))fail('MISSION_POINT_UNSAFE');
      for(const group of Object.values(state.missions))if(Array.isArray(group.slots)&&group.slots.some(slot=>slot&&!Number.isSafeInteger(slot.pointValue)))fail('MISSION_POINT_UNSAFE');
      if(!result.ok)fail('MISSION_STATE_INVALID');
      for(const group of Object.values(state.missions))group.slots.forEach(verifySlot);
      return true;
    }
    function initialize(state,configuration){
      if(schema.validateMissions(state).initialized)fail('MISSION_ALREADY_INITIALIZED');
      if(!state.profile||typeof state.profile.currentAreaId!=='string'||!state.profile.currentAreaId||!configuration)fail('MISSION_LIFECYCLE_UNINITIALIZED');
      // This explicit trusted path supplies every slot and initial completion.
      // It does not interpret migration IDs, counters or definition defaults.
      const next=clone(state),groups={};
      for(const kind of ['daily','weekly','special']){
        const config=configuration[kind];
        if(!config||!Array.isArray(config.slots)||!Array.isArray(config.completedIds))fail('MISSION_LIFECYCLE_UNINITIALIZED');
        groups[kind]={slots:clone(config.slots),completedIds:clone(config.completedIds)};
      }
      groups.daily.date=state.calendar.localDate;groups.daily.resultCount=groups.daily.completedIds.length;
      groups.weekly.weekKey=state.calendar.weekKey;groups.weekly.clearCount=groups.weekly.completedIds.length;
      groups.special.areaId=configuration.special.areaId;
      next.missions=groups;assertInitialized(next);return next;
    }
    function completeDaily(state,slotId){
      assertInitialized(state);
      const slot=state.missions.daily.slots.find(x=>x.slotId===slotId);
      if(!slot)fail('MISSION_SLOT_INACTIVE');
      if(state.missions.daily.completedIds.includes(slotId))return clone(state);
      if(!Number.isSafeInteger(slot.pointValue)||!Number.isSafeInteger(state.profile.points)||!Number.isSafeInteger(state.profile.points+slot.pointValue))fail('MISSION_POINT_UNSAFE');
      const next=clone(state);next.missions.daily.completedIds.push(slotId);next.missions.daily.resultCount=next.missions.daily.completedIds.length;next.profile.points+=slot.pointValue;
      assertInitialized(next);return next;
    }
    function rolloverDaily(state,date,configuration){
      // Validate the previous active snapshot before inheriting or replacing it.
      assertInitialized(state);
      const next=clone(state);
      const slots=configuration===null||configuration===undefined?state.missions.daily.slots:configuration.slots;
      if(!Array.isArray(slots))fail('MISSION_LIFECYCLE_UNINITIALIZED');
      next.missions.daily={date,completedIds:[],resultCount:0,slots:clone(slots)};
      next.calendar.localDate=date;assertInitialized(next);return next;
    }
    function rolloverWeekly(state,weekKey,configuration){
      assertInitialized(state);const next=clone(state);
      const slots=configuration===null||configuration===undefined?state.missions.weekly.slots:configuration.slots;
      if(!Array.isArray(slots))fail('MISSION_LIFECYCLE_UNINITIALIZED');
      next.calendar.weekKey=weekKey;next.missions.weekly={weekKey,completedIds:[],clearCount:0,slots:clone(slots)};
      assertInitialized(next);return next;
    }
    return Object.freeze({assertInitialized,initialize,completeDaily,rolloverDaily,rolloverWeekly});
  }
  return Object.freeze({create});
});
