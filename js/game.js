(()=>{
const KEY='bouken_note_v23_20_battle_system';
const MAX_DAILY=800, MAX_WEEKLY=4000;
// v1.2 character registry. Visual parts are rendered from these data objects.
const CHARACTER_DEFS=Object.freeze({
  aria:Object.freeze({
    characterId:'aria',name:'アリア',classId:'support',classLabel:'サポーター',jobId:'cleric',jobLabel:'クレリック',maxHp:600,
    potentialAbility:Object.freeze({id:'healing_light',name:'癒しの光',icon:'✦'}),
    skill:Object.freeze({id:'heal',name:'ヒール',icon:'＋',spCost:1}),
    selected:true,leader:false,art:"images/characters/aria.webp"
  }),
  ceres:Object.freeze({
    characterId:'ceres',name:'セレス',classId:'defender',classLabel:'ディフェンダー',jobId:'guardian',jobLabel:'ガーディアン',maxHp:1200,
    potentialAbility:Object.freeze({id:'holy_guard',name:'ホーリーガード',icon:'◆'}),
    skill:Object.freeze({id:'holy_field',name:'ホーリーフィールド',icon:'盾',spCost:1}),
    selected:true,leader:false,art:"images/characters/ceres.webp"
  }),
  linette:Object.freeze({
    characterId:'linette',name:'リネット',classId:'attacker',classLabel:'アタッカー',jobId:'tamer',jobLabel:'テイマー',maxHp:400,
    potentialAbility:Object.freeze({id:'tame',name:'テイム',icon:'◇'}),
    skill:Object.freeze({id:'tame_guard',name:'テイムガード',icon:'守',spCost:1}),
    selected:true,leader:false,art:"images/characters/linnet.webp"
  })
});
const PARTY_CLASS_ORDER=Object.freeze(['support','defender','attacker']);
// Fixed to the current three allies only for this first migration checkpoint.
// Later character-selection UI will update these IDs without rebuilding the card markup.
const SELECTED_CHARACTER_IDS=['aria','ceres','linette'];
const selectedCharacters=()=>SELECTED_CHARACTER_IDS.map(id=>CHARACTER_DEFS[id]).filter(Boolean);
const MAX_HP=selectedCharacters().map(c=>c.maxHp);
const MAX_DAILY_STACK=7, MAX_MAGIC_SP=5, MAX_TAME_SP=5, MAX_BEAST_HP=200;
const BASE_ENEMY_DMG=100;
const ALLY_DMG=100, TAME_DMG=50, UNION_DMG=100;
const DAILY_ENEMY_ART="images/enemies/daily_enemy.webp";
const DAILY_REWARD=50, WEEKLY_REWARD=100, WEEKLY_BOSS_BONUS=10;

const MAX_WARRIOR_SP=5;
function preemptChance(){
  const n=Math.max(0,Math.min(3,S.battlePts||0));
  return [0,50,80,100][n];
}
function tameCount(){return (S.beast&&S.beast.hp>0?1:0)+(Array.isArray(S.beastQueue)?S.beastQueue.length:0)}
function advanceTamedBeast(){
  if(S.beast&&S.beast.hp>0)return S.beast;
  if(Array.isArray(S.beastQueue)&&S.beastQueue.length){S.beast=S.beastQueue.shift();return S.beast;}
  S.beast=null;return null;
}
function tryPassiveTame(){
  if(tameCount()>=5){log('テイム枠は満杯（5/5）。');return false;}
  const newBeast={name:'アストラル・セントリー',hp:MAX_BEAST_HP};
  if(S.beast&&S.beast.hp>0)S.beastQueue.push(newBeast);
  else S.beast=newBeast;
  toast('パッシブ・テイム！ HP200のテイムエネミーが加入');
  log('リネットのテイム発動。テイム枠 '+tameCount()+'/5。');
  save();
  if(!unionVisualLock)render();
  return true;
}

const FIXED_NOW=null;
const now=()=>FIXED_NOW?new Date(FIXED_NOW.getTime()):new Date();
const fmtDay=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseDay=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const dayKey=()=>fmtDay(now());
const weekKeyMonday=(base=now())=>{const d=new Date(base.getFullYear(),base.getMonth(),base.getDate());const shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);return fmtDay(d)};
const daysBetween=(a,b)=>Math.max(0,Math.round((parseDay(b)-parseDay(a))/86400000));
const maxHpOf=i=>selectedCharacters()[i]?.maxHp||MAX_HP[i]||0;
const tameRateMap={1:10,2:20,3:30,4:40,5:100};
const allyNames=selectedCharacters().map(c=>c.jobLabel);
const memberNames=selectedCharacters().map(c=>c.name);
const DAILY_ENEMY_NAME='アストラル・セントリー';
const WEEKLY_ENEMY_NAME='虚空統べるセレスティア';

const UI_KEY='bouken_note_v23_20_ui_texts';
const DEFAULT_UI={
  daily:['5つのお約束','時間を守る','フリー（自分で決めたこと）'],
  weekly:['本を1冊読む','デイリーを5日達成','今週の自分プラン'],
  special:['夏休みの宿題を終わらせる','最高を1日分ためる','家族でおでかけした日に！'],
  shop:[
    {name:'新しい洋服',cost:1000},
    {name:'ゲームソフト',cost:2000},
    {name:'好きな本',cost:800},
    {name:'家族チケット',cost:1500}
  ]
};
const deepClone=o=>JSON.parse(JSON.stringify(o));
function normalizeUI(raw){
  const base=deepClone(DEFAULT_UI);
  if(raw&&typeof raw==='object'){
    ['daily','weekly','special'].forEach(k=>{
      if(Array.isArray(raw[k]))for(let i=0;i<3;i++)base[k][i]=String(raw[k][i]??base[k][i]).trim()||base[k][i];
    });
    if(Array.isArray(raw.shop))for(let i=0;i<4;i++){
      const src=raw.shop[i]||{};
      base.shop[i]={
        name:String(src.name??base.shop[i].name).trim()||base.shop[i].name,
        cost:Math.max(0,Number(src.cost??base.shop[i].cost)||0)
      };
    }
  }
  return base;
}
let U;
try{U=normalizeUI(JSON.parse(localStorage.getItem(UI_KEY)||'null'))}catch(e){U=deepClone(DEFAULT_UI)}
const saveUI=()=>{try{localStorage.setItem(UI_KEY,JSON.stringify(U))}catch(e){}};
const fmtCost=v=>Math.max(0,Number(v)||0).toLocaleString();
function syncUIEditor(){
  ['daily','weekly','special'].forEach(k=>{
    for(let i=0;i<3;i++){
      const el=$('#ui_'+k+'_'+i);
      if(el)el.value=U[k][i]||'';
    }
  });
  for(let i=0;i<4;i++){
    const n=$('#ui_shop_name_'+i), c=$('#ui_shop_cost_'+i);
    if(n)n.value=U.shop[i].name||'';
    if(c)c.value=String(U.shop[i].cost||0);
  }
}
function readUIEditor(){
  const next=deepClone(DEFAULT_UI);
  ['daily','weekly','special'].forEach(k=>{
    for(let i=0;i<3;i++){
      const el=$('#ui_'+k+'_'+i);
      next[k][i]=(el&&el.value.trim())?el.value.trim():DEFAULT_UI[k][i];
    }
  });
  for(let i=0;i<4;i++){
    const n=$('#ui_shop_name_'+i), c=$('#ui_shop_cost_'+i);
    next.shop[i]={
      name:(n&&n.value.trim())?n.value.trim():DEFAULT_UI.shop[i].name,
      cost:Math.max(0,Number(c&&c.value)||0)
    };
  }
  return next;
}
function renderUIText(){
  for(let i=0;i<3;i++){
    const d=$('#dq'+i+'t'), w=$('#wq'+i+'t'), s=$('#sq'+i+'t');
    if(d)d.textContent=U.daily[i]||'';
    if(w)w.textContent=U.weekly[i]||'';
    if(s)s.textContent=U.special[i]||'';
  }
  for(let i=0;i<4;i++){
    const name=$('#shop'+i+'Name'), cost=$('#shop'+i+'CostText');
    if(name)name.textContent=(i===0?'報酬\n':'')+(U.shop[i].name||'');
    if(cost)cost.textContent=(i===0?'必要ポイント\n':'必要ポイント ')+fmtCost(U.shop[i].cost)+'ポイント';
  }
  $$('.shop button').forEach((b,i)=>{if(U.shop[i])b.dataset.cost=String(U.shop[i].cost||0)});
  const rsn=$('#rewardSingleName'),rsc=$('#rewardSingleCost');
  if(rsn)rsn.textContent=U.shop[0].name||'図鑑';
  if(rsc)rsc.textContent=fmtCost(U.shop[0].cost)+'ポイント';
}
function initUIEditor(){
  syncUIEditor();
  const saveBtn=$('#saveUi'), resetBtn=$('#resetUi');
  if(saveBtn)saveBtn.onclick=()=>{
    U=normalizeUI(readUIEditor());
    saveUI();
    render();
    toast('表示項目を保存しました');
  };
  if(resetBtn)resetBtn.onclick=()=>{
    if(!confirm('表示項目を初期化しますか？'))return;
    U=deepClone(DEFAULT_UI);
    saveUI();
    syncUIEditor();
    render();
    toast('表示項目を初期化しました');
  };
}

const DEF=()=>({
  coin:20,
  dailyEnemies:[{id:1,hp:MAX_DAILY,day:dayKey()}], dailySeq:1,
  weeklyHP:MAX_WEEKLY,
  party:MAX_HP.slice(),
  daily:[0,0,0], weekly:[0,0,0], special:[0,0,0],
  battlePts:0,
  skillSP:0,
  mageSP:0, warriorSP:0, tamerSP:0,
  beast:null, beastQueue:[], tameable:0,
  healUsed:false, rezUsed:false, weeklyBonusClaimed:false, balanceVersion:18,
  bleed:[0,0,0], bleedLastTickDay:'', cureUsedDay:'', weeklyPhaseSkillUsed:false,
  loginDay:dayKey(), enemyDay:dayKey(), weekKey:weekKeyMonday()
});
let S;
try{S=Object.assign(DEF(),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){S=DEF()}
if(!Array.isArray(S.dailyEnemies))S.dailyEnemies=[{id:1,hp:MAX_DAILY,day:dayKey()}];
S.dailyEnemies=S.dailyEnemies.filter(e=>e&&e.hp>0).slice(0,MAX_DAILY_STACK);
if(!Number.isFinite(S.dailySeq))S.dailySeq=S.dailyEnemies.reduce((m,e)=>Math.max(m,+e.id||0),0);
if(S.beast && typeof S.beast==='string')S.beast={name:S.beast,hp:MAX_BEAST_HP};
if(!Array.isArray(S.beastQueue))S.beastQueue=[];
S.beastQueue=S.beastQueue.filter(b=>b&&Number(b.hp)>0).slice(0,4).map(b=>({name:b.name||'アストラル・セントリー',hp:Math.max(1,Math.min(MAX_BEAST_HP,Number(b.hp)||MAX_BEAST_HP))}));
if(S.beast&&Number(S.beast.hp)>0)S.beast={name:S.beast.name||'アストラル・セントリー',hp:Math.max(1,Math.min(MAX_BEAST_HP,Number(S.beast.hp)||MAX_BEAST_HP))}; else S.beast=null;
if(!Number.isFinite(S.tameable))S.tameable=0;
if(!Number.isFinite(S.skillSP))S.skillSP=Math.max(0,Number(S.mageSP)||0,Number(S.warriorSP)||0,Number(S.tamerSP)||0);
S.skillSP=Math.max(0,Math.floor(S.skillSP));
if(!Array.isArray(S.bleed))S.bleed=[0,0,0];
S.bleed=S.bleed.slice(0,3).map(v=>Math.max(0,Math.min(3,Math.floor(Number(v)||0))));
while(S.bleed.length<3)S.bleed.push(0);
if(typeof S.bleedLastTickDay!=='string')S.bleedLastTickDay='';
if(typeof S.cureUsedDay!=='string')S.cureUsedDay='';
if(typeof S.weeklyPhaseSkillUsed!=='boolean')S.weeklyPhaseSkillUsed=false;

// v23.20 balance migration: preserve points / tamed enemies / shared skill points; rebuild combat scale once.
if(S.balanceVersion!==18){
  S.dailyEnemies=(Array.isArray(S.dailyEnemies)&&S.dailyEnemies.length?S.dailyEnemies:[{id:1,day:dayKey()}]).slice(0,MAX_DAILY_STACK).map((e,i)=>({id:+e.id||i+1,hp:MAX_DAILY,day:e.day||dayKey()}));
  S.weeklyHP=MAX_WEEKLY;
  S.weeklyBonusClaimed=false;
  S.weeklyPhaseSkillUsed=false;
  S.bleed=[0,0,0];S.bleedLastTickDay='';S.cureUsedDay='';
  S.beastQueue=Array.isArray(S.beastQueue)?S.beastQueue.slice(0,4).map(b=>({name:(b&&b.name)||'アストラル・セントリー',hp:MAX_BEAST_HP})):[];
  if(S.beast)S.beast={name:S.beast.name||'アストラル・セントリー',hp:MAX_BEAST_HP};
  S.balanceVersion=18;
}

function addDailyEnemy(day){
  if(S.dailyEnemies.length>=MAX_DAILY_STACK)return;
  S.dailySeq=(S.dailySeq||0)+1;
  S.dailyEnemies.push({id:S.dailySeq,hp:MAX_DAILY,day:day||dayKey()});
}
function spawnDatesAfter(fromKey,toKey){
  const diff=daysBetween(fromKey,toKey);
  const d=parseDay(fromKey);
  for(let k=1;k<=diff;k++){d.setDate(d.getDate()+1);addDailyEnemy(fmtDay(d));}
  S.enemyDay=toKey;
}
function mondayDateKey(){return weekKeyMonday(now())}

// Monday weekly rollover.
// Carry over ONLY: points (coin), tamed enemies, shared skill points.
// Reset: missions, enemies/HP, party HP, battle points, battle-use flags and weekly boss bonus state.
if(S.weekKey!==weekKeyMonday()){
  const carryCoin=Math.max(0,Number(S.coin)||0);
  const carrySkillSP=Math.max(0,Math.floor(Number(S.skillSP)||0));
  const carryBeast=(S.beast&&S.beast.hp>0)?{name:S.beast.name,hp:S.beast.hp}:null;
  const carryQueue=Array.isArray(S.beastQueue)?S.beastQueue.filter(b=>b&&b.hp>0).slice(0,4).map(b=>({name:b.name,hp:b.hp})):[];

  S.coin=carryCoin;
  S.skillSP=carrySkillSP;
  S.beast=carryBeast;
  S.beastQueue=carryQueue;

  S.weeklyHP=MAX_WEEKLY;
  S.weekly=[0,0,0];
  S.daily=[0,0,0];
  S.special=[0,0,0];
  S.weeklyBonusClaimed=false;
  S.weeklyPhaseSkillUsed=false;
  S.bleed=[0,0,0];S.bleedLastTickDay='';S.cureUsedDay='';
  S.party=MAX_HP.slice();
  S.bleed=[0,0,0];
  S.bleedLastTickDay='';
  S.cureUsedDay='';
  S.weeklyPhaseSkillUsed=false;
  S.battlePts=0;
  S.healUsed=false;
  S.dailyEnemies=[];
  S.dailySeq=0;
  const mon=mondayDateKey();
  addDailyEnemy(mon);
  S.enemyDay=mon;
  if(mon!==dayKey())spawnDatesAfter(mon,dayKey());
  S.loginDay=dayKey();
  S.weekKey=weekKeyMonday();
}
else if(S.enemyDay!==dayKey()){
  spawnDatesAfter(S.enemyDay||S.loginDay||dayKey(),dayKey());
}

// Daily rollover: missions reset. Bleed is resolved inside the battle phase, once per day,
// after the protagonist's cure step and before Stars Blessing / Starlight Union.
if(S.loginDay!==dayKey()){
  S.daily=[0,0,0];
  S.battlePts=0;
  S.healUsed=false;
  S.cureUsedDay='';
  S.loginDay=dayKey();
}

let busy=false;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function ensureCharacterCards(){
  const layer=$('#partyParts');if(!layer)return;
  const chars=selectedCharacters();
  const key=chars.map(c=>c.characterId).join('|');
  if(layer.dataset.partyKey===key)return;
  layer.dataset.partyKey=key;
  layer.innerHTML=chars.map((c,i)=>`
    <article class="characterCard" data-slot="${i}" data-id="${c.characterId}" data-class="${c.classId}">
      <div class="charHeader">
        <span class="classMark" aria-hidden="true"></span>
        <span class="charTitle"><strong class="charName"></strong><small class="charMeta"></small></span>
      </div>
      <div class="charArtWrap"><img class="charArt" alt=""></div>
      <div class="charHp">
        <div class="charHpLine"><span>HP</span><strong class="charHpText"></strong></div>
        <div class="charHpTrack"><i class="charHpFill"></i></div>
      </div>
      <div class="charAbilities" aria-label="能力">
        <div class="abilitySlot potentialSlot"><span class="abilityIcon"></span><span class="abilityKind">潜在能力</span><strong class="abilityName"></strong></div>
        <div class="abilitySlot skillSlot"><span class="abilityIcon"></span><span class="abilityKind">スキル</span><strong class="abilityName"></strong></div>
      </div>
    </article>`).join('');
}
function renderCharacterCards(){
  ensureCharacterCards();
  const chars=selectedCharacters();
  $$('#partyParts .characterCard').forEach((card,i)=>{
    const c=chars[i];if(!c)return;
    const hp=Math.max(0,Math.min(c.maxHp,Number(S.party[i])||0));
    card.dataset.class=c.classId;
    card.classList.toggle('down',hp<=0);
    const name=card.querySelector('.charName');if(name)name.textContent=c.name;
    const meta=card.querySelector('.charMeta');if(meta)meta.textContent=c.classLabel+' ／ '+c.jobLabel;
    const art=card.querySelector('.charArt');if(art){art.src=c.art;art.alt=c.name+'のグラフィック';}
    const txt=card.querySelector('.charHpText');if(txt)txt.textContent=hp.toLocaleString()+' / '+c.maxHp.toLocaleString();
    const fill=card.querySelector('.charHpFill');if(fill)fill.style.width=(c.maxHp?hp/c.maxHp*100:0)+'%';
    const pIcon=card.querySelector('.potentialSlot .abilityIcon');if(pIcon)pIcon.textContent=c.potentialAbility.icon||'✦';
    const pName=card.querySelector('.potentialSlot .abilityName');if(pName)pName.textContent=c.potentialAbility.name;
    const sIcon=card.querySelector('.skillSlot .abilityIcon');if(sIcon)sIcon.textContent=c.skill.icon||'◇';
    const sName=card.querySelector('.skillSlot .abilityName');if(sName)sName.textContent=c.skill.name;
  });
}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const aliveIndexes=()=>S.party.map((v,i)=>v>0?i:-1).filter(i=>i>=0);
const tameChance=()=>S.skillSP>=1?100:0;
const dailyAlive=()=>S.dailyEnemies.length>0;
const anyEnemyAlive=()=>dailyAlive()||S.weeklyHP>0;
let unionVisualLock=false; // v23.46: keep defeated enemies visible until Union animation fully ends
const weeklySkillName=()=> 'ヴォイドブラッド・スラッシュ';
const protagonistClass=()=> 'ソードマン';
const protagonistCureName=()=> '星晶浄化《ステラ・リリース》';

function hasStatusAilment(i){
  // Current implemented ailment: Bleed.
  // Future ailments should be added here.
  return (S.bleed[i]||0)>0;
}
function clearStatusAilments(i){
  // Stella Release removes ALL implemented status ailments from the target.
  S.bleed[i]=0;
}
const weeklyThreshold=()=>MAX_WEEKLY*.30;
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

function toast(t){const e=$('#toast');e.textContent=t;e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}
function log(t){$('#log').textContent=t}

function flo(t,x,y){const e=document.createElement('div');e.className='float';e.textContent=t;e.style.left=x+'%';e.style.top=y+'%';$('#scene').append(e);setTimeout(()=>e.remove(),950)}
function showActionCall(actor,action,target,effect=''){
  const scene=$('#scene');if(!scene)return;
  let e=scene.querySelector('.actionCall');
  if(!e){e=document.createElement('div');e.className='actionCall';scene.appendChild(e);}
  e.innerHTML='';
  [['acActor',actor],['acAction',action],['acArrow','→'],['acTarget',target]].forEach(([c,t])=>{const s=document.createElement('span');s.className=c;s.textContent=t;e.appendChild(s)});
  if(effect){const s=document.createElement('span');s.className='acEffect';s.textContent=effect;e.appendChild(s);}
  e.classList.remove('show');void e.offsetWidth;e.classList.add('show');
  clearTimeout(showActionCall._t);showActionCall._t=setTimeout(()=>e.classList.remove('show'),850);
}
function rapidDamagePopAtElement(el,text,variant='daily'){
  const scene=$('#scene');if(!scene||!el)return;
  const sr=scene.getBoundingClientRect(),r=el.getBoundingClientRect();
  const d=document.createElement('div');d.className='rapidDamage '+variant;d.textContent=text;
  d.style.left=((r.left+r.width*.5-sr.left)/sr.width*100)+'%';
  d.style.top=((r.top+r.height*.50-sr.top)/sr.height*100)+'%';
  scene.appendChild(d);setTimeout(()=>d.remove(),520);
}
function unionDamageBurst(text,hitIndex=0){
  const union=$('#union');
  if(!union)return;

  // Always put a large damage number on the special-art layer.
  const spots=[
    [22,35,-8],[39,28,5],[57,34,-4],[74,30,7],[31,50,-7],
    [50,47,3],[69,51,-5],[25,65,6],[47,66,-3],[72,64,4]
  ];
  const spot=spots[hitIndex%spots.length];

  const d=document.createElement('div');
  d.className='unionDamageStorm';
  d.textContent=text;
  d.style.left=spot[0]+'%';
  d.style.top=spot[1]+'%';
  d.style.setProperty('--rot',spot[2]+'deg');
  d.style.setProperty('--delay',(hitIndex*0.004)+'s');
  union.appendChild(d);
  setTimeout(()=>d.remove(),760);

  // Also show the hit number so the number of strikes can be counted.
  const c=document.createElement('div');
  c.className='unionHitCounter';
  c.textContent='HIT '+(hitIndex+1);
  c.style.left=(spot[0]+4)+'%';
  c.style.top=(spot[1]+8)+'%';
  union.appendChild(c);
  setTimeout(()=>c.remove(),540);
}
function tameAttackQuota(){
  const c=S.daily.filter(Boolean).length;
  return c<=0?0:(c===1?1:(c===2?3:5));
}
function battleTames(){
  const all=[];
  if(S.beast&&S.beast.hp>0)all.push(S.beast);
  if(Array.isArray(S.beastQueue))all.push(...S.beastQueue.filter(b=>b&&b.hp>0));
  return all.slice(0,Math.min(tameAttackQuota(),all.length));
}

function flash(){$('#flash').classList.remove('go');void $('#flash').offsetWidth;$('#flash').classList.add('go')}
function shake(strength='light'){const e=$('#scene');const cls=strength==='heavy'?'shakeHeavy':'shakeLight';e.classList.remove('shakeLight','shakeHeavy');void e.offsetWidth;e.classList.add(cls);setTimeout(()=>e.classList.remove(cls),strength==='heavy'?390:280)}
function showSE(id,text){const e=$(id);if(!e)return;if(text)e.textContent=text;e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}
function burst(x,y,type='ally'){const e=document.createElement('div');e.className='impactBurst '+type;e.style.left=x+'%';e.style.top=y+'%';$('#scene').append(e);setTimeout(()=>e.remove(),700)}
function enemyPulse(){const s=$('#scene');s.classList.remove('enemyPulse');void s.offsetWidth;s.classList.add('enemyPulse');setTimeout(()=>s.classList.remove('enemyPulse'),380)}
function hitSfx(x,y,text,kind='ally'){const e=document.createElement('div');e.className='hitSfx '+kind+' show';e.textContent=text;e.style.left=x+'%';e.style.top=y+'%';$('#scene').append(e);setTimeout(()=>e.remove(),700)}

const AUDIO={
  slash1:'sounds/se/slash_1.mp4',
  slash2:'sounds/se/slash_2.mp4',
  slash3:'sounds/se/slash_3.mp4',
  enemy:'sounds/se/enemy_attack.wav',
  charge:'sounds/se/charge.wav',
  unionHit:'sounds/se/union_hit.mp4',
  bgmA:'',
  bgmB:'sounds/bgm/battle_bgm.mp4'
};

const slashPool=[new Audio(AUDIO.slash1),new Audio(AUDIO.slash2),new Audio(AUDIO.slash3)];
const enemyPool=[new Audio(AUDIO.enemy),new Audio(AUDIO.enemy)];
const chargeAudio=new Audio(AUDIO.charge);
const unionPool=[new Audio(AUDIO.unionHit),new Audio(AUDIO.unionHit),new Audio(AUDIO.unionHit),new Audio(AUDIO.unionHit),new Audio(AUDIO.unionHit),new Audio(AUDIO.unionHit)];
slashPool.forEach(a=>{a.preload='auto';a.volume=.96});
enemyPool.forEach(a=>{a.preload='auto';a.volume=.92});
chargeAudio.preload='auto';chargeAudio.volume=.80;
unionPool.forEach(a=>{a.preload='auto';a.volume=.96});

function playAudio(a){
  if(!a)return;
  try{a.currentTime=0;a.play().catch(()=>{})}catch(e){}
}


/* ===== v23.13 stronger original SFX ===== */
let __sfxCtx=null;
function sfxCtx(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  if(!__sfxCtx)__sfxCtx=new AC();
  if(__sfxCtx.state==='suspended')__sfxCtx.resume().catch(()=>{});
  return __sfxCtx;
}
function sfxMaster(ctx){
  const comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-18; comp.knee.value=18; comp.ratio.value=5;
  comp.attack.value=.003; comp.release.value=.18;
  const g=ctx.createGain(); g.gain.value=.92;
  comp.connect(g); g.connect(ctx.destination);
  return comp;
}
function sfxEnv(g,t,peak,attack,release){
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(.0001,t);
  g.gain.linearRampToValueAtTime(peak,t+attack);
  g.gain.exponentialRampToValueAtTime(.0001,t+attack+release);
}
function sfxNoise(ctx,dur){
  const b=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*dur)),ctx.sampleRate);
  const d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource();s.buffer=b;return s;
}
function duckBGM(ms=260,level=.12){
  if(!bgmAudio||!bgmEnabled)return;
  try{
    bgmAudio.volume=Math.min(bgmAudio.volume,level);
    clearTimeout(duckBGM._t);
    duckBGM._t=setTimeout(()=>{try{if(bgmAudio)bgmAudio.volume=.40}catch(e){}},ms);
  }catch(e){}
}
function heavySlashSfx(){
  const ctx=sfxCtx();if(!ctx)return;const t=ctx.currentTime,out=sfxMaster(ctx);
  duckBGM(330,.06);

  // Main whoosh: brighter and longer for a clearer "ザシュッ"
  const n1=sfxNoise(ctx,.20),hp1=ctx.createBiquadFilter(),lp1=ctx.createBiquadFilter(),g1=ctx.createGain();
  hp1.type='highpass';hp1.frequency.value=1400;lp1.type='lowpass';lp1.frequency.value=9000;
  sfxEnv(g1,t,.42,.001,.16);n1.connect(hp1);hp1.connect(lp1);lp1.connect(g1);g1.connect(out);n1.start(t);n1.stop(t+.20);

  // Secondary trailing whoosh
  const n2=sfxNoise(ctx,.16),bp2=ctx.createBiquadFilter(),g2=ctx.createGain();
  bp2.type='bandpass';bp2.frequency.value=2400;bp2.Q.value=.6;
  sfxEnv(g2,t+.028,.18,.001,.11);n2.connect(bp2);bp2.connect(g2);g2.connect(out);n2.start(t+.028);n2.stop(t+.18);

  // Sharp metallic sweep
  const o1=ctx.createOscillator(),og1=ctx.createGain();
  o1.type='sawtooth';o1.frequency.setValueAtTime(3600,t);o1.frequency.exponentialRampToValueAtTime(210,t+.095);
  sfxEnv(og1,t,.24,.001,.095);o1.connect(og1);og1.connect(out);o1.start(t);o1.stop(t+.11);

  // Extra transient crack
  const crack=ctx.createOscillator(),cg=ctx.createGain();
  crack.type='square';crack.frequency.setValueAtTime(900,t+.01);crack.frequency.exponentialRampToValueAtTime(180,t+.05);
  sfxEnv(cg,t+.01,.09,.001,.05);crack.connect(cg);cg.connect(out);crack.start(t+.01);crack.stop(t+.065);

  // Blade ring harmonics
  [880,1320,1820].forEach((f,i)=>{
    const r=ctx.createOscillator(),rg=ctx.createGain();
    r.type='triangle';r.frequency.value=f;
    sfxEnv(rg,t+.034,.07/(i+1),.001,.18+i*.04);
    r.connect(rg);rg.connect(out);r.start(t+.034);r.stop(t+.30);
  });

  // Body impact
  const sub=ctx.createOscillator(),sg=ctx.createGain();
  sub.type='sine';sub.frequency.setValueAtTime(135,t+.05);sub.frequency.exponentialRampToValueAtTime(44,t+.19);
  sfxEnv(sg,t+.05,.38,.002,.18);sub.connect(sg);sg.connect(out);sub.start(t+.05);sub.stop(t+.23);
}
function heavyHitSfx(){
  const ctx=sfxCtx();if(!ctx)return;const t=ctx.currentTime,out=sfxMaster(ctx);
  duckBGM(340,.07);

  const n=sfxNoise(ctx,.22),bp=ctx.createBiquadFilter(),ng=ctx.createGain();
  bp.type='bandpass';bp.frequency.value=760;bp.Q.value=.72;
  sfxEnv(ng,t,.36,.001,.18);n.connect(bp);bp.connect(ng);ng.connect(out);n.start(t);n.stop(t+.23);

  const sub=ctx.createOscillator(),sg=ctx.createGain();
  sub.type='sine';sub.frequency.setValueAtTime(92,t);sub.frequency.exponentialRampToValueAtTime(34,t+.21);
  sfxEnv(sg,t,.46,.002,.22);sub.connect(sg);sg.connect(out);sub.start(t);sub.stop(t+.24);

  const crack=ctx.createOscillator(),cg=ctx.createGain();
  crack.type='square';crack.frequency.setValueAtTime(470,t);crack.frequency.exponentialRampToValueAtTime(125,t+.055);
  sfxEnv(cg,t,.10,.001,.06);crack.connect(cg);cg.connect(out);crack.start(t);crack.stop(t+.07);
}
function heavyUnionSfx(){
  const ctx=sfxCtx();if(!ctx)return;const t=ctx.currentTime,out=sfxMaster(ctx);
  duckBGM(520,.05);

  // bright energy cut
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(1800,t);o.frequency.exponentialRampToValueAtTime(150,t+.16);
  sfxEnv(g,t,.22,.002,.17);o.connect(g);g.connect(out);o.start(t);o.stop(t+.19);

  // huge sub impact
  const sub=ctx.createOscillator(),sg=ctx.createGain();
  sub.type='sine';sub.frequency.setValueAtTime(105,t+.025);sub.frequency.exponentialRampToValueAtTime(30,t+.28);
  sfxEnv(sg,t+.025,.55,.002,.29);sub.connect(sg);sg.connect(out);sub.start(t+.025);sub.stop(t+.33);

  const n=sfxNoise(ctx,.26),lp=ctx.createBiquadFilter(),ng=ctx.createGain();
  lp.type='lowpass';lp.frequency.value=2500;sfxEnv(ng,t+.02,.30,.002,.23);
  n.connect(lp);lp.connect(ng);ng.connect(out);n.start(t+.02);n.stop(t+.29);
}




const V21_SFX={
  slash:'sounds/se/slash_heavy.mp4',
  enemyhit:'sounds/se/enemy_hit.mp4',
  heal:'sounds/se/heal.mp4',
  revive:'sounds/se/revive.mp4',
  holy:'sounds/se/holy.mp4',
  barrier:'sounds/se/barrier.mp4'
};
const V21_SFX_POOL={};
function v21BuildPool(name,count=4,volume=.9){
  if(V21_SFX_POOL[name])return V21_SFX_POOL[name];
  const arr=[];
  for(let i=0;i<count;i++){const a=new Audio(V21_SFX[name]);a.preload='auto';a.volume=volume;arr.push(a)}
  arr._i=0;V21_SFX_POOL[name]=arr;return arr;
}
function v21Play(name,volume=.9,rate=1){
  try{
    const pool=v21BuildPool(name,name==='slash'||name==='enemyhit'?5:3,volume);
    const a=pool[pool._i++%pool.length];
    a.pause();a.currentTime=0;a.volume=volume;a.playbackRate=rate;
    a.play().catch(()=>{});
  }catch(e){}
}
function playSlashSE(){
  duckBGM(360,.045);
  v21Play('slash',1.00,.985+Math.random()*.025);
}
function playEnemyHitSE(){duckBGM(300,.08);v21Play('enemyhit',.96,.98+Math.random()*.04)}
function playHealSE(mode='heal'){duckBGM(430,.10);v21Play(mode==='revive'?'revive':'heal',.88,1)}
function playHolyFieldSE(){duckBGM(430,.08);v21Play('holy',.93,1)}
function playBarrierSE(){duckBGM(260,.10);v21Play('barrier',.88,.98+Math.random()*.03)}

let __audioCtx=null;
function ensureCtx(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  if(!__audioCtx)__audioCtx=new AC();
  if(__audioCtx.state==='suspended')__audioCtx.resume().catch(()=>{});
  return __audioCtx;
}
function env(g,t,a,d,v=1){
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.linearRampToValueAtTime(v,t+a);
  g.gain.exponentialRampToValueAtTime(0.0001,t+a+d);
}
function synthNoise(type='impact'){
  const ctx=ensureCtx(); if(!ctx)return;
  const t=ctx.currentTime;
  const dur=type==='slash'?0.12:0.18;
  const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
  const data=buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    const n=Math.random()*2-1;
    data[i]=type==='slash'?n*(1-i/data.length):n*(1-i/data.length)*0.8;
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=type==='slash'?1500:500;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=type==='slash'?7000:1800;
  const g=ctx.createGain();
  env(g,t,0.004,type==='slash'?0.09:0.14,type==='slash'?0.11:0.22);
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t+dur);
}
function synthTone(kind='slash'){
  const ctx=ensureCtx(); if(!ctx)return;
  const t=ctx.currentTime;
  if(kind==='slash'){
    const o=ctx.createOscillator(); o.type='triangle';
    const g=ctx.createGain();
    o.frequency.setValueAtTime(2400,t);
    o.frequency.exponentialRampToValueAtTime(220,t+0.08);
    env(g,t,0.002,0.10,0.18);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+0.12);
  }else if(kind==='impact'){
    const o=ctx.createOscillator(); o.type='sine';
    const g=ctx.createGain();
    o.frequency.setValueAtTime(140,t);
    o.frequency.exponentialRampToValueAtTime(48,t+0.16);
    env(g,t,0.002,0.18,0.28);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+0.2);
  }else if(kind==='union'){
    const o=ctx.createOscillator(); o.type='sawtooth';
    const g=ctx.createGain();
    o.frequency.setValueAtTime(880,t);
    o.frequency.exponentialRampToValueAtTime(110,t+0.18);
    env(g,t,0.004,0.18,0.24);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+0.22);
  }
}
function playHeavySlash(){ synthNoise('slash'); synthTone('slash'); }
function playHeavyImpact(){ synthNoise('impact'); synthTone('impact'); }
function playHeavyUnion(){ synthNoise('slash'); synthTone('union'); setTimeout(()=>synthNoise('impact'),36); setTimeout(()=>synthTone('impact'),42); }



function playUnionChargeSE(){
  ensureCtx();
  playAudio(chargeAudio);
}
function playUnionHitSE(hit=1){
  // v23.46: one spatial "ザシュッ" per registered hit.
  // Do not stack the old synthetic metal/noise layers.
  duckBGM(150,.012);
  try{
    const pool=unionPool;
    const a=pool[hit%pool.length];
    a.pause();a.currentTime=0;
    a.volume=.98;
    a.playbackRate=.985+(hit%4)*.008;
    a.play().catch(()=>{});
  }catch(e){}
}

let bgmEnabled=true;
let bgmMode='B'; // v23.36: BGM B adopted as the sole battle BGM
let bgmAudio=null;
function bgmSource(){return AUDIO.bgmB}
function startBGM(){
  if(!bgmEnabled)return;
  if(!bgmAudio){
    bgmAudio=new Audio(bgmSource());
    bgmAudio.preload='auto';bgmAudio.loop=true;bgmAudio.volume=.42; // v23.36 audio is composed as a true 98s loop; no fadeout reset
  }
  try{if(bgmAudio.paused)bgmAudio.play().catch(()=>{})}catch(e){}
}
function stopBGM(){if(bgmAudio){try{bgmAudio.pause()}catch(e){}}}
function toggleBGM(){
  bgmEnabled=!bgmEnabled;
  if(bgmEnabled)startBGM();else stopBGM();
  const b=$('#bgmBtn');if(b)b.textContent=bgmEnabled?'BGM ON':'BGM OFF';
}
function switchBGM(){/* v23.36: BGM A discarded; B is fixed */}
document.addEventListener('pointerdown',startBGM,{once:true,capture:true});

function floLower(t,x,y){
  const root=$('#lowerRef');if(!root)return;
  const e=document.createElement('div');e.className='lowerFloat';e.textContent=t;e.style.left=x+'%';e.style.top=y+'%';
  root.append(e);setTimeout(()=>e.remove(),950);
}


function floLower(t,x,y){const root=$('#lowerRef');if(!root)return;const e=document.createElement('div');e.className='lowerFloat';e.textContent=t;e.style.left=x+'%';e.style.top=y+'%';root.append(e);setTimeout(()=>e.remove(),950)}

function render(){
  renderUIText();
  renderCharacterCards();
  S.weeklyHP=clamp(S.weeklyHP,0,MAX_WEEKLY);
  S.dailyEnemies=S.dailyEnemies.filter(e=>e.hp>0).slice(0,MAX_DAILY_STACK);
  const first=S.dailyEnemies[0]||null;
  const count=S.dailyEnemies.length;
  const sceneDepth=$('#scene');if(sceneDepth)sceneDepth.dataset.dailyCount=String(count);
  const firstHp=first?clamp(first.hp,0,MAX_DAILY):0;

  const coin=$('#coin');if(coin)coin.textContent=S.coin.toLocaleString();
  const refCoin=$('#refCoin');if(refCoin)refCoin.textContent=S.coin.toLocaleString()+' COIN';
  const dTitle=$('#dailyTitle');if(dTitle)dTitle.textContent='✦ デイリー'+(count>1?' ×'+count:'');
  const wTitle=$('#weeklyHUD .title');if(wTitle)wTitle.textContent='✦ ウィークリー';
  $('#dailyText').textContent=count?('HP '+firstHp+'/'+MAX_DAILY):'撃破済み';
  $('#weeklyText').textContent=(S.weeklyHP>0)?('HP '+S.weeklyHP+'/'+MAX_WEEKLY):'撃破済み';
  $('#dailyBar').style.width=(count?firstHp/MAX_DAILY*100:0)+'%';
  $('#weeklyBar').style.width=(S.weeklyHP/MAX_WEEKLY*100)+'%';
  $('#dailyPatch').classList.add('on');
  $('#weeklyPatch').classList.add('on');
  $('#dailyHUD').classList.toggle('defeated',count===0);
  $('#weeklyHUD').classList.toggle('defeated',S.weeklyHP<=0);
  const ds=$('#dailyStack');if(ds){ds.innerHTML=S.dailyEnemies.map((e,i)=>`<i class="${i===0?'current':''}" style="--p:${clamp(e.hp,0,MAX_DAILY)/MAX_DAILY*100}%" title="${e.hp}/${MAX_DAILY}"></i>`).join('')}
  const df=$('#dailyFormation');if(df){
    const enemies=S.dailyEnemies.slice(0,7);
    df.dataset.count=String(enemies.length);
    const pos=[
      {x:0, y:49, s:1.08, z:31, active:true},
      {x:42,y:63, s:.92, z:28},
      {x:31,y:34, s:.87, z:25},
      {x:57,y:34, s:.87, z:24},
      {x:21,y:3,  s:.82, z:21},
      {x:47,y:3,  s:.82, z:20},
      {x:73,y:3,  s:.82, z:19}
    ];
    df.innerHTML=enemies.map((e,i)=>{
      const p=pos[i];
      return `<div class="dailyPawn ${p.active?'active':''}" data-enemy-id="${e.id}" style="--x:${p.x}%;--y:${p.y}%;--scale:${p.s};--z:${p.z};--hp:${clamp(e.hp,0,MAX_DAILY)/MAX_DAILY*100}%">
        <img class="enemyArt" alt="デイリーエネミー" src="${DAILY_ENEMY_ART}">
        <span class="enemyName">${DAILY_ENEMY_NAME}</span>
        <span class="hpMini"><i></i></span>
        <span class="age">${shortEnemyDay(e.day)}</span>
      </div>`;
    }).join('');
  }

  for(let i=0;i<3;i++){
    const maxHp=maxHpOf(i),hp=clamp(S.party[i],0,maxHp);
    const rn=$('#rhp'+i+'n'),rm=$('#rhp'+i+'m'),rb=$('#rhp'+i+'b'),rp=$('#rhp'+i);
    if(rn)rn.textContent=hp;if(rm)rm.textContent=maxHp;if(rb)rb.style.width=(hp/maxHp*100)+'%';if(rp){
      rp.classList.toggle('down',hp<=0);
      let bb=rp.querySelector('.bleedBadge');if(!bb){bb=document.createElement('span');bb.className='bleedBadge';rp.appendChild(bb);}
      const bt=Math.max(0,Math.floor(Number(S.bleed[i])||0));bb.textContent='出血 ×'+bt;bb.classList.toggle('on',bt>0);
    }
  }
  $$('.daily').forEach(q=>{const i=+q.dataset.i;q.classList.toggle('done',!!S.daily[i]);q.querySelector('button').textContent=S.daily[i]?'CLEAR':'+50'});
  $$('.weekly').forEach(q=>{const i=+q.dataset.i;q.classList.toggle('done',!!S.weekly[i]);q.querySelector('button').textContent=S.weekly[i]?'CLEAR':'+100'});
  $$('.special').forEach(q=>{const i=+q.dataset.i;q.classList.toggle('done',!!S.special[i]);q.querySelector('button').textContent=S.special[i]?'CLEAR':'+100'});
  const rD=$('#rDTotal');if(rD)rD.textContent='本日 +'+(S.daily.filter(Boolean).length*DAILY_REWARD);
  const rW=$('#rWTotal');if(rW)rW.textContent='今週 +'+(S.weekly.filter(Boolean).length*WEEKLY_REWARD);
  const rS=$('#rSTotal');if(rS)rS.textContent='特別 +'+(S.special.filter(Boolean).length*100);
  const healSP=$('#healSP');if(healSP)healSP.textContent=S.skillSP;
  const warriorSP=$('#warriorSP');if(warriorSP)warriorSP.textContent=S.skillSP;
  const tameSP=$('#tameSP');if(tameSP)tameSP.textContent=S.skillSP;
  
  const beastSlot=$('#beastSlot');if(beastSlot){
    const slots=[];
    if(S.beast&&S.beast.hp>0)slots.push(S.beast);
    if(Array.isArray(S.beastQueue))slots.push(...S.beastQueue);
    if(slots.length){
      const lines=[];
      for(let i=0;i<5;i++){
        const b=slots[i];
        lines.push((i+1)+'. '+(b?(b.name+' HP '+b.hp+'/'+MAX_BEAST_HP):'空'));
      }
      beastSlot.innerHTML=lines.join('<br>');
      beastSlot.className='beastAlive';
    }else{beastSlot.textContent='未加入';beastSlot.className=''}
  }
  const attackBtn=$('#attack');if(attackBtn){attackBtn.disabled=busy;attackBtn.style.opacity=busy?'.75':'1'}
  const refDate=$('#refDate');if(refDate){const n=now();refDate.innerHTML=n.getFullYear()+'/'+(n.getMonth()+1)+'/'+n.getDate()+'<br>('+['日','月','火','水','木','金','土'][n.getDay()]+')'}
  const tameBtn=$('#tameBtn');if(tameBtn)tameBtn.disabled=true;
}

function mostDamagedFriendOfWarrior(){
  const arr=[0,2].filter(i=>S.party[i]>0).map(i=>({i,r:S.party[i]/maxHpOf(i)})).sort((a,b)=>a.r-b.r);
  return arr.length?arr[0].i:-1;
}
async function clericAutoSupport(){
  // Aria / Cleric auto skill: Heal only.
  if(S.party[0]<=0||S.skillSP<1)return;
  if(S.healUsed)return;

  const injured=S.party
    .map((hp,i)=>({hp,i,r:hp/maxHpOf(i)}))
    .filter(x=>x.hp>0&&x.r<=.50)
    .sort((a,b)=>a.r-b.r);

  if(!injured.length)return;

  const t=injured[0].i;
  const heal=Math.min(Math.ceil(maxHpOf(t)*.30),maxHpOf(t)-S.party[t]);
  S.party[t]+=heal;
  S.skillSP--;
  S.healUsed=true;
  save();render();

  try{playHealSE()}catch(e){}
  floLower('+'+heal,20+t*21,27);
  showActionCall('アリア（クレリック）','ヒール',memberNames[t],'HP +'+heal);
  toast('ヒール！ '+memberNames[t]+' HP +'+heal);
  log('アリアのオートスキル「ヒール」。味方HP50%以下で最重傷の味方を最大HP30%回復。SKILL SP '+S.skillSP);
  await wait(980);
}
function shortEnemyDay(day){
  const m=String(day||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? (+m[2])+'/'+(+m[3]) : day;
}
let battleTargetPlan=null;
function finisherHitsForBattle(){
  if((S.battlePts||0)<3)return 0;
  const wc=S.weekly.filter(Boolean).length;
  return wc===0?4:wc===1?5:wc===2?6:10;
}
function finisherDamageForBattle(){return finisherHitsForBattle()*UNION_DMG}
function enemyById(id){return S.dailyEnemies.find(e=>e.id===id)}
function currentTarget(){
  if(S.dailyEnemies.length)return {kind:'daily',id:S.dailyEnemies[0].id};
  if(S.weeklyHP>0)return {kind:'weekly'};
  return null;
}
function smartVirtualTarget(virtual,dmg,finisherDmg,lastId=null){
  const alive=virtual.filter(e=>e.hp>0);
  if(!alive.length)return null;
  let pool=alive;
  if(finisherDmg>0){
    // まず、最終全体攻撃だけでは倒せない敵を優先して削る。
    const over=alive.filter(e=>e.hp>finisherDmg);
    if(over.length){
      pool=over.sort((a,b)=>((b.hp-finisherDmg)-(a.hp-finisherDmg)) || (b.hp-a.hp));
    }else{
      // 全員がユニオン圏内なら、低HP敵を温存し、単体攻撃は高HP側へ分散。
      const safe=alive.filter(e=>e.hp>dmg);
      pool=(safe.length?safe:alive).sort((a,b)=>(b.hp-a.hp));
    }
  }else{
    // フィニッシャーが無い日はオーバーキルを減らしつつ高HPを優先。
    const absorb=alive.filter(e=>e.hp>=dmg);
    pool=(absorb.length?absorb:alive).sort((a,b)=>(b.hp-a.hp));
  }
  if(pool.length>1&&lastId!=null){
    const alt=pool.find(e=>e.id!==lastId);
    if(alt)return alt;
  }
  return pool[0]||null;
}
function buildBattleTargetPlan(){
  const virtual=S.dailyEnemies.map(e=>({id:e.id,hp:e.hp}));
  const finisherDmg=finisherDamageForBattle();
  const plan={ally:[],tame:[],allyPos:0,tamePos:0,finisherDmg};
  let last=null;
  for(let i=0;i<(S.battlePts||0);i++){
    const t=smartVirtualTarget(virtual,ALLY_DMG,finisherDmg,last);
    if(!t){plan.ally.push(null);continue;}
    plan.ally.push(t.id);t.hp=Math.max(0,t.hp-ALLY_DMG);last=t.id;
  }
  last=null;
  for(let i=0;i<battleTames().length;i++){
    const t=smartVirtualTarget(virtual,TAME_DMG,finisherDmg,last);
    if(!t){plan.tame.push(null);continue;}
    plan.tame.push(t.id);t.hp=Math.max(0,t.hp-TAME_DMG);last=t.id;
  }
  return plan;
}
function plannedTarget(kind,dmg){
  if(!S.dailyEnemies.length)return S.weeklyHP>0?{kind:'weekly'}:null;
  if(!battleTargetPlan)return currentTarget();
  const arr=kind==='tame'?battleTargetPlan.tame:battleTargetPlan.ally;
  const posKey=kind==='tame'?'tamePos':'allyPos';
  while(battleTargetPlan[posKey]<arr.length){
    const id=arr[battleTargetPlan[posKey]++];
    if(id!=null&&enemyById(id))return {kind:'daily',id};
  }
  // 予定対象が既に倒れていたら、残HPとフィニッシャーを見て再最適化。
  const virtual=S.dailyEnemies.map(e=>({id:e.id,hp:e.hp}));
  const fallback=smartVirtualTarget(virtual,dmg,battleTargetPlan.finisherDmg,null);
  return fallback?{kind:'daily',id:fallback.id}:(S.weeklyHP>0?{kind:'weekly'}:null);
}
function damageDailyById(id,dmg){
  const e=enemyById(id);if(!e)return false;
  e.hp=Math.max(0,e.hp-dmg);
  if(e.hp<=0){
    S.dailyEnemies=S.dailyEnemies.filter(x=>x.id!==id);
    tryPassiveTame();
    return true;
  }
  return false;
}

/* v23.46
   Normal / Tamed attack defeat:
   damage -> HP 0 -> short pause -> 2.5s Pattern ④ return-to-light fade -> removal.
   The defeated Daily enemy remains in S during the visual fade so its DOM can stay visible.
*/
async function damageDailyWithReturnLight(id,dmg){
  const e=enemyById(id);
  if(!e)return {killed:false};

  e.hp=Math.max(0,e.hp-dmg);

  if(e.hp>0){
    save();
    render();
    return {killed:false};
  }

  const node=document.querySelector('.dailyPawn[data-enemy-id="'+id+'"]');

  // Do not render here: render() intentionally removes hp<=0 enemies.
  // Instead update the existing visible pawn's gauge to 0.
  if(node){
    node.style.setProperty('--hp','0%');
    const hp=node.querySelector('.hpMini i');
    if(hp)hp.style.width='0%';
    node.classList.add('unionDamageZero');
  }

  // Let the damage / HP=0 result register before the disappearance starts.
  await wait(400);

  if(node){
    node.classList.remove('unionDamageZero');
    node.classList.add('unionReturnLight');
  }

  // Same disappearance speed as the adopted Pattern ④ Union defeat.
  await wait(2550);

  // Remove only after the visual fade has fully finished.
  S.dailyEnemies=S.dailyEnemies.filter(x=>x.id!==id);
  tryPassiveTame();
  save();
  render();

  return {killed:true};
}
function damageAllDailies(dmg){
  for(const e of S.dailyEnemies)e.hp=Math.max(0,e.hp-dmg);
  const killed=S.dailyEnemies.filter(e=>e.hp<=0).length;
  S.dailyEnemies=S.dailyEnemies.filter(e=>e.hp>0);
  for(let i=0;i<killed;i++)tryPassiveTame();
  return killed;
}

async function allyStrike(i){
  if(S.party[i]<=0||!anyEnemyAlive())return;
  const target=plannedTarget('ally',ALLY_DMG);if(!target)return;
  const dmg=ALLY_DMG;
  const actor=memberNames[i]+'（'+allyNames[i]+'）';
  flash();try{playSlashSE()}catch(e){}
  if(target.kind==='daily'){
    const de=enemyById(target.id);
    const targetLabel=DAILY_ENEMY_NAME+(de?'（'+shortEnemyDay(de.day)+'）':'');
    showActionCall(actor,'攻撃',targetLabel,dmg+' DAMAGE');
    flo('-'+dmg,51,49);
    const defeatResult=await damageDailyWithReturnLight(target.id,dmg);
    log(actor+' → '+targetLabel+'：'+dmg+'ダメージ。'+(defeatResult.killed?' 撃破。':''));
    if(defeatResult.killed)return;
  }else{
    showActionCall(actor,'攻撃',WEEKLY_ENEMY_NAME,'BARRIER');
    flo('BARRIER',76,28);try{playBarrierSE()}catch(e){}
    log(actor+' → '+WEEKLY_ENEMY_NAME+'：BARRIER FIELDで無効。');
  }
  save();render();await wait(1250);
}

async function weeklyThresholdSkill(){
  if(S.weeklyHP<=0||S.weeklyPhaseSkillUsed||S.weeklyHP>weeklyThreshold())return false;
  const alive=aliveIndexes();if(!alive.length)return false;

  S.weeklyPhaseSkillUsed=true;
  const skillName=weeklySkillName();
  const fieldCandidates=alive.filter(i=>i!==1&&S.party[1]>0&&(S.party[i]/maxHpOf(i))<=.30);
  let fieldTarget=-1;
  if(fieldCandidates.length&&S.skillSP>0){
    fieldTarget=fieldCandidates.sort((a,b)=>(S.party[a]/maxHpOf(a))-(S.party[b]/maxHpOf(b)))[0];
    S.skillSP=Math.max(0,S.skillSP-1);
  }

  const directNotes=[];
  alive.forEach((i,idx)=>{
    let dmg=100;
    if(i===fieldTarget){dmg=0;directNotes.push(memberNames[i]+' FIELD BLOCK');}
    else if(i===1){dmg=50;directNotes.push('セレス HOLY GUARD 50% CUT');}
    S.party[i]=Math.max(0,S.party[i]-dmg);
    S.bleed[i]=3; // 100% status application; Holy skills do NOT prevent this.
    if(dmg>0)floLower('-'+dmg,20+i*21,23+idx*1.2);
  });
  // Newly applied bleeding must be allowed to tick in this battle after Cure.
  S.bleedLastTickDay='';

  showActionCall(WEEKLY_ENEMY_NAME,skillName,'パーティ全員','全体100 + 出血100%');
  try{playEnemyHitSE()}catch(e){}
  shake('heavy');save();render();
  toast(skillName+'！ 全員に出血');
  log(WEEKLY_ENEMY_NAME+'の'+skillName+'！ 全体100ダメージ系攻撃 ／ 全員に出血（100×3回）を100%付与。'+(directNotes.length?' ／ '+directNotes.join('・'):'')+' ※出血はホーリー系を無視。');
  await wait(1500);
  return true;
}

async function protagonistCleanseStatus(){
  const affected=[];
  for(let i=0;i<3;i++)if(hasStatusAilment(i))affected.push(i);

  if(!affected.length)return false;
  if(S.cureUsedDay===dayKey())return false;

  const clears=S.daily.filter(Boolean).length;
  if(clears<=0)return false;

  // Daily 1 = one target / 2 = two targets / 3 = all targets.
  const limit=clears>=3?affected.length:Math.min(clears,affected.length);

  // When the range is limited, cleanse the most injured allies first.
  affected.sort((a,b)=>(S.party[a]/maxHpOf(a))-(S.party[b]/maxHpOf(b)));
  const targets=affected.slice(0,limit);

  targets.forEach(clearStatusAilments);
  S.cureUsedDay=dayKey();

  const targetLabel=targets.map(i=>memberNames[i]).join('・');
  const effect=clears>=3?'ALL CLEANSE':(targets.length+'体 CLEANSE');

  showActionCall(
    '主人公（'+protagonistClass()+'）',
    protagonistCureName(),
    targetLabel,
    effect
  );
  try{playHealSE('heal')}catch(e){}
  save();render();

  toast(protagonistCureName()+'！ '+effect);
  log(
    '主人公の'+protagonistCureName()+
    '。デイリー'+clears+'件達成 → '+targetLabel+
    'の状態異常を解除。'
  );
  await wait(1050);
  return true;
}

async function resolveBleedStatus(){
  const bleeding=[];
  for(let i=0;i<3;i++)if((S.bleed[i]||0)>0)bleeding.push(i);
  if(!bleeding.length)return false;
  if(S.bleedLastTickDay===dayKey())return false;

  const notes=[];
  bleeding.forEach((i,idx)=>{
    if(S.party[i]>0){
      S.party[i]=Math.max(0,S.party[i]-100);
      floLower('-100',20+i*21,25+idx*1.1);
      notes.push(memberNames[i]+' -100');
    }else notes.push(memberNames[i]+'（行動不能）');
    S.bleed[i]=Math.max(0,(S.bleed[i]||0)-1);
  });
  S.bleedLastTickDay=dayKey();
  showActionCall('状態異常','出血',bleeding.map(i=>memberNames[i]).join('・'),'100 DAMAGE');
  try{playEnemyHitSE()}catch(e){}
  shake('heavy');save();render();
  toast('出血ダメージ！');
  log('状態異常・出血：'+notes.join(' ／ ')+'。ホーリーガード／ホーリーフィールドでは軽減・無効化できない。');
  await wait(1100);
  return true;
}

async function enemyStrike(kind,id=null){
  if(kind==='daily'&&!enemyById(id))return;
  if(kind==='weekly'&&S.weeklyHP<=0)return;
  const de=kind==='daily'?enemyById(id):null;
  const srcEnemy=kind==='daily'?(DAILY_ENEMY_NAME+(de?'（'+shortEnemyDay(de.day)+'）':'')):WEEKLY_ENEMY_NAME;

  // Tame Guard: resolves immediately before the ally would take damage.
  if(S.beast&&S.beast.hp>0&&S.skillSP>0){
    const raw=BASE_ENEMY_DMG;
    const guardName='テイムエネミー1';
    S.skillSP=Math.max(0,S.skillSP-1);
    S.beast.hp=Math.max(0,S.beast.hp-raw);
    showActionCall('リネット','テイムガード',guardName,'肩代わり '+raw);
    try{playHolyFieldSE()}catch(e){}
    try{playEnemyHitSE()}catch(e){}shake('heavy');save();render();
    log(srcEnemy+'の攻撃 → '+guardName+'がテイムガードで'+raw+'ダメージを肩代わり。SKILL SP '+S.skillSP+'。');
    if(S.beast.hp<=0){
      toast('テイムエネミー1が倒れた');
      S.beast=null;
      if(S.beastQueue.length){S.beast=S.beastQueue.shift();toast('次のテイムエネミーが出撃！');}
      save();render();
    }
    await wait(1320);return;
  }

  const alive=aliveIndexes();if(!alive.length)return;
  const t=alive[Math.floor(Math.random()*alive.length)];
  let dmg=BASE_ENEMY_DMG,note='';

  if(t===1){
    dmg=Math.ceil(dmg*.5);
    note='ホーリーガード 50% CUT';
    showActionCall('セレス','ホーリーガード','セレス','50% CUT');
    try{playHolyFieldSE()}catch(e){}
  }else if(S.party[1]>0&&t!==1&&(S.party[t]/maxHpOf(t))<=.30&&S.skillSP>0){
    S.skillSP=Math.max(0,S.skillSP-1);
    dmg=0;
    note='ホーリーフィールド 100% BLOCK';
    showActionCall('セレス','ホーリーフィールド',memberNames[t],'100% BLOCK');
    try{playHolyFieldSE()}catch(e){}
  }else{
    showActionCall(srcEnemy,'攻撃',memberNames[t],dmg+' DAMAGE');
  }

  S.party[t]=Math.max(0,S.party[t]-dmg);save();render();
  if(dmg>0){try{playEnemyHitSE()}catch(e){}shake('heavy');floLower('-'+dmg,20+t*21,27);}
  log(srcEnemy+' → '+memberNames[t]+'：'+dmg+'ダメージ'+(note?' ／ '+note:'')+'。');
  if(S.party[t]<=0)toast(memberNames[t]+' は行動不能');
  await wait(1320);await clericAutoSupport();
}


async function ariaHealingLightPassive(){
  // Passive owner must be alive. KO allies are not revived by this passive.
  if(S.party[0]<=0)return false;

  const healed=[];
  for(let i=0;i<3;i++){
    if(S.party[i]<=0)continue;
    const before=S.party[i];
    S.party[i]=Math.min(maxHpOf(i),S.party[i]+20);
    const amount=S.party[i]-before;
    if(amount>0){
      healed.push(memberNames[i]+' +'+amount);
      floLower('+'+amount,20+i*21,27);
    }
  }

  if(!healed.length)return false;

  save();render();
  try{playHealSE()}catch(e){}
  showActionCall('アリア（クレリック）','癒しの光','生存している味方全員','HP +20');
  toast('癒しの光');
  log('アリアのパッシブ「癒しの光」：戦闘終了時、生存している味方を回復。'+healed.join(' ／ '));
  await wait(900);
  return true;
}


async function tamedArmyStrike(){
  const tames=battleTames();
  if(!tames.length||!anyEnemyAlive())return;
  log('テイム部隊：デイリー達成 '+S.daily.filter(Boolean).length+'件 → '+tames.length+'体参加。');
  for(let i=0;i<tames.length;i++){
    if(!anyEnemyAlive())break;
    const target=plannedTarget('tame',TAME_DMG);if(!target)break;
    const actor='テイムエネミー'+(i+1);
    flash();try{playSlashSE()}catch(e){}
    if(target.kind==='daily'){
      const de=enemyById(target.id);
      const targetLabel=DAILY_ENEMY_NAME+(de?'（'+shortEnemyDay(de.day)+'）':'');
      showActionCall(actor,'攻撃',targetLabel,TAME_DMG+' DAMAGE');
      flo('-'+TAME_DMG,54,47);
      const defeatResult=await damageDailyWithReturnLight(target.id,TAME_DMG);
      log(actor+' → '+targetLabel+'：'+TAME_DMG+'ダメージ。'+(defeatResult.killed?' 撃破。':''));
      if(defeatResult.killed)continue;
    }else{
      showActionCall(actor,'攻撃',WEEKLY_ENEMY_NAME,'BARRIER');
      flo('BARRIER',76,28);try{playBarrierSE()}catch(e){}
      log(actor+' → '+WEEKLY_ENEMY_NAME+'：BARRIER FIELDで無効。');
    }
    save();render();await wait(820);
  }
}


function checkWeeklyBossBonus(){
  if(S.weeklyHP<=0&&!S.weeklyBonusClaimed){
    S.weeklyBonusClaimed=true;
    S.coin+=WEEKLY_BOSS_BONUS;
    toast(WEEKLY_ENEMY_NAME+'撃破！ +10ポイント');
    log(WEEKLY_ENEMY_NAME+'撃破ボーナス +10ポイント。');
    save();
    if(!unionVisualLock)render();
    return true;
  }
  return false;
}
async function starsBlessing(){
  const fx=document.createElement('div');fx.className='blessingFlash';$('#scene').append(fx);setTimeout(()=>fx.remove(),1100);
  const down=[];
  for(let i=0;i<3;i++)if(S.party[i]<=0){S.party[i]=Math.ceil(maxHpOf(i)*.5);down.push(memberNames[i]);}
  showSE('#seUnion','✦ 星々の祝福 ✦');showActionCall('星々の祝福','リザレクション・オール','パーティ全員','戦線復帰');
  try{playHealSE('revive')}catch(e){}
  if(down.length){
    toast('星々の祝福 — RESURRECTION ALL —');
    log('星々の祝福。'+down.join('・')+'がHP50%で復活。');
  }else{
    toast('星々の祝福');
    log('星々の祝福。4人の想いが共鳴する。');
  }
  save();render();await wait(1050);
}

async function starlightUnion(mode='normal',hits=4){
  if(!anyEnemyAlive())return;
  await starsBlessing();

  const overbreak=mode==='overbreak';
  const union=$('#union');
  const initialDailyIds=S.dailyEnemies.map(e=>e.id);
  const initialWeeklyAlive=S.weeklyHP>0;
  const unionStartedAt=performance.now();
  unionVisualLock=true;

  union.classList.toggle('overbreak',overbreak);
  union.classList.add('on','rapid');

  const skillName=overbreak
    ?'スターライト・ユニオン・オーバーブレイク'
    :'スターライト・ユニオン';

  const totalDamage=hits*UNION_DMG;
  showActionCall('4人連携',skillName,'全エネミー',hits+'連撃 / 最大'+totalDamage+'ダメージ');
  log(skillName+'！ '+hits+'連全体攻撃。1撃'+UNION_DMG+'、最大'+totalDamage+'ダメージ。');

  try{playUnionChargeSE()}catch(e){}
  await wait(overbreak?420:470);

  let landed=0;

  // During the barrage, game state changes immediately but enemy DOM is frozen.
  // This keeps every defeated enemy visible through the full special animation.
  for(let n=0;n<hits;n++){
    const hadDaily=S.dailyEnemies.length>0;
    const hadWeekly=S.weeklyHP>0;

    if(hadDaily)damageAllDailies(UNION_DMG);
    if(hadWeekly){
      S.weeklyHP=Math.max(0,S.weeklyHP-UNION_DMG);
      if(S.weeklyHP<=0)checkWeeklyBossBonus();
    }
    landed++;

    try{playUnionHitSE(n+1)}catch(e){}
    try{
      union.classList.remove('rapidHit');
      void union.offsetWidth;
      union.classList.add('rapidHit');
    }catch(e){}
    try{unionDamageBurst('-'+UNION_DMG,n)}catch(e){}

    log(skillName+' HIT '+(n+1)+'/'+hits+'：全体 '+UNION_DMG+'ダメージ。');
    await wait(n===hits-1?145:118);
  }

  save();
  try{union.classList.remove('rapidHit')}catch(e){}

  // .union.on itself is a 2.7s animation. Do not begin enemy disappearance
  // until that animation has had time to complete in full.
  const minUnionVisualMs=overbreak?2920:2820;
  const elapsed=performance.now()-unionStartedAt;
  if(elapsed<minUnionVisualMs)await wait(minUnionVisualMs-elapsed);

  try{union.classList.remove('on','overbreak','rapid')}catch(e){}
  await wait(90); // ensure the special-art layer is fully gone first

  const survivorIds=new Set(S.dailyEnemies.map(e=>e.id));
  const defeatedDailyIds=initialDailyIds.filter(id=>!survivorIds.has(id));
  const defeatedNodes=[];

  // First show the final damage result clearly: HP gauge reaches 0
  // while the defeated enemy itself is still fully visible.
  for(const id of defeatedDailyIds){
    const node=document.querySelector('.dailyPawn[data-enemy-id="'+id+'"]');
    if(node){
      node.style.setProperty('--hp','0%');
      const hp=node.querySelector('.hpMini i');
      if(hp)hp.style.width='0%';
      node.classList.add('unionDamageZero');
      defeatedNodes.push(node);
    }
  }

  if(initialWeeklyAlive&&S.weeklyHP<=0){
    const boss=document.querySelector('.weeklyOriginalArt');
    const foot=document.querySelector('#weeklyFootStatus');
    const barrier=document.querySelector('.weeklyBarrierLabel');
    const text=document.querySelector('#weeklyFootText');
    const bar=document.querySelector('#weeklyFootBar');
    if(text)text.textContent='0/'+MAX_WEEKLY;
    if(bar)bar.style.width='0%';
    [boss,foot,barrier].forEach(node=>{
      if(node){
        node.classList.add('unionDamageZero');
        defeatedNodes.push(node);
      }
    });
  }

  // Let the player register "HP 0" before the disappearance starts.
  if(defeatedNodes.length)await wait(420);

  // Pattern ④: return to light.
  // Enemy remains visible at first, then a blue-white central glow rises
  // while the whole defeated visual gently fades for 2.5 seconds.
  defeatedNodes.forEach(node=>{
    node.classList.remove('unionDamageZero');
    node.classList.add('unionReturnLight');
  });

  if(defeatedNodes.length)await wait(2550);

  unionVisualLock=false;
  render();
  log(skillName+'完了：'+landed+'連撃 / 理論最大 '+totalDamage+'ダメージ。');
}

// v23.20: 戦闘開始時に全単体攻撃を仮計算し、ユニオン/オーバーブレイクの全体ダメージを最大活用する。
async function startBattle(){
  startBGM();
  if(busy)return;
  if(S.battlePts<1){toast('まず1ポイント獲得しよう');return}
  if(!aliveIndexes().length&&S.battlePts<3){toast('パーティ全員が行動不能。3Ptなら星々の祝福で再起可能');return}
  if(!anyEnemyAlive()){toast('すべての敵を撃破済み');return}

  busy=true;S.healUsed=false;
  battleTargetPlan=buildBattleTargetPlan();
  save();render();

  const allyCount=S.battlePts;
  const chance=preemptChance();
  const tamePower=battleTames().length*TAME_DMG;
  const normalPower=allyCount*ALLY_DMG;
  const finisherHits=finisherHitsForBattle();
  log('自動ターゲット計算：通常最大 '+normalPower+' ／ テイム最大 '+tamePower+(finisherHits?(' ／ 最終全体 '+finisherHits+'連×'+UNION_DMG):'')+'。残HPと全体攻撃を見て単体攻撃を最適配分。');
  const allyEvents=[];
  const enemyEvents=[];
  for(let i=0;i<allyCount;i++)allyEvents.push({type:'ally',idx:i});
  for(const e of S.dailyEnemies)enemyEvents.push({type:'enemy',enemy:'daily',id:e.id});
  if(S.weeklyHP>0)enemyEvents.push({type:'enemy',enemy:'weekly'});

  const preempt=(Math.random()*100)<chance;
  log('攻撃開始！ 先制率 '+chance+'%'+(preempt?' → 先制成功！':' → 通常開始。'));
  await wait(620);

  // A successful preemptive attack consumes one of the normal ally attacks; it is not an extra hit.
  if(preempt&&allyEvents.length&&aliveIndexes().length&&anyEnemyAlive()){
    const first=allyEvents.shift();
    toast('先制攻撃！');
    await allyStrike(first.idx%3);
  }

  const events=shuffle([...allyEvents,...enemyEvents]);
  for(const ev of events){
    if(!aliveIndexes().length||!anyEnemyAlive())break;
    if(ev.type==='ally')await allyStrike(ev.idx%3);
    else await enemyStrike(ev.enemy,ev.id||null);
  }

  // Tamed enemy joins after ALL normal attacks have ended.
  if(anyEnemyAlive()&&tameCount()>0)await tamedArmyStrike();

  // v23.46 boss 30% phase order:
  // 1) normal attacks -> 2) tame attacks -> 3) boss threshold skill
  // 4) protagonist status cleanse -> 5) remaining status tick -> 6) Stars Blessing -> 7) Union.
  if(S.weeklyHP>0&&!S.weeklyPhaseSkillUsed&&S.weeklyHP<=weeklyThreshold())await weeklyThresholdSkill();
  if([0,1,2].some(hasStatusAilment))await protagonistCleanseStatus();
  if(S.bleed.some(v=>v>0))await resolveBleedStatus();

  // Starlight finisher: Stars Blessing is executed inside starlightUnion().
  if(S.battlePts>=3&&anyEnemyAlive()){
    const wc=S.weekly.filter(Boolean).length;
    if(wc===0)await starlightUnion('normal',4);
    else if(wc===1)await starlightUnion('overbreak',5);
    else if(wc===2)await starlightUnion('overbreak',6);
    else await starlightUnion('overbreak',10);
  }

  // Battle-end passive phase.
  await ariaHealingLightPassive();

  battleTargetPlan=null;
  S.battlePts=0;save();render();
  if(!aliveIndexes().length)log('パーティ全員が行動不能。');
  else if(!anyEnemyAlive()){toast('全エネミー撃破！');log('全エネミー撃破！');}
  else if(!S.dailyEnemies.length)log('デイリーエネミー全撃破。ウィークリーを狙おう。');
  else log('戦闘終了。残存デイリー '+S.dailyEnemies.length+'体。HPは翌日に継承。');
  busy=false;render();
}

$('#attack').addEventListener('click',startBattle);
$$('.daily button').forEach(btn=>btn.onclick=e=>{startBGM();const q=e.currentTarget.closest('.quest'),i=+q.dataset.i;if(S.daily[i]||busy)return;S.daily[i]=1;S.coin+=DAILY_REWARD;S.skillSP=Math.max(0,(S.skillSP||0)+1);S.battlePts=Math.min(3,S.battlePts+1);save();render();toast('デイリー達成！ +50ポイント ／ SKILL SP +1 ／ 攻撃Pt +1');const dc=S.daily.filter(Boolean).length;const cure=dc>=3?'全員':dc+'体';log('SKILL SP '+S.skillSP+' ／ 攻撃Pt '+S.battlePts+'/3 ／ 先制率 '+preemptChance()+'% ／ 星晶浄化《ステラ・リリース》：'+cure+'浄化 ／ 3Ptでスターライト・ユニオン。')});
$$('.weekly button').forEach(btn=>btn.onclick=e=>{const q=e.currentTarget.closest('.quest'),i=+q.dataset.i;if(S.weekly[i]||busy)return;S.weekly[i]=1;S.coin+=WEEKLY_REWARD;save();render();const wc=S.weekly.filter(Boolean).length;const hits=wc===1?5:wc===2?6:10;toast('ウィークリー達成 +100ポイント ／ オーバーブレイク '+hits+'連撃！')});
$$('.special button').forEach(btn=>btn.onclick=e=>{const q=e.currentTarget.closest('.quest'),i=+q.dataset.i;if(S.special[i]||busy)return;S.special[i]=1;S.coin+=100;save();render();toast('スペシャル達成 +100 COIN')});

$('#tameBtn').onclick=()=>{};

$$('.shop button').forEach(b=>b.onclick=()=>{const c=+b.dataset.cost;if(S.coin<c){toast('コインが足りません');return}S.coin-=c;save();render();toast('報酬交換！')});
$('#bgmBtn').onclick=toggleBGM;


const rewardSingleBtn=$('#rewardSingleBtn');if(rewardSingleBtn)rewardSingleBtn.onclick=()=>{
  const cost=Math.max(0,Number(U.shop[0].cost)||0);
  const name=U.shop[0].name||'図鑑';
  if(S.coin<cost){toast('ポイントが足りません');return}
  if(!confirm(name+' を '+cost.toLocaleString()+'ポイントで交換しますか？'))return;
  S.coin-=cost;save();render();toast(name+' を交換しました！');
};

$('#resetBattle').onclick=()=>{S.dailyEnemies=[{id:++S.dailySeq,hp:MAX_DAILY,day:dayKey()}];S.weeklyHP=MAX_WEEKLY;S.weeklyPhaseSkillUsed=false;S.bleed=[0,0,0];S.bleedLastTickDay='';S.cureUsedDay='';S.party=MAX_HP.slice();S.battlePts=0;S.healUsed=false;save();render();log('戦闘テストを1体構成へリセット。')};
$('#resetStart').onclick=()=>{S=DEF();save();render();log('最初からテスト。')};
$('#resetAll').onclick=()=>{if(confirm('すべて初期化しますか？')){S=DEF();save();render();log('全データを初期化しました。')}};
initUIEditor();

function initEditorModal(){
  const block=document.querySelector('.editorBlock');
  const body=document.querySelector('#uiModal .uiModalBody');
  const openBtn=document.getElementById('openUiModal');
  const closeBtn=document.getElementById('closeUiModal');
  const modal=document.getElementById('uiModal');
  if(block&&body&&!body.contains(block)){body.appendChild(block);}
  if(block)block.classList.add('modalized');
  const open=()=>{if(modal){modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('modalOpen');}};
  const close=()=>{if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modalOpen');}};
  if(openBtn)openBtn.onclick=open;
  if(closeBtn)closeBtn.onclick=close;
  if(modal)modal.addEventListener('click',e=>{if(e.target===modal)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
}

initEditorModal();
saveUI();
save();render();
})();
