'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const entry = require('../../js/v2/production-verification-entry.js');
const v2 = {
  characters:require('../../data/v2/characters.js'), enemies:require('../../data/v2/enemies.js'),
  skills:require('../../data/v2/skills.js'), statusEffects:require('../../data/v2/status-effects.js'),
  battleRules:require('../../data/v2/battle-rules.js'), missions:require('../../data/v2/missions.js'),
  schema:require('../../js/v2/schema.js'), saveMigration:require('../../js/v2/save-migration.js'),
  seededRng:require('../../js/v2/seeded-rng.js'), battleEvents:require('../../js/v2/battle-events.js'),
  battleCalculator:require('../../js/v2/battle-calculator.js'), saveRepository:require('../../js/v2/save-repository.js'),
  battleController:require('../../js/v2/battle-controller.js'), formalBattleBootstrap:require('../../js/v2/formal-battle-bootstrap.js')
};
const defs = entry.definitions(v2);
function memory() {
  const map = new Map();
  return {map,getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
}
class Node {
  constructor(tag) { this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.style={};this.listeners={};this.parentNode=null;this.className='';this.textContent='';this.hidden=false;this.inert=false;this.disabled=false;this.classList={add:value=>{this.className+=' '+value;}}; }
  appendChild(node) { node.parentNode=this;this.children.push(node);return node; }
  removeChild(node) { this.children.splice(this.children.indexOf(node),1);node.parentNode=null;return node; }
  get firstChild() { return this.children[0]||null; }
  setAttribute(name,value) { this.attributes[name]=String(value); }
  addEventListener(type,fn) { this.listeners[type]=fn; }
  querySelector(selector) { return walk(this).find(node=>selector[0]==='.' && node.className.split(' ').includes(selector.slice(1))) || null; }
  click() { if (!this.disabled && this.listeners.click) this.listeners.click(); }
}
const walk = node => [node].concat(node.children.flatMap(walk));
function environment() {
  const body=new Node('body'),head=new Node('head'),old=new Node('main'),host=new Node('main');
  old.id='g';host.id='bn2-verification-host';host.hidden=true;host.inert=true;body.appendChild(old);body.appendChild(host);
  const css=new Node('link');css.id='bn2-verification-css';css.sheet={cssRules:[{selectorText:'.bn2-shell'}]};head.appendChild(css);
  const document={body,head,createElement:tag=>new Node(tag),getElementById:id=>walk(body).concat(walk(head)).find(node=>node.id===id)||null};
  const env={document,BOUKEN_NOTE_V2:v2,sessionStorage:memory(),localStorage:memory(),location:{search:'?bn2FormalBattleV2=1&bn2VerificationMode=1'}};
  return {env,host,old};
}
function gate(extra) {
  const storage=memory(),repository=v2.saveRepository.create(storage),state=entry.fixtureState(v2);
  repository.saveInitialState(state);
  return entry.attackGate(Object.assign({v2,repository,defs,state,input:entry.FIXTURE_INPUT,seed:entry.FIXTURE_SEED,fixture:true,checkWritable:()=>{},locked:false},extra));
}
const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
test('selector truth table chooses verification only with both flags',()=>{
  for(const [a,b] of [[0,0],[0,1],[1,0],[1,1]]) assert.equal(entry.selectVerification('?bn2FormalBattleV2='+a+'&bn2VerificationMode='+b),a===1&&b===1);
});
test('selector rejects missing, duplicate, empty, whitespace and non-strict values',()=>{
  for(const query of ['', '?bn2FormalBattleV2=1', '?bn2FormalBattleV2=1&bn2VerificationMode=1&bn2VerificationMode=1', '?bn2FormalBattleV2=1&bn2FormalBattleV2=0&bn2VerificationMode=1', '?bn2FormalBattleV2=true&bn2VerificationMode=1', '?bn2FormalBattleV2=01&bn2VerificationMode=1', '?bn2FormalBattleV2=%201&bn2VerificationMode=1', '?bn2FormalBattleV2=&bn2VerificationMode=1']) assert.equal(entry.selectVerification(query),false);
});
test('script loads wait for each onload and preserve approved order',async()=>{
  const paths=[],document={createElement:()=>({}),head:{appendChild:script=>{paths.push(script.src);}}};
  let script;
  document.head.appendChild=item=>{script=item;paths.push(item.src);};
  const loading=entry.loadSequential(document,['one','two','three']);
  assert.deepEqual(paths,['one']);script.onload();await Promise.resolve();
  assert.deepEqual(paths,['one','two']);script.onload();await Promise.resolve();
  assert.deepEqual(paths,['one','two','three']);script.onload();await loading;
});
test('load failure stops before remaining scripts',async()=>{
  const paths=[];const document={createElement:()=>({}),head:{appendChild:script=>{paths.push(script.src);script.onerror();}}};
  await assert.rejects(entry.loadSequential(document,['one','two']),error=>error.code==='SCRIPT_LOAD_FAILED');assert.deepEqual(paths,['one']);
});
test('legacy mode loads exactly the original five runtime scripts',async()=>{
  const {env,host,old}=environment();env.location.search='?bn2FormalBattleV2=1';const paths=[];
  env.document.head.appendChild=script=>{paths.push(script.src);script.onload();};
  assert.equal((await entry.start(env)).mode,'legacy');assert.deepEqual(paths,entry.LEGACY_SCRIPTS);assert.equal(old.hidden,false);assert.equal(host.hidden,true);assert.equal(env.sessionStorage.map.size,0);
});
test('verification selection never loads old runtime and mounts outside retained g',async()=>{
  const {env,host,old}=environment();const paths=[];env.document.head.appendChild=script=>{paths.push(script.src);script.onload();};
  const result=await entry.start(env,{wait:()=>Promise.resolve()});assert.equal(result.mode,'verification');assert.deepEqual(paths,entry.V2_SCRIPTS);
  assert.equal(old.parentNode,env.document.body);assert.equal(old.hidden,true);assert.equal(old.inert,true);assert.equal(host.parentNode,env.document.body);assert.equal(host.hidden,false);assert.equal(host.inert,false);assert.ok(host.querySelector('.bn2-shell'));
});
test('verification failure never appends legacy runtime',async()=>{
  const {env,old,host}=environment();const paths=[];env.document.head.appendChild=script=>{paths.push(script.src);script.onerror();};
  const result=await entry.start(env);assert.equal(result.mode,'verification-stop');assert.deepEqual(paths,[entry.V2_SCRIPTS[0]]);assert.equal(old.hidden,true);
  assert.equal(old.inert,true);assert.equal(host.hidden,true);assert.equal(host.inert,true);
});
test('all 19 loads and Bootstrap keep host hidden and inert until safe initial render',async()=>{
  const {env,host,old}=environment();const paths=[];let pendingScript;
  env.document.head.appendChild=script=>{pendingScript=script;paths.push(script.src);assert.equal(host.hidden,true);assert.equal(host.inert,true);assert.equal(old.hidden,true);assert.equal(old.inert,true);};
  let bootCalls=0;
  env.BOUKEN_NOTE_V2={...v2,formalBattleBootstrap:{...v2.formalBattleBootstrap,start:options=>{bootCalls++;assert.equal(host.hidden,true);assert.equal(host.inert,true);return v2.formalBattleBootstrap.start(options);}}};
  const running=entry.start(env);assert.equal(host.hidden,true);assert.equal(host.inert,true);
  for(let i=0;i<19;i++){assert.equal(paths.length,i+1);pendingScript.onload();await Promise.resolve();}
  const result=await running;assert.equal(result.mode,'verification');assert.equal(bootCalls,1);assert.equal(host.hidden,false);assert.equal(host.inert,false);assert.equal(result.instance.ui.registry.attack.disabled,false);
});
test('CSS missing, forced load failure, disabled and empty sheets stop before V2 or legacy load',async()=>{
  for(const failure of ['missing','failed','disabled','empty','inaccessible']){
    const {env,host,old}=environment();const css=env.document.getElementById('bn2-verification-css');
    if(failure==='missing')env.document.head.removeChild(css);
    if(failure==='failed')css.sheet=null;
    if(failure==='disabled')css.disabled=true;
    if(failure==='empty')css.sheet.cssRules=[];
    if(failure==='inaccessible')Object.defineProperty(css.sheet,'cssRules',{get(){throw new Error('unreadable');}});
    const paths=[];env.document.head.appendChild=script=>{paths.push(script.src);script.onload();};
    const before=[...env.localStorage.map];const result=await entry.start(env);
    assert.equal(result.mode,'verification-stop');assert.equal(result.reason,'V2_CSS_LOAD_FAILED');assert.deepEqual(paths,[]);
    assert.equal(host.hidden,true);assert.equal(host.inert,true);assert.equal(old.hidden,true);assert.equal(old.inert,true);assert.equal(env.sessionStorage.map.size,0);assert.deepEqual([...env.localStorage.map],before);
    assert.ok(walk(env.document.body).some(node=>node.attributes.role==='alert'&&node.textContent.includes('V2_CSS_LOAD_FAILED')));
  }
});
test('legacy selection is unaffected by a failed V2 stylesheet and keeps V2 inert',async()=>{
  const {env,host,old}=environment();env.location.search='';env.document.getElementById('bn2-verification-css').sheet=null;
  const paths=[];env.document.head.appendChild=script=>{paths.push(script.src);script.onload();};
  assert.equal((await entry.start(env)).mode,'legacy');assert.deepEqual(paths,entry.LEGACY_SCRIPTS);assert.equal(host.hidden,true);assert.equal(host.inert,true);assert.equal(old.hidden,false);assert.equal(old.inert,false);
});
test('namespace adapter maps only three keys and preserves existing backup bytes',()=>{
  const storage=memory();const keys=v2.saveRepository.KEYS;storage.setItem('bn2:verification:test:'+keys.backup,' exact bytes ');
  const isolated=entry.isolatedStorage(storage,keys,'test');isolated.adapter.setItem(keys.state,'state');
  assert.equal(storage.getItem(keys.state),null);assert.equal(storage.getItem('bn2:verification:test:'+keys.state),'state');assert.equal(isolated.adapter.getItem(keys.backup),' exact bytes ');
  assert.throws(()=>isolated.adapter.setItem('other','x'),error=>error.code==='UNKNOWN_VERIFICATION_KEY');
});
test('unavailable or non-writing sessionStorage stops with no localStorage fallback',()=>{
  assert.throws(()=>entry.isolatedStorage(null,v2.saveRepository.KEYS,'test'));
  assert.throws(()=>entry.isolatedStorage({getItem:()=>null,setItem:()=>{},removeItem:()=>{}},v2.saveRepository.KEYS,'test'),error=>error.code==='STORAGE_VERIFY_FAILED');
  const {env}=environment();env.sessionStorage={getItem:()=>{throw new Error('blocked');}};assert.throws(()=>entry.bootVerification(env));assert.equal(env.localStorage.map.size,0);
});
test('fresh verification is labelled fixture and all saved flags remain false',()=>{
  const {env,host}=environment();const instance=entry.bootVerification(env);assert.equal(instance.ui.registry.attack.disabled,false);
  assert.ok(walk(host).some(node=>node.textContent.includes('正式初期Stateではありません')));
  assert.equal(instance.repository.loadState().state.featureFlags.formalBattleV2,false);assert.equal(env.localStorage.map.size,0);
  assert.ok([...env.sessionStorage.map.keys()].every(key=>key.startsWith('bn2:verification:phase-g-daily-only:')));
});
test('legacy raw copy migration leaves both production save bytes unchanged and ATTACK disabled',()=>{
  const {env}=environment();const raw=' {"coin":7,"weeklyHP":4000} ';
  env.localStorage.setItem(v2.saveMigration.LEGACY_KEY,raw);env.localStorage.setItem(v2.saveRepository.KEYS.state,'production-v2-bytes');
  const before=[...env.localStorage.map];const instance=entry.bootVerification(env);
  assert.equal(instance.ui.registry.attack.disabled,true);assert.deepEqual([...env.localStorage.map],before);assert.equal(instance.repository.loadState().state.featureFlags.formalBattleV2,false);
  assert.ok([...env.sessionStorage.map.keys()].every(key=>key.startsWith('bn2:verification:legacy-migration:')));
});
test('invalid legacy migration stops without creating State',()=>{
  const {env}=environment();env.localStorage.setItem(v2.saveMigration.LEGACY_KEY,'{broken');assert.throws(()=>entry.bootVerification(env));assert.equal(env.sessionStorage.map.size,0);
});
test('needs-resolution is an explicit boot stop even if schema accepts State',()=>{
  const state=entry.fixtureState(v2);state.migration.status='needs-resolution';assert.equal(v2.schema.validateState(state).ok,true);assert.throws(()=>entry.bootGate(v2,state,defs),error=>error.code==='NEEDS_RESOLUTION');
});
test('ATTACK gate accepts only approved Daily-only fixture request',()=>{
  assert.equal(gate().ok,true);assert.equal(gate({fixture:false}).reason,'GENERAL_USER_SPEC_HOLD');
  assert.equal(gate({input:{...entry.FIXTURE_INPUT,dailyResult:3}}).reason,'UNAPPROVED_FIXTURE_REQUEST');
});
test('ATTACK gate rejects invalid input and seed before controller invocation',()=>{
  assert.equal(gate({input:{}}).reason,'INVALID_INPUT');assert.equal(gate({seed:''}).ok,false);assert.equal(gate({seed:NaN}).ok,false);
});
test('Weekly and Area Boss missing skill profiles fail closed',()=>{
  for(const kind of ['weekly','areaBoss']) {
    const state=entry.fixtureState(v2);const enemy=state.enemiesById[state.enemyOrder[0]];enemy.kind=kind;enemy.definitionId=kind==='weekly'?'weekly_base':'area_boss_base';
    assert.equal(gate({state}).reason,'UNCONFIGURED_ENEMY_ACTION');
  }
  const state=entry.fixtureState(v2);const enemy=state.enemiesById[state.enemyOrder[0]];enemy.kind='weekly';enemy.definitionId='weekly_base';
  const changed={...defs,enemies:{...defs.enemies,enemies:{...defs.enemies.enemies,weekly_base:{...defs.enemies.enemies.weekly_base,skillProfileId:'missing'}}}};
  assert.equal(gate({state,defs:changed}).reason,'UNCONFIGURED_ENEMY_ACTION');
});
test('pending, storage faults and inconsistent State all close ATTACK',()=>{
  assert.equal(gate({locked:true}).reason,'PENDING_NOT_RECOVERED');
  assert.equal(gate({checkWritable:()=>{throw Object.assign(new Error(),{code:'STORAGE_WRITE_FAILED'});}}).reason,'STORAGE_WRITE_FAILED');
  const state=entry.fixtureState(v2);state.featureFlags.formalBattleV2=true;assert.equal(gate({state}).reason,'INVALID_STATE');
  const broken=entry.fixtureState(v2);broken.charactersById.aria.hp=99999;assert.equal(gate({state:broken}).reason,'INVALID_SNAPSHOT');
});
test('Daily-only ATTACK commits V2 save once and keeps production V2 bytes unchanged',async()=>{
  const {env}=environment();env.localStorage.setItem(v2.saveRepository.KEYS.state,'untouched');
  const instance=entry.bootVerification(env,{wait:()=>Promise.resolve()});instance.attack();instance.attack();
  for(let i=0;i<100;i++) await Promise.resolve();
  assert.equal(instance.repository.loadPending(),null);assert.equal(instance.ui.registry.attack.disabled,true);
  const final=JSON.stringify(instance.repository.loadState().state);instance.attack();await Promise.resolve();assert.equal(JSON.stringify(instance.repository.loadState().state),final);
  assert.equal(env.localStorage.getItem(v2.saveRepository.KEYS.state),'untouched');assert.equal(instance.repository.loadState().state.featureFlags.formalBattleV2,false);
});
test('skip commits the same approved final snapshot while cancelling replay',async()=>{
  const {env,host}=environment();let release;const instance=entry.bootVerification(env,{wait:()=>new Promise(resolve=>{release=resolve;})});
  const expected=v2.battleCalculator.calculateBattle(entry.fixtureState(v2),entry.FIXTURE_INPUT,defs,entry.FIXTURE_SEED).finalSnapshot;
  instance.attack();const skip=walk(host).find(node=>node.textContent==='演出skip');assert.equal(skip.disabled,false);skip.click();
  assert.deepEqual(instance.repository.loadState().state,expected);assert.equal(instance.repository.loadPending(),null);release();await Promise.resolve();
});
test('reload pending recovery uses recover then skip with zero calculator calls and no duplicate commit',()=>{
  const {env}=environment();const initial=entry.fixtureState(v2);const result=v2.battleCalculator.calculateBattle(initial,entry.FIXTURE_INPUT,defs,entry.FIXTURE_SEED);
  const isolated=entry.isolatedStorage(env.sessionStorage,v2.saveRepository.KEYS,'phase-g-daily-only');const repository=v2.saveRepository.create(isolated.adapter);
  repository.saveInitialState(initial);repository.persistPending(v2.saveRepository.createPending(initial,result));
  const noCalculate={...v2,battleCalculator:{...v2.battleCalculator,calculateBattle:()=>{throw new Error('recalculation forbidden');}}};env.BOUKEN_NOTE_V2=noCalculate;
  const instance=entry.bootVerification(env);assert.deepEqual(instance.repository.loadState().state,result.finalSnapshot);assert.equal(instance.repository.loadPending(),null);
  const bytes=isolated.adapter.getItem(v2.saveRepository.KEYS.state);const second=environment();second.env.sessionStorage=env.sessionStorage;second.env.BOUKEN_NOTE_V2=noCalculate;
  entry.bootVerification(second.env);assert.equal(isolated.adapter.getItem(v2.saveRepository.KEYS.state),bytes);
});
test('reload order is Bootstrap, explicit locked initial render, recover, skip, reload, render, gate',async()=>{
  const {env,host}=environment();const initial=entry.fixtureState(v2);const result=v2.battleCalculator.calculateBattle(initial,entry.FIXTURE_INPUT,defs,entry.FIXTURE_SEED);
  const isolated=entry.isolatedStorage(env.sessionStorage,v2.saveRepository.KEYS,'phase-g-daily-only');const repository=v2.saveRepository.create(isolated.adapter);
  repository.saveInitialState(initial);repository.persistPending(v2.saveRepository.createPending(initial,result));
  const trace=[];let skipped=false,calculations=0;
  env.BOUKEN_NOTE_V2={...v2,battleCalculator:{...v2.battleCalculator,calculateBattle:()=>{calculations++;throw new Error('unexpected calculator');}},
    saveRepository:{...v2.saveRepository,create:storage=>{const real=v2.saveRepository.create(storage);return {...real,loadState:()=>{if(skipped)trace.push('reload');return real.loadState();}};}},
    battleController:{...v2.battleController,create:options=>{const real=v2.battleController.create(options);return {...real,recover:()=>{trace.push('recover');assert.equal(host.hidden,true);assert.equal(host.inert,true);return real.recover();}};}},
    formalBattleBootstrap:{...v2.formalBattleBootstrap,start:options=>{trace.push('Bootstrap');const real=v2.formalBattleBootstrap.start(options);return {...real,
      ui:{...real.ui,render:(state,flags)=>{trace.push('locked render');assert.equal(flags.locked,true);assert.equal(host.hidden,true);assert.equal(host.inert,true);real.ui.render(state,flags);},setLocked:value=>{trace.push('gate');real.ui.setLocked(value);}},
      scheduler:{...real.scheduler,skip:()=>{trace.push('skip');const final=real.scheduler.skip();skipped=true;return final;}}};}}};
  env.document.head.appendChild=script=>script.onload();
  const started=await entry.start(env);assert.equal(started.mode,'verification');assert.deepEqual(trace,['Bootstrap','locked render','recover','skip','reload','locked render','gate']);
  assert.equal(calculations,0);assert.deepEqual(started.instance.repository.loadState().state,result.finalSnapshot);assert.equal(host.hidden,false);assert.equal(host.inert,false);
});
test('actual Repository STATE_CONFLICT stops reload without recalculation, fallback or production writes',async()=>{
  const {env,host,old}=environment();env.localStorage.setItem(v2.saveMigration.LEGACY_KEY,' {\"coin\":20,\"weeklyHP\":0} ');env.localStorage.setItem(v2.saveRepository.KEYS.state,'production-v2-bytes');
  const initial=entry.fixtureState(v2);const result=v2.battleCalculator.calculateBattle(initial,entry.FIXTURE_INPUT,defs,entry.FIXTURE_SEED);
  const isolated=entry.isolatedStorage(env.sessionStorage,v2.saveRepository.KEYS,'legacy-migration');const repository=v2.saveRepository.create(isolated.adapter);
  repository.saveInitialState(initial);repository.persistPending(v2.saveRepository.createPending(initial,result));
  const conflicting=v2.battleEvents.safeClone(initial,'$',0);conflicting.profile.points+=1;
  isolated.adapter.setItem(v2.saveRepository.KEYS.state,JSON.stringify(conflicting));
  const productionBefore=[...env.localStorage.map],sessionBefore=[...env.sessionStorage.map];let calculations=0;
  env.BOUKEN_NOTE_V2={...v2,battleCalculator:{...v2.battleCalculator,calculateBattle:()=>{calculations++;throw new Error('unexpected calculator');}}};
  const paths=[];env.document.head.appendChild=script=>{paths.push(script.src);script.onload();};
  const stopped=await entry.start(env);assert.equal(stopped.mode,'verification-stop');assert.equal(stopped.reason,'STATE_CONFLICT');assert.equal(calculations,0);
  assert.deepEqual(paths,entry.V2_SCRIPTS);assert.deepEqual([...env.localStorage.map],productionBefore);assert.deepEqual([...env.sessionStorage.map],sessionBefore);
  assert.equal(host.hidden,true);assert.equal(host.inert,true);assert.equal(old.hidden,true);assert.equal(old.inert,true);assert.equal(host.querySelector('.bn2-attack-button').disabled,true);
  assert.ok(walk(env.document.body).some(node=>node.attributes.role==='alert'&&node.textContent.includes('STATE_CONFLICT')));
});
test('rollback selects legacy from reload and preserves isolated pending bytes',async()=>{
  const {env}=environment();const isolated=entry.isolatedStorage(env.sessionStorage,v2.saveRepository.KEYS,'phase-g-daily-only');isolated.adapter.setItem(v2.saveRepository.KEYS.pending,'preserved-pending');
  env.location.search='';const paths=[];env.document.head.appendChild=script=>{paths.push(script.src);script.onload();};await entry.start(env);
  assert.deepEqual(paths,entry.LEGACY_SCRIPTS);assert.equal(isolated.adapter.getItem(v2.saveRepository.KEYS.pending),'preserved-pending');
});
test('candidate assets are absent in production verification',()=>{
  const {env,host}=environment();entry.bootVerification(env);assert.equal(walk(host).some(node=>node.tagName==='IMG'),false);
});
test('index retains legacy DOM, independent host and correct CSS and entry ordering',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');assert.ok(source.indexOf('css/game.css')<source.indexOf('css/formal-battle-ui-v2.css'));
  assert.ok(source.includes('<main id="g">'));assert.match(source,/<\/main>\s*<main id="bn2-verification-host"[^>]*hidden inert><\/main>\s*<\/body>/);
  assert.match(source,/<link id="bn2-verification-css"[^>]*href="css\/formal-battle-ui-v2.css"/);
  for(const file of entry.LEGACY_SCRIPTS) assert.equal(source.includes('src="'+file+'"'),false);
  assert.ok(source.indexOf('data/areas.js')<source.indexOf('js/v2/production-verification-entry.js'));
});
(async()=>{
  let passed=0;for(const [name,fn] of tests) {try {await fn();passed++;process.stdout.write('ok - connection: '+name+'\n');} catch(error) {process.exitCode=1;process.stderr.write('not ok - connection: '+name+'\n'+error.stack+'\n');}}
  process.stdout.write('# '+passed+'/'+tests.length+' production verification connection tests passed\n');
})();
