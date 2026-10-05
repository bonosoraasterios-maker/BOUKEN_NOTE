(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./battle-events.js'):root.BOUKEN_NOTE_V2.battleEvents,typeof module==='object'&&module.exports?require('./week-lifecycle.js'):root.BOUKEN_NOTE_V2.weekLifecycle);if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.calendarLifecycle=api;})(typeof globalThis!=='undefined'?globalThis:this,function(events,weekApi){
  'use strict';
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
  function nextDate(value){if(!validDate(value))fail('CALENDAR_DATE_UNRESOLVED');return new Date(new Date(value+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);}
  function currentDay(clock){const d=new Date(clock());if(!Number.isFinite(d.getTime()))fail('CALENDAR_DATE_UNRESOLVED');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const get=t=>parts.find(p=>p.type===t).value;return get('year')+'-'+get('month')+'-'+get('day');}
  function assertFresh(state,clock){const today=currentDay(clock);if(state.calendar.timezone!=='Asia/Tokyo'||state.calendar.localDate!==today||state.missions.daily.date!==today)fail('DAILY_STATE_STALE');return today;}
  function dayBoundaryEffects(state,date){
    const next=events.safeClone(state),hits=next.battleProgress.pendingElliottHits;
    if(!hits||Object.keys(hits).length!==2||!Object.prototype.hasOwnProperty.call(hits,'amount')||!Object.prototype.hasOwnProperty.call(hits,'expiresOn'))fail('DAY_BOUNDARY_EFFECT_UNRESOLVED');
    if(hits.amount===null&&hits.expiresOn===null){}else{
      if(!Number.isSafeInteger(hits.amount)||hits.amount<0||!validDate(hits.expiresOn))fail('DAY_BOUNDARY_EFFECT_UNRESOLVED');
      if(date>hits.expiresOn)next.battleProgress.pendingElliottHits={amount:null,expiresOn:null};
    }
    const myart=state.charactersById.myart;
    if(myart&&myart.resources&&Object.prototype.hasOwnProperty.call(myart.resources,'reserveSp')&&myart.resources.reserveSp!==0&&myart.resources.reserveSp!==null)fail('DAY_BOUNDARY_EFFECT_UNRESOLVED');
    // No Linnet daily-use field is invented. Unknown active flags and unknown
    // date-bound resources stop the whole day, rather than silently expiring.
    // Resource map entries (including debtBySourceId Enemy IDs) are opaque.
    // Only explicit authoritative fields are interpreted; unknown resource
    // fields fail closed without inspecting their names or nested map keys.
    const resourceFields = {
      aria:['debtBySourceId'],myart:['reserveSp','researchKits','weaknessMaterials','otherMaterials'],linnet:['tameRoster'],irina:['reinforcementUsageByCharacterId'],ceres:['reserveHp','weeklyBarrierLoss'],sierra:['faceCoins','coinTossAudit','jackpot'],rg:['runesByStatusId','reversalRune']
    };
    for(const [characterId,character] of Object.entries(state.charactersById)){
      for(const [key,value] of Object.entries(character.flags||{}))if(!((characterId==='myart'&&key==='weaknessProtocolDeveloped')||(characterId==='ceres'&&key==='recoveryLocked'))&&value!==false&&value!==null)fail('DAY_BOUNDARY_EFFECT_UNRESOLVED');
      for(const [field,value] of Object.entries(character.resources||{})){
        if((resourceFields[characterId]||[]).includes(field))continue;
        if(value!==null&&value!==0&&value!==false)fail('DAY_BOUNDARY_EFFECT_UNRESOLVED');
      }
    }
    // All other battleProgress, leaderCarry, status/debt counters and same-week
    // enemies are copied verbatim. dailySuUsedOn is intentionally not reset.
    return next;
  }
  function create(options){
    const clock=options&&options.clock,boundary=options&&options.boundaryProvider;
    const week=weekApi.create(options||{});
    function context(state,date){if(!boundary||typeof boundary.forDate!=='function')fail('CALENDAR_BOUNDARY_UNCONFIGURED');return boundary.forDate({date,previousDate:state.calendar.localDate,weekKey:state.calendar.weekKey,timezone:'Asia/Tokyo'});}
    function bind(state){return week.bind(state,context(state,state.calendar.localDate));}
    if(typeof clock!=='function')fail('CALENDAR_CLOCK_UNCONFIGURED');
    function target(){return currentDay(clock);}
    function step(state){
      if(state.calendar.timezone!=='Asia/Tokyo'||!validDate(state.calendar.localDate))fail('CALENDAR_DATE_UNRESOLVED');
      state=bind(state);
      const date=nextDate(state.calendar.localDate);
      const supplied=context(state,date);weekApi.validateContext(supplied,state,date);
      const transitioned=week.transition(state,supplied);
      const next=dayBoundaryEffects(transitioned,date);next.calendar.localDate=date;return next;
    }
    return Object.freeze({target,step,bind,assertFresh:state=>assertFresh(state,clock)});
  }
  return Object.freeze({create,currentDay,validDate,dayBoundaryEffects});
});
