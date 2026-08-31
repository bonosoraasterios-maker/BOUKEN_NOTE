(function(){
  'use strict';
  const gate=()=>document.getElementById('orientationGate');
  const text=()=>document.getElementById('orientationText');
  const btn=()=>document.getElementById('orientationStart');

  function isLandscape(){
    return window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
  }

  async function tryLandscapeLock(){
    /* ScreenOrientation.lock is not available in current iPhone Safari.
       Keep this progressive enhancement for Android / future standalone builds. */
    try{
      if(screen.orientation && typeof screen.orientation.lock==='function'){
        await screen.orientation.lock('landscape');
        return true;
      }
    }catch(e){}
    return false;
  }

  function syncGate(){
    const g=gate();
    if(!g)return;
    if(isLandscape()){
      g.setAttribute('aria-hidden','true');
      const game=document.getElementById('g');
      if(game)game.setAttribute('data-landscape-ready','1');
    }else{
      g.setAttribute('aria-hidden','false');
      const t=text();
      if(t)t.textContent='端末を横向きにしてください';
    }
  }

  async function start(){
    const locked=await tryLandscapeLock();
    if(!locked && !isLandscape()){
      const t=text();
      if(t)t.textContent='この端末では自動回転できません。端末を横向きにしてください';
    }
    syncGate();
  }

  function bindMissionEditButtons(){
    document.querySelectorAll('.missionEdit').forEach(b=>{
      b.addEventListener('click',()=>{
        const open=document.getElementById('openUiModal');
        if(open)open.click();
      });
    });
  }

  function boot(){
    const b=btn();
    if(b)b.addEventListener('click',start);
    window.addEventListener('orientationchange',()=>setTimeout(syncGate,80));
    window.addEventListener('resize',syncGate,{passive:true});
    bindMissionEditButtons();
    syncGate();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
