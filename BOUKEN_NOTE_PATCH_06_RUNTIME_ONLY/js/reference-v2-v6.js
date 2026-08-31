/* BOUKEN NOTE PATCH 06 — REFERENCE PARTS V2 REBUILD
   Visual-only controller. Gameplay/state remain in js/game.js. */
(function(){
  'use strict';
  const W=1672,H=941;
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));

  function fitCanvas(){
    const root=$('#g');if(!root)return;
    const vv=window.visualViewport;
    const vw=vv?vv.width:window.innerWidth;
    const vh=vv?vv.height:window.innerHeight;
    const scale=Math.max(.08,Math.min(vw/W,vh/H));
    root.style.setProperty('--v6-scale',String(scale));
  }

  async function tryLandscape(){
    try{
      if(document.documentElement.requestFullscreen&&!document.fullscreenElement){
        await document.documentElement.requestFullscreen().catch(()=>{});
      }
      if(screen.orientation&&screen.orientation.lock){
        await screen.orientation.lock('landscape').catch(()=>{});
      }
    }catch(e){}
    fitCanvas();
  }

  function ensureLore(){
    const scene=$('#scene');if(!scene)return;
    let lore=scene.querySelector('.sceneLoreV29');
    if(!lore){lore=document.createElement('div');lore.className='sceneLoreV29';scene.appendChild(lore)}
    if(!lore.querySelector('.ttl')){const t=document.createElement('div');t.className='ttl';lore.appendChild(t)}
    let chapter=lore.querySelector('.v6Chapter');
    if(!chapter){chapter=document.createElement('div');chapter.className='v6Chapter';chapter.textContent='第12章　星界の門';lore.appendChild(chapter)}
    let wave=lore.querySelector('.v6Wave');
    if(!wave){wave=document.createElement('div');wave.className='v6Wave';wave.textContent='WAVE 1/1';lore.appendChild(wave)}
    $$('.sceneLoreV29 .v5Chapter,.sceneLoreV29 .v5Wave').forEach(e=>e.remove());
  }

  function ensureDailyStatus(){
    const scene=$('#scene');if(!scene)return null;
    let s=scene.querySelector('.v6DailyStatus');
    if(!s){
      s=document.createElement('div');s.className='v6DailyStatus';
      s.innerHTML='<div class="v6EnemyName">虚空のコアユニット</div><div class="v6HpLine"><span>HP</span><b class="v6HpText">800/800</b></div><div class="v6HpTrack"><i></i></div>';
      scene.appendChild(s);
    }
    return s;
  }

  function syncDailyStatus(){
    const out=ensureDailyStatus();if(!out)return;
    const source=$('#dailyText');const sourceBar=$('#dailyBar');
    const txt=source?(source.textContent||''):'';
    const m=txt.match(/(\d[\d,]*)\/(\d[\d,]*)/);
    const t=out.querySelector('.v6HpText');const fill=out.querySelector('.v6HpTrack i');
    if(m){
      t.textContent=m[1]+'/'+m[2];
      out.style.opacity='1';
    }else{
      t.textContent='0/800';
      out.style.opacity='.38';
    }
    if(fill)fill.style.width=(sourceBar&&sourceBar.style.width)||'0%';
  }

  const MISSION_META={
    daily:{title:'デイリー',sub:'毎日リセット',icon:'blue'},
    weekly:{title:'ウィークリー',sub:'毎週月曜日リセット',icon:'purple'},
    special:{title:'スペシャル',sub:'期間限定ミッション',icon:'gold'}
  };

  function sourceMission(kind,i){return document.querySelector('.quest.'+kind+'[data-i="'+i+'"]')}
  function sourceText(kind,i){
    const map={daily:'#dq',weekly:'#wq',special:'#sq'};
    const e=$(map[kind]+i+'t');
    return e?(e.textContent||'').trim():'';
  }

  function buildMissions(){
    const area=$('#v6MissionArea');if(!area||area.dataset.built==='1')return;
    area.dataset.built='1';
    area.innerHTML=['daily','weekly','special'].map(kind=>{
      const m=MISSION_META[kind];
      const rows=[0,1,2].map(i=>`<button class="v6MissionRow" type="button" data-kind="${kind}" data-i="${i}"><span class="v6MissionIcon"></span><span class="v6MissionLabel"></span><span class="v6MissionPoints"></span></button>`).join('');
      return `<section class="v6MissionPanel" data-kind="${kind}"><div class="v6MissionHead"><div class="v6MissionTitle">${m.title}</div><div class="v6MissionSub"></div></div><div class="v6MissionRows">${rows}</div><button class="v6MissionEdit" type="button">ポイント編集</button></section>`;
    }).join('');
    $$('.v6MissionRow').forEach(row=>row.addEventListener('click',()=>{
      const src=sourceMission(row.dataset.kind,+row.dataset.i);
      const btn=src&&src.querySelector('button');if(btn)btn.click();
      setTimeout(syncMissions,35);
    }));
    $$('.v6MissionEdit').forEach(b=>b.addEventListener('click',()=>{const open=$('#openUiModal');if(open)open.click()}));
  }

  function syncMissions(){
    buildMissions();
    ['daily','weekly','special'].forEach(kind=>{
      let done=0;
      for(let i=0;i<3;i++){
        const src=sourceMission(kind,i);
        const row=$(`.v6MissionRow[data-kind="${kind}"][data-i="${i}"]`);
        if(!row)continue;
        const label=row.querySelector('.v6MissionLabel');const pts=row.querySelector('.v6MissionPoints');
        if(label)label.textContent=sourceText(kind,i);
        const isDone=!!(src&&src.classList.contains('done'));if(isDone)done++;
        row.classList.toggle('done',isDone);
        const srcBtn=src&&src.querySelector('button');
        let val=srcBtn?(srcBtn.textContent||'').trim():'';
        if(isDone)val='CLEAR';
        else if(!val||val==='達成')val=kind==='daily'?'+50':'+100';
        if(pts)pts.textContent=val;
      }
      const sub=$(`.v6MissionPanel[data-kind="${kind}"] .v6MissionSub`);
      if(sub){
        if(kind==='special')sub.textContent=MISSION_META[kind].sub;
        else sub.textContent=MISSION_META[kind].sub+'（'+done+'/3）';
      }
    });
  }

  function syncParty(){
    const levels=['Lv.26','Lv.24','Lv.24'];
    $$('#partyParts .characterCard').forEach((card,i)=>{
      const meta=card.querySelector('.charMeta');if(meta)meta.textContent=levels[i]||'';
    });
  }

  function syncAll(){
    ensureLore();
    syncDailyStatus();
    syncMissions();
    syncParty();
  }

  function observe(){
    const mo=new MutationObserver(()=>requestAnimationFrame(syncAll));
    ['#dailyText','#dailyBar','#weeklyText','#weeklyBar','#partyParts','#dq0t','#dq1t','#dq2t','#wq0t','#wq1t','#wq2t','#sq0t','#sq1t','#sq2t'].forEach(sel=>{
      const e=$(sel);if(e)mo.observe(e,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class']});
    });
    $$('.quest.daily,.quest.weekly,.quest.special').forEach(e=>mo.observe(e,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']}));
  }

  function boot(){
    document.documentElement.dataset.referenceCanvas='v6';
    fitCanvas();
    buildMissions();
    syncAll();
    observe();
    const start=$('#orientationStart');if(start)start.addEventListener('click',tryLandscape);
    window.addEventListener('resize',fitCanvas,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(fitCanvas,180),{passive:true});
    if(window.visualViewport)window.visualViewport.addEventListener('resize',fitCanvas,{passive:true});
    // game.js recreates some card contents on render; keep visual labels steady.
    setInterval(()=>{syncParty();syncMissions();syncDailyStatus()},700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(boot),{once:true});
  else requestAnimationFrame(boot);
})();
