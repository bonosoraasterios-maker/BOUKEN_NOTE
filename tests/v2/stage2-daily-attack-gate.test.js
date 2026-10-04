'use strict';
const assert=require('node:assert/strict');
const operationApi=require('../../js/v2/app-operation-repository.js');
const gateApi=require('../../js/v2/daily-attack-gate.js');
const adapterApi=require('../../js/v2/verification-operation-storage.js');
const entry=require('../../js/v2/production-verification-entry.js');
const v2={characters:require('../../data/v2/characters.js'),enemies:require('../../data/v2/enemies.js'),skills:require('../../data/v2/skills.js'),statusEffects:require('../../data/v2/status-effects.js'),battleRules:require('../../data/v2/battle-rules.js'),missions:require('../../data/v2/missions.js'),saveMigration:require('../../js/v2/save-migration.js')};
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const record=(overrides={})=>({version:1,timezone:'Asia/Tokyo',dailyAttack:{dayKey:'2026-09-27',status:'reserved',reservationId:'r-1',battleId:'trusted-battle',dailyResult:1,...overrides}});
function setup(){
 const map=new Map();let writes=0,ids=0,calls=0,pending=null,now='2026-09-27T12:00:00+09:00',resolve,reject;
 const state=entry.fixtureState(v2),trace=[];
 const faults={};
 const storage={getItem:()=>{if(faults.read)throw Error('read');return map.has(operationApi.KEY)?map.get(operationApi.KEY):null;},setItem:(k,v)=>{writes++;trace.push(JSON.parse(v).dailyAttack.status);if(faults.write===writes)throw Error('write');if(faults.drop===writes)return;map.set(k,v);},removeItem:k=>{if(faults.remove)throw Error('remove');if(!faults.dropRemove)map.delete(k);}};
 const operation=operationApi.create(storage);
 const battle={loadState:()=>({state}),loadPending:()=>{if(faults.pendingRead)throw Error('pending read');return pending;}};
 const scheduler={attack:(input,defs,seed)=>{calls++;assert.equal(operation.load().dailyAttack.status,'reserved');assert.equal(seed,'trusted-seed');trace.push('pending');pending={battleId:input.battleId,startSnapshot:JSON.parse(JSON.stringify(state))};return new Promise((a,b)=>{resolve=a;reject=b;});}};
 const options={clock:()=>now,createReservationId:()=>{ids++;return 'r-1';},operationRepository:operation,battleRepository:battle,scheduler,requestFactory:()=>({battleId:'trusted-battle',rngSeed:'trusted-seed',attackerSkillId:null,leaderCharacterId:null})};
 const gate=gateApi.create(options);
 return {map,state,trace,faults,storage,operation,battle,scheduler,options,gate,counters:()=>({writes,ids,calls}),setPending:p=>{pending=p;},setNow:n=>{now=n;},finish:()=>{pending=null;resolve();},reject:()=>reject(Error('presentation')),pending:()=>pending};
}
const code=(fn,c)=>assert.throws(fn,e=>e.code===c);
test('Daily0 writes nothing, generates no ID and invokes no Scheduler/Controller; later Daily1 works',async()=>{
 const x=setup();x.state.missions.daily.resultCount=0;assert.deepEqual(x.gate.attack(),{notice:true,reason:'DAILY_ZERO'});assert.deepEqual(x.counters(),{writes:0,ids:0,calls:0});x.state.missions.daily.resultCount=1;const p=x.gate.attack();assert.equal(x.counters().calls,1);x.finish();await p;
});
for(const [name,change] of [['timezone',x=>x.state.calendar.timezone='UTC'],['calendar.localDate',x=>x.state.calendar.localDate='2026-09-26'],['daily.date',x=>x.state.missions.daily.date='2026-09-26'],['fraction',x=>x.state.missions.daily.resultCount=1.5],['string',x=>x.state.missions.daily.resultCount='1'],['negative',x=>x.state.missions.daily.resultCount=-1],['overflow',x=>x.state.missions.daily.resultCount=4]])test(name+' freshness fails before Scheduler/Controller',()=>{const x=setup();change(x);code(()=>x.gate.attack(),'DAILY_STATE_STALE');assert.equal(x.counters().calls,0);assert.equal(x.counters().writes,0);});
for(const n of [1,2,3])test('Daily'+n+' freezes State result and trusted identity before reserved/pending/consumed',async()=>{const x=setup();x.state.missions.daily.resultCount=n;let input;const real=x.scheduler.attack;x.scheduler.attack=(i,d,s)=>{input=i;const p=real(i,d,s);x.state.missions.daily.resultCount=0;return p;};const p=x.gate.attack();assert.equal(input.dailyResult,n);assert.equal(input.battleDate,'2026-09-27');assert.equal(input.battleId,'trusted-battle');assert.deepEqual(x.trace,['reserved','pending','consumed']);assert.equal(x.operation.load().dailyAttack.dailyResult,n);x.finish();await p;});
for(const f of ['write','drop'])test('reserved '+f+' failure never reaches Controller',()=>{const x=setup();x.faults[f]=1;assert.throws(()=>x.gate.attack());assert.equal(x.counters().calls,0);});
test('double tap and consumed same-day reload invoke Controller at most once',async()=>{const x=setup();const p=x.gate.attack();code(()=>x.gate.attack(),'ATTACK_IN_FLIGHT');x.finish();await p;code(()=>x.gate.attack(),'ATTACK_ALREADY_CONSUMED');code(()=>gateApi.create(x.options).attack(),'ATTACK_ALREADY_CONSUMED');assert.equal(x.counters().calls,1);});
test('reserved matching pending recovery commits then consumes identical reservation',()=>{const x=setup();x.operation.save(record());x.setPending({battleId:'trusted-battle',startSnapshot:x.state});const plan=x.gate.recoveryPlan();assert.equal(x.operation.load().dailyAttack.status,'reserved');x.setPending(null);x.gate.completeRecovery(plan);assert.equal(x.operation.load().dailyAttack.status,'consumed');assert.equal(x.operation.load().dailyAttack.reservationId,'r-1');assert.equal(x.counters().calls,0);});
test('consumed matching pending recovery retains consumed',()=>{const x=setup();x.operation.save(record({status:'consumed'}));x.setPending({battleId:'trusted-battle',startSnapshot:x.state});const plan=x.gate.recoveryPlan();x.setPending(null);x.gate.completeRecovery(plan);assert.equal(x.operation.load().dailyAttack.status,'consumed');assert.equal(x.counters().writes,1);});
test('reserved without pending stops UNRESOLVED, never repairs or removes',()=>{const x=setup();x.operation.save(record());code(()=>x.gate.recoveryPlan(),'ATTACK_RESERVATION_UNRESOLVED');code(()=>x.gate.attack(),'ATTACK_RESERVATION_UNRESOLVED');assert.equal(x.counters().writes,1);});
test('reserved mismatched pending stops CONFLICT',()=>{const x=setup();x.operation.save(record());x.setPending({battleId:'other',startSnapshot:x.state});code(()=>x.gate.recoveryPlan(),'ATTACK_RESERVATION_CONFLICT');assert.equal(x.counters().calls,0);});
test('managed pending without operation stops rather than guessing record',()=>{const x=setup();x.setPending({battleId:'trusted-battle',startSnapshot:x.state});code(()=>x.gate.recoveryPlan(),'ATTACK_OPERATION_MISSING');assert.equal(x.counters().writes,0);});
test('previous-day consumed operation with pending blocks replacement',()=>{const x=setup();x.operation.save(record({dayKey:'2026-09-26',status:'consumed'}));x.setPending({battleId:'previous'});code(()=>x.gate.attack(),'PENDING_NOT_RECOVERED');assert.equal(x.counters().writes,1);});
test('previous-day consumed operation without pending allows fresh current day',async()=>{const x=setup();x.operation.save(record({dayKey:'2026-09-26',status:'consumed'}));const p=x.gate.attack();assert.equal(x.operation.load().dailyAttack.dayKey,'2026-09-27');x.finish();await p;});
test('previous-day reservation without pending remains unresolved',()=>{const x=setup();x.operation.save(record({dayKey:'2026-09-26'}));code(()=>x.gate.attack(),'ATTACK_RESERVATION_UNRESOLVED');});
test('sync Scheduler throw with no pending and matching ID rolls back only current reservation',()=>{const x=setup();x.scheduler.attack=()=>{throw Error('sync');};assert.throws(()=>x.gate.attack(),/sync/);assert.equal(x.operation.load(),null);});
test('sync failure restores previous consumed bytes without changing previous right',()=>{const x=setup();x.operation.save(record({dayKey:'2026-09-26',status:'consumed'}));const before=x.map.get(operationApi.KEY);x.scheduler.attack=()=>{throw Error('sync');};assert.throws(()=>x.gate.attack());assert.equal(x.map.get(operationApi.KEY),before);});
test('sync failure with persisted pending forbids rollback',()=>{const x=setup();x.scheduler.attack=()=>{x.setPending({battleId:'trusted-battle'});throw Error('sync');};assert.throws(()=>x.gate.attack());assert.equal(x.operation.load().dailyAttack.status,'reserved');});
test('reservationId mismatch forbids rollback',()=>{const x=setup();x.scheduler.attack=()=>{x.operation.save(record({reservationId:'other'}));throw Error('sync');};code(()=>x.gate.attack(),'ATTACK_RESERVATION_CONFLICT');assert.equal(x.operation.load().dailyAttack.reservationId,'other');});
test('battleId mismatch forbids rollback',()=>{const x=setup();x.scheduler.attack=()=>{x.operation.save(record({battleId:'other'}));throw Error('sync');};code(()=>x.gate.attack(),'ATTACK_RESERVATION_CONFLICT');assert.equal(x.operation.load().dailyAttack.battleId,'other');});
test('pending read failure after synchronous throw preserves reservation',()=>{const x=setup();x.scheduler.attack=()=>{x.faults.pendingRead=true;throw Error('sync');};assert.throws(()=>x.gate.attack());assert.equal(x.operation.load().dailyAttack.status,'reserved');});
test('Presentation failure never returns ATTACK right',async()=>{const x=setup();const p=x.gate.attack();x.reject();await assert.rejects(p);assert.equal(x.operation.load().dailyAttack.status,'consumed');x.setPending(null);code(()=>x.gate.attack(),'ATTACK_ALREADY_CONSUMED');});
for(const f of ['write','drop'])test('consumed promotion '+f+' failure never reopens; vanished pending stays unresolved',()=>{const x=setup();x.faults[f]=2;assert.throws(()=>x.gate.attack());assert.equal(x.operation.load().dailyAttack.status,'reserved');x.finish();code(()=>x.gate.recoveryPlan(),'ATTACK_RESERVATION_UNRESOLVED');code(()=>x.gate.attack(),'ATTACK_RESERVATION_UNRESOLVED');assert.equal(x.counters().calls,1);});
for(const [name,value] of [['malformed JSON','{'],['unknown top key',JSON.stringify({...record(),extra:1})],['unknown attack key',JSON.stringify(record({extra:1}))],['wrong version',JSON.stringify({...record(),version:2})],['wrong timezone',JSON.stringify({...record(),timezone:'UTC'})],['bad day',JSON.stringify(record({dayKey:'2026-02-30'}))],['bad status',JSON.stringify(record({status:'unused'}))],['bad reservation',JSON.stringify(record({reservationId:''}))],['bad battleId',JSON.stringify(record({battleId:'!'}))],['bad result',JSON.stringify(record({dailyResult:0}))]])test(name+' fails closed',()=>{const x=setup();x.map.set(operationApi.KEY,value);code(()=>x.gate.attack(),'MALFORMED_OPERATION');assert.equal(x.counters().calls,0);});
test('operation read failure fails closed',()=>{const x=setup();x.faults.read=true;code(()=>x.gate.attack(),'OPERATION_READ_FAILED');assert.equal(x.counters().calls,0);});
for(const f of ['remove','dropRemove'])test('rollback '+f+' failure fails closed',()=>{const x=setup();x.faults[f]=true;x.scheduler.attack=()=>{throw Error('sync');};assert.throws(()=>x.gate.attack());assert.equal(x.operation.load().dailyAttack.status,'reserved');});
test('Asia/Tokyo 23:59 to 00:00 changes day; stale State never auto-updates',()=>{const x=setup();x.setNow('2026-09-27T14:59:59Z');assert.equal(x.gate.inspect().ok,true);x.setNow('2026-09-27T15:00:00Z');assert.equal(x.gate.inspect().reason,'DAILY_STATE_STALE');assert.equal(gateApi.dayKey(()=> '2026-09-27T15:00:00Z'),'2026-09-28');assert.equal(x.counters().writes,0);});
test('verification separate Battle3 and operation1 adapters use only stage2a-daily1 namespace',()=>{const storage={map:new Map(),getItem(k){return this.map.get(k)??null;},setItem(k,v){this.map.set(k,v);},removeItem(k){this.map.delete(k);}};const keys=require('../../js/v2/save-repository.js').KEYS;const battle=entry.isolatedStorage(storage,keys,'stage2a-daily1').adapter,op=adapterApi.create(storage);for(const key of Object.values(keys)){battle.setItem(key,'battle');assert.throws(()=>op.getItem(key));}assert.throws(()=>battle.getItem(operationApi.KEY));op.setItem(operationApi.KEY,'operation');assert.equal(storage.map.size,4);assert.ok([...storage.map.keys()].every(k=>k.startsWith('bn2:verification:stage2a-daily1:')));assert.ok([...storage.map.keys()].every(k=>!k.includes('phase-g-daily-only')));});
test('operation null record validates, IDs and result boundaries reject malformed values',()=>{
 assert.deepEqual(operationApi.validate({version:1,timezone:'Asia/Tokyo',dailyAttack:null}),{version:1,timezone:'Asia/Tokyo',dailyAttack:null});
 for(const patch of [{reservationId:'x'.repeat(65)},{reservationId:5},{battleId:null},{dailyResult:1.5},{dailyResult:4}])code(()=>operationApi.validate(record(patch)),'MALFORMED_OPERATION');
});
test('read failure after reserved write reaches no Controller and preserves reservation',()=>{
 const x=setup(),set=x.storage.setItem;x.storage.setItem=(k,v)=>{set(k,v);x.faults.read=true;};
 code(()=>x.gate.attack(),'OPERATION_READ_FAILED');x.faults.read=false;assert.equal(x.operation.load().dailyAttack.status,'reserved');assert.equal(x.counters().calls,0);
});
test('read-back exception after consumed write never rolls back or reopens',()=>{
 const x=setup(),set=x.storage.setItem;x.storage.setItem=(k,v)=>{set(k,v);if(JSON.parse(v).dailyAttack.status==='consumed')x.faults.read=true;};
 code(()=>x.gate.attack(),'OPERATION_READ_FAILED');x.faults.read=false;assert.equal(x.operation.load().dailyAttack.status,'consumed');x.finish();code(()=>x.gate.attack(),'ATTACK_ALREADY_CONSUMED');
});
test('consumed promotion read-back mismatch preserves existing reservation and never reopens',()=>{
 const x=setup(),get=x.storage.getItem;let mismatch=false;x.storage.setItem=(k,v)=>{if(JSON.parse(v).dailyAttack.status==='consumed'){mismatch=true;return;}x.map.set(k,v);};
 x.storage.getItem=()=>get();code(()=>x.gate.attack(),'OPERATION_VERIFY_FAILED');assert.equal(mismatch,true);x.finish();code(()=>x.gate.recoveryPlan(),'ATTACK_RESERVATION_UNRESOLVED');
});
test('freshness failure after previous-day consumed record does not replace it',()=>{
 const x=setup();x.operation.save(record({dayKey:'2026-09-26',status:'consumed'}));x.state.missions.daily.date='2026-09-26';code(()=>x.gate.attack(),'DAILY_STATE_STALE');assert.equal(x.operation.load().dailyAttack.dayKey,'2026-09-26');assert.equal(x.counters().writes,1);
});
test('real Controller pending is persisted before consumed; reserved reload recovers without Calculator',async()=>{
 const repoApi=require('../../js/v2/save-repository.js'),controllerApi=require('../../js/v2/battle-controller.js'),schedulerApi=require('../../js/v2/battle-presentation-scheduler.js'),calc=require('../../js/v2/battle-calculator.js');
 const x=setup();const battleMap=new Map(),battleStorage={getItem:k=>battleMap.get(k)??null,setItem:(k,v)=>battleMap.set(k,v),removeItem:k=>battleMap.delete(k)};
 const repository=repoApi.create(battleStorage);repository.saveInitialState(x.state);let calculations=0;
 const controller=controllerApi.create({repository,calculateBattle:(...args)=>{calculations++;return calc.calculateBattle(...args);}});
 let release,autoRelease=false;const scheduler=schedulerApi.create({controller,wait:()=>autoRelease?Promise.resolve():new Promise(r=>{release=r;})});
 let firstPromotion=true;const opSet=x.storage.setItem;x.storage.setItem=(k,v)=>{if(firstPromotion&&JSON.parse(v).dailyAttack.status==='consumed'){assert.ok(repository.loadPending());firstPromotion=false;}opSet(k,v);};
 const gate=gateApi.create({...x.options,battleRepository:repository,scheduler,definitions:entry.definitions(v2)});
 const playing=gate.attack();assert.equal(calculations,1);assert.equal(x.operation.load().dailyAttack.status,'consumed');
 const pending=repository.loadPending();x.operation.save(record());
 const recoveredController=controllerApi.create({repository,calculateBattle:()=>{throw Error('recalculation forbidden');}});
 const recoveredScheduler=schedulerApi.create({controller:recoveredController});
 const reload=gateApi.create({...x.options,battleRepository:repository,scheduler:recoveredScheduler});
 const plan=reload.recoveryPlan();recoveredController.recover();recoveredScheduler.skip();reload.completeRecovery(plan);
 assert.equal(repository.loadPending(),null);assert.deepEqual(repository.loadState().state,pending.finalSnapshot);assert.equal(x.operation.load().dailyAttack.status,'consumed');assert.equal(calculations,1);
 // Cancel the pre-reload page's presentation without committing it again.
 autoRelease=true;release();await assert.rejects(playing);code(()=>reload.attack(),'ATTACK_ALREADY_CONSUMED');
});
(async()=>{let passed=0;for(const [name,fn]of tests){try{await fn();passed++;console.log('ok - Stage 2A: '+name);}catch(e){process.exitCode=1;console.error('not ok - Stage 2A: '+name+'\n'+e.stack);}}console.log(`# ${passed}/${tests.length} Stage 2A tests passed`);})();
