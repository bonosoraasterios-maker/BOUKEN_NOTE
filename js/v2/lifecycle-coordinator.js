(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mission-lifecycle.js'):root.BOUKEN_NOTE_V2.missionLifecycle,typeof module==='object'&&module.exports?require('./calendar-lifecycle.js'):root.BOUKEN_NOTE_V2.calendarLifecycle,typeof module==='object'&&module.exports?require('./enemy-lifecycle.js'):root.BOUKEN_NOTE_V2.enemyLifecycle,typeof module==='object'&&module.exports?require('./battle-events.js'):root.BOUKEN_NOTE_V2.battleEvents,typeof module==='object'&&module.exports?require('./week-lifecycle.js'):root.BOUKEN_NOTE_V2.weekLifecycle);if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.lifecycleCoordinator=api;})(typeof globalThis!=='undefined'?globalThis:this,function(missionApi,calendarApi,enemyApi,events,weekApi){
  'use strict';
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  function create(options){
    const repository=options.repository,operation=options.operationRepository;
    const mission=missionApi.create(options),calendar=calendarApi.create(options),enemy=enemyApi.create(options);
    function expected(){
      if(!operation||typeof operation.load!=='function')fail('OPERATION_POLICY_UNCONFIGURED');
      const record=operation.load();if(record&&record.dailyAttack&&record.dailyAttack.status==='reserved')fail('ATTACK_RESERVATION_UNRESOLVED');
      if(repository.loadPending()!==null)fail('NON_BATTLE_PENDING');
      return repository.loadState().state;
    }
    function commit(before,next,kind){
      return repository.commitStateTransition(before,next,(current,candidate)=>{
        mission.assertInitialized(candidate);
        // A narrow domain mask: all unrelated Battle/audit State is immutable.
        const mask=value=>{const copy=events.safeClone(value);delete copy.missions;
          if(kind==='completion')delete copy.profile.points;
          if(kind==='calendar'){delete copy.calendar;delete copy.enemiesById;delete copy.enemyOrder;delete copy.charactersById;delete copy.statusInstances;delete copy.battleProgress.pendingElliottHits;}
          return copy;};
        if(!events.deepEqual(mask(current),mask(candidate)))fail('INVALID_STATE_TRANSITION');
        if(kind==='completion'&&(!events.deepEqual(current.missions.weekly,candidate.missions.weekly)||!events.deepEqual(current.missions.special,candidate.missions.special)||!events.deepEqual(current.missions.daily.slots,candidate.missions.daily.slots)||current.missions.daily.date!==candidate.missions.daily.date))fail('INVALID_STATE_TRANSITION');
        if(kind==='calendar'){if(!events.deepEqual(candidate,next)||!events.deepEqual(current.missions.special,candidate.missions.special))fail('INVALID_STATE_TRANSITION');weekApi.validateTransition(current,candidate,options.definitions);}
        return true;
      });
    }
    function initializeMissions(configuration){const before=expected();calendar.assertFresh(before);return commit(before,mission.initialize(before,configuration),'initialize');}
    function completeMission(kind,slotId){
      if(kind==='weekly')fail('WEEKLY_COMPLETION_POINT_POLICY_UNRESOLVED');
      if(kind==='special')fail('SPECIAL_COMPLETION_STAGE3C_HOLD');
      if(kind!=='daily')fail('MISSION_KIND_UNSUPPORTED');
      const before=expected();calendar.assertFresh(before);return commit(before,mission.completeDaily(before,slotId),'completion');
    }
    function simulateCalendar(before){
      mission.assertInitialized(before);
      const target=calendar.target();if(target<before.calendar.localDate)fail('CALENDAR_TIME_REVERSED');
      let next=calendar.bind(before);
      while(next.calendar.localDate<target){
        const dateStep=calendar.step(next);
        const config=options.missionConfigurationProvider&&options.missionConfigurationProvider.forPeriod({kind:'daily',date:dateStep.calendar.localDate,areaId:next.profile.currentAreaId});
        const date=dateStep.calendar.localDate;dateStep.calendar.localDate=next.calendar.localDate;
        next=mission.rolloverDaily(dateStep,date,config);
        next=enemy.spawn(next);
      }
      return next;
    }
    function advanceCalendar(){const before=expected();return commit(before,simulateCalendar(before),'calendar');}
    return Object.freeze({initializeMissions,completeMission,advanceCalendar,simulateCalendar});
  }
  return Object.freeze({create});
});
