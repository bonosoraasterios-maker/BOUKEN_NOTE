'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = require('../../js/v2/formal-battle-ui.js');
const bootstrap = require('../../js/v2/formal-battle-bootstrap.js');
const characters = require('../../data/v2/characters.js').characters;
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}\n${error.stack}\n`); process.exitCode = 1; }
}
class FakeNode {
  constructor(tag) { this.tagName=tag.toUpperCase(); this.children=[]; this.attributes={}; this.style={}; this.listeners={}; this.parentNode=null; this.className=''; this.textContent=''; this.disabled=false; }
  appendChild(node) { node.parentNode=this; this.children.push(node); return node; }
  removeChild(node) { this.children.splice(this.children.indexOf(node),1); node.parentNode=null; return node; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(name,value) { this.attributes[name]=String(value); }
  addEventListener(type,fn) { this.listeners[type]=fn; }
  click() { if (!this.disabled && this.listeners.click) this.listeners.click(); }
}
const document = { createElement:tag => new FakeNode(tag) };
function walk(node) { return [node].concat(node.children.flatMap(walk)); }
function byAttr(root,name,value) { return walk(root).filter(node => Object.hasOwn(node.attributes,name) && (value===undefined || node.attributes[name]===value)); }
function state(overrides) {
  const base={partySlots:{protagonist:{characterId:'sora'},supporter:{characterId:'aria'},defender:{characterId:'ceres'},attacker:{characterId:'linnet'}},charactersById:{
    sora:{characterId:'sora',hp:null,sp:null,barrier:0,statusIds:[],resources:{}},
    aria:{characterId:'aria',hp:600,sp:3,barrier:0,statusIds:['poison'],resources:{}},
    ceres:{characterId:'ceres',hp:1000,sp:2,barrier:200,statusIds:[],resources:{}},
    linnet:{characterId:'linnet',hp:400,sp:1,barrier:0,statusIds:[],resources:{tameRoster:2}}
  },enemyOrder:['boss','d1','d2','d3','d4'],enemiesById:{
    boss:{instanceId:'boss',definitionId:'boss-placeholder',kind:'weekly',hp:2800,maxHp:3000,barrier:300,statusIds:[]},
    d1:{instanceId:'d1',definitionId:'daily-placeholder',kind:'daily',hp:800,maxHp:800,barrier:0,statusIds:[]},
    d2:{instanceId:'d2',definitionId:'daily-placeholder',kind:'daily',hp:800,maxHp:800,barrier:0,statusIds:[]},
    d3:{instanceId:'d3',definitionId:'daily-placeholder',kind:'daily',hp:800,maxHp:800,barrier:0,statusIds:[]},
    d4:{instanceId:'d4',definitionId:'daily-placeholder',kind:'daily',hp:800,maxHp:800,barrier:0,statusIds:[]}
  }};
  return Object.assign(base,overrides || {});
}
function setup(snapshot) { const host=new FakeNode('main'); const instance=ui.create({document,host,definitions:characters}); instance.render(snapshot || state(),{locked:false}); return {host,instance}; }

test('feature flag defaults off and requires explicit verification mode',()=>{
  assert.equal(ui.DEFAULT_FLAGS.formalBattleV2,false);
  assert.equal(bootstrap.DEFAULT_CONFIG.formalBattleV2,false);
  assert.equal(ui.shouldEnable({formalBattleV2:true},false),false);
  assert.equal(ui.mountIfEnabled({document,host:new FakeNode('main'),featureFlags:{formalBattleV2:false},verificationMode:true}),null);
  assert.equal(bootstrap.start({document,host:new FakeNode('main')}),null);
});
test('formal shell contains three routes, four role HUD cards, ATTACK and fixed ad slot',()=>{
  const {instance}=setup();
  assert.equal(byAttr(instance.root,'data-bn2-route').length,3);
  assert.equal(byAttr(instance.root,'data-bn2-hud-role').length,4);
  assert.equal(instance.registry.attack.tagName,'BUTTON');
  assert.equal(byAttr(instance.root,'data-bn2-ad-slot','placeholder').length,1);
});
test('Sora has no HP or SP and Elliott has no empty SP component',()=>{
  const x=state(); x.partySlots.supporter.characterId='elliott'; x.charactersById.elliott={characterId:'elliott',hp:700,sp:null,barrier:0,statusIds:[],resources:{pendingAttackerHits:0}};
  const {instance}=setup(x);
  assert.equal(byAttr(instance.registry['hud-protagonist'],'data-bn2-vital-gauge').length,0);
  assert.equal(byAttr(instance.registry['hud-protagonist'],'data-bn2-sp').length,0);
  assert.equal(byAttr(instance.registry['hud-supporter'],'data-bn2-sp').length,0);
  assert.equal(byAttr(instance.registry['hud-defender'],'data-bn2-sp').length,1);
});
test('resource mount, six formal status slots and common HP Barrier gauge exist',()=>{
  const {instance}=setup();
  assert.equal(byAttr(instance.registry['hud-attacker'],'data-bn2-resource-mount','linnet').length,1);
  assert.equal(byAttr(instance.registry['hud-supporter'],'data-bn2-status').length,6);
  assert.equal(byAttr(instance.registry.enemies,'data-bn2-vital-gauge').length,5);
});
test('boss plus four Daily enemies is accepted and a sixth enemy is rejected',()=>{
  assert.equal(byAttr(setup().instance.registry.enemies,'data-bn2-enemy-kind').length,5);
  const x=state(); x.enemyOrder.push('d5'); x.enemiesById.d5={instanceId:'d5',definitionId:'daily-placeholder',kind:'daily',hp:800,maxHp:800,barrier:0,statusIds:[]};
  assert.throws(()=>setup(x),RangeError);
});
test('locked controller state disables ATTACK and unlocked click delegates once',()=>{
  let calls=0; const host=new FakeNode('main'); const instance=ui.create({document,host,definitions:characters,onAttack:()=>{calls+=1;}});
  instance.render(state(),{locked:true}); instance.registry.attack.click(); assert.equal(calls,0);
  instance.setLocked(false); instance.registry.attack.click(); assert.equal(calls,1);
});
test('event player presentation inlet renders its supplied snapshot only',()=>{
  const {instance}=setup(); const next=state(); next.charactersById.aria.hp=321;
  instance.present({event:{type:'DAMAGE'},snapshot:next,index:0});
  assert.equal(instance.registry.eventMount.textContent,'DAMAGE');
  assert.equal(instance.registry.attack.disabled,true);
});
test('placeholder asset keys are replaceable and unsafe keys are not assigned',()=>{
  const {instance}=setup();
  assert.ok(byAttr(instance.root,'data-bn2-asset-key','boss-placeholder').length>0);
  const x=state(); x.enemiesById.boss.definitionId='javascript:alert(1)';
  const unsafe=setup(x).instance; assert.equal(byAttr(unsafe.root,'data-bn2-asset-key','javascript:alert(1)').length,0);
});
test('source uses bn2 namespace, no legacy selectors, unsafe HTML, network, or dependency',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../../js/v2/formal-battle-ui.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../../css/formal-battle-ui-v2.css'),'utf8');
  assert.equal(/innerHTML|insertAdjacentHTML|outerHTML/.test(js),false);
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|eval\s*\(|new\s+Function/.test(js),false);
  assert.equal(/(?:^|[\s,{])\.(?:daily|weekly|special|characterCard)(?:[\s,{:#.]|$)|#partyParts|#dailyFormation/m.test(`${js}\n${css}`),false);
  assert.equal(/\.bn2-shell\s*\{[^}]*overflow:\s*hidden/s.test(css),true);
  assert.equal(/min-width:\s*44px[^}]*min-height:\s*44px/s.test(css),true);
  assert.equal(fs.existsSync(path.join(__dirname,'../../package-lock.json')),false);
});

process.on('exit',()=>{ if(!process.exitCode) process.stdout.write(`# ${passed} Phase D tests passed\n`); });
