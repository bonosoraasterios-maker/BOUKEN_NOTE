/* BOUKEN NOTE PATCH 05 — REFERENCE CANVAS REBUILD
   Keeps gameplay/state in js/game.js. This file only owns logical-canvas fit + V5 visual sync. */
(function(){
  'use strict';
  const W=1672,H=941;
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));

  function fitCanvas(){
    const root=$('#g'); if(!root)return;
    const vv=window.visualViewport;
    const vw=vv?vv.width:window.innerWidth;
    const vh=vv?vv.height:window.innerHeight;
    const scale=Math.max(.08,Math.min(vw/W,vh/H));
    root.style.setProperty('--v5-scale',String(scale));
  }

  async function tryLandscape(){
    try{
      if(document.documentElement.requestFullscreen && !document.fullscreenElement){
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
    if(!lore.querySelector('.v5Chapter')){const e=document.createElement('div');e.className='v5Chapter';e.textContent='第12章　星界の門';lore.appendChild(e)}
    if(!lore.querySelector('.v5Wave')){const e=document.createElement('div');e.className='v5Wave';e.textContent='WAVE 1/1';lore.appendChild(e)}
  }

  function ensureDailyStatus(){
    const scene=$('#scene');if(!scene)return null;
    let s=scene.querySelector('.v5DailyStatus');
    if(!s){
      s=document.createElement('div');s.className='v5DailyStatus';
      s.innerHTML='<div class="v5EnemyName">虚空のコアユニット</div><div class="v5HpLine"><span>HP</span><b class="v5HpText">800/800</b></div><div class="v5HpTrack"><i></i></div>';
      scene.appendChild(s);
    }
    return s;
  }

  function syncDailyStatus(){
    const s=ensureDailyStatus();if(!s)return;
    const source=$('#dailyText');const sourceBar=$('#dailyBar');
    const txt=source?(source.textContent||''):'';
    const m=txt.match(/(\d[\d,]*)\/(\d[\d,]*)/);
    const out=s.querySelector('.v5HpText');
    if(m){out.textContent=m[1]+'/'+m[2];s.style.opacity='1'}
    else{out.textContent='0/800';s.style.opacity='.38'}
    const fill=s.querySelector('.v5HpTrack i');
    if(fill)fill.style.width=(sourceBar&&sourceBar.style.width)||'0%';
  }

  function syncPartyMeta(){
    const levels=['Lv.26','Lv.24','Lv.24'];
    $$('#partyParts .characterCard').forEach((card,i)=>{
      const meta=card.querySelector('.charMeta');if(meta&&meta.textContent!==levels[i])meta.textContent=levels[i]||'';
    });
  }

  function wireMissionEditors(){
    $$('.missionEdit').forEach(b=>{
      if(b.dataset.v5Wired)return;b.dataset.v5Wired='1';
      b.addEventListener('click',()=>{const open=$('#openUiModal');if(open)open.click()});
    });
  }

  function syncAll(){
    ensureLore();
    syncDailyStatus();
    syncPartyMeta();
    wireMissionEditors();
  }

  function observeRuntime(){
    const targets=['#dailyText','#dailyBar','#partyParts','#coin','#weeklyFootText','#weeklyFootBar'];
    const mo=new MutationObserver(()=>requestAnimationFrame(syncAll));
    targets.forEach(sel=>{const e=$(sel);if(e)mo.observe(e,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class']})});
  }

  function boot(){
    document.documentElement.dataset.referenceCanvas='v5';
    fitCanvas();
    ensureLore();
    syncAll();
    observeRuntime();
    const start=$('#orientationStart');if(start)start.addEventListener('click',tryLandscape);
    window.addEventListener('resize',fitCanvas,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(fitCanvas,180),{passive:true});
    if(window.visualViewport)window.visualViewport.addEventListener('resize',fitCanvas,{passive:true});
    // game.js rebuilds character-card metadata on every render, so keep a very light visual-only sync.
    window.setInterval(syncPartyMeta,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(boot),{once:true});
  else requestAnimationFrame(boot);
})();
