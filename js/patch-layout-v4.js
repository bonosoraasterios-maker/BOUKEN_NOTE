/* PATCH 04 visual-only runtime helpers.
   No battle/save/mission rewards are changed here. */
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function syncMissionSubtitles(){
    const dailyDone=$$('.quest.daily.done').length;
    const weeklyDone=$$('.quest.weekly.done').length;
    const specialDone=$$('.quest.special.done').length;
    const daily=$('.missionFrameDaily');
    const weekly=$('.missionFrameWeekly');
    const special=$('.missionFrameSpecial');
    if(daily) daily.dataset.sub=`毎日リセット（${dailyDone}/3）`;
    if(weekly) weekly.dataset.sub=`毎週月曜日リセット（${weeklyDone}/3）`;
    if(special) special.dataset.sub=specialDone?`期間限定ミッション（${specialDone}/3）`:'期間限定ミッション';
  }

  function markReferenceLayout(){
    const g=$('#g');
    if(g) g.dataset.layout='reference-v4';
    const attack=$('#attack');
    if(attack){
      attack.setAttribute('aria-label','攻撃');
      attack.title='攻撃';
    }
  }

  function boot(){
    markReferenceLayout();
    syncMissionSubtitles();
    clearInterval(window.__bnV4VisualSync);
    window.__bnV4VisualSync=setInterval(syncMissionSubtitles,700);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
