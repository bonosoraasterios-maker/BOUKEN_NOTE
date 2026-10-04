(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.dailyAttackGate=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  function dayKey(clock){
    const d=new Date(clock());if(!Number.isFinite(d.getTime()))fail('INVALID_CLOCK');
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t).value;return get('year')+'-'+get('month')+'-'+get('day');
  }
  function create(options){
    const {clock,createReservationId,operationRepository,battleRepository,scheduler,requestFactory}=options;
    if(![clock,createReservationId,requestFactory].every(x=>typeof x==='function')||!operationRepository||!battleRepository||!scheduler)fail('INVALID_GATE_DEPENDENCIES');
    let inFlight=false;
    function record(){const value=operationRepository.load();return value&&value.dailyAttack;}
    function check(){
      if(inFlight)fail('ATTACK_IN_FLIGHT');
      const state=battleRepository.loadState().state,currentDayKey=dayKey(clock),daily=state.missions&&state.missions.daily;
      if(!state.calendar||state.calendar.timezone!=='Asia/Tokyo'||state.calendar.localDate!==currentDayKey||!daily||daily.date!==currentDayKey||!Number.isInteger(daily.resultCount)||daily.resultCount<0||daily.resultCount>3)fail('DAILY_STATE_STALE');
      if(battleRepository.loadPending()!==null)fail('PENDING_NOT_RECOVERED');
      const operation=operationRepository.load(),a=operation&&operation.dailyAttack;
      // An unresolved reservation is never cleared by the date changing.
      if(a&&a.status==='reserved')fail('ATTACK_RESERVATION_UNRESOLVED');
      if(a&&a.dayKey===currentDayKey)fail('ATTACK_ALREADY_CONSUMED');
      return {state,currentDayKey,dailyResult:daily.resultCount,previous:operation};
    }
    function inspect(){try{const c=check();return c.dailyResult===0?{ok:false,notice:true,reason:'DAILY_ZERO'}:{ok:true,reason:'DAILY_ATTACK_AVAILABLE'};}catch(e){return {ok:false,reason:e.code||e.message};}}
    function attack(){
      const c=check();if(c.dailyResult===0)return {notice:true,reason:'DAILY_ZERO'};
      inFlight=true;
      let reserved,request,running;
      try{
        const trusted=requestFactory();
        request={input:Object.freeze({battleId:trusted.battleId,battleDate:c.currentDayKey,dailyResult:c.dailyResult,attackerSkillId:trusted.attackerSkillId,leaderCharacterId:trusted.leaderCharacterId}),rngSeed:trusted.rngSeed};
        reserved={dayKey:c.currentDayKey,status:'reserved',reservationId:createReservationId(),battleId:trusted.battleId,dailyResult:c.dailyResult};
        operationRepository.save({version:1,timezone:'Asia/Tokyo',dailyAttack:reserved});
        try{running=scheduler.attack(request.input,options.definitions,request.rngSeed);}
        catch(error){
          // A failed pending read or identity check preserves the reservation.
          if(battleRepository.loadPending()===null)operationRepository.rollback(reserved,c.previous);
          throw error;
        }
        // Attach rejection ownership before storage promotion: presentation may
        // continue even when consumed persistence fails; never reopen the right.
        const presentation=Promise.resolve(running);
        presentation.catch(()=>{});
        operationRepository.consume(reserved);
        return presentation.finally(()=>{inFlight=false;});
      }catch(error){inFlight=false;throw error;}
    }
    function recoveryPlan(){
      const pending=battleRepository.loadPending(),a=record();
      if(pending){
        if(!a)fail('ATTACK_OPERATION_MISSING');
        if(a.battleId!==pending.battleId||!pending.startSnapshot||a.dayKey!==pending.startSnapshot.calendar.localDate||a.dailyResult!==pending.startSnapshot.missions.daily.resultCount)fail('ATTACK_RESERVATION_CONFLICT');
        return {pending,operation:a};
      }
      if(a&&a.status==='reserved')fail('ATTACK_RESERVATION_UNRESOLVED');
      return {pending:null,operation:a};
    }
    function completeRecovery(plan){
      if(!plan.pending)return;
      if(battleRepository.loadPending()!==null)fail('PENDING_NOT_RECOVERED');
      const current=record();
      if(!current||current.reservationId!==plan.operation.reservationId||current.battleId!==plan.operation.battleId||current.status!==plan.operation.status)fail('ATTACK_RESERVATION_CONFLICT');
      if(current.status==='reserved')operationRepository.consume(plan.operation);
    }
    return Object.freeze({attack,inspect,recoveryPlan,completeRecovery,isInFlight:()=>inFlight});
  }
  return Object.freeze({create,dayKey});
});
