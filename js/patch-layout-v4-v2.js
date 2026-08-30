/* PATCH 04 V2 coordinate lock — visual-only helper. */
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const REF={
    canvas:{w:1672,h:941},
    hudTop:535,
    hudTopPercent:56.854,
    version:'REFERENCE_PARTS_V2'
  };
  window.BN_REFERENCE_LAYOUT_V2=REF;

  function sync(){
    const g=$('#g');
    if(g){
      g.dataset.layout='reference-v2-coordinate-lock';
      g.dataset.reference='1672x941';
    }
    const daily=$('.missionFrameDaily');
    const weekly=$('.missionFrameWeekly');
    const special=$('.missionFrameSpecial');
    if(daily) daily.dataset.sub=`毎日リセット（${$$('.quest.daily.done').length}/3）`;
    if(weekly) weekly.dataset.sub=`毎週月曜日リセット（${$$('.quest.weekly.done').length}/3）`;
    if(special) special.dataset.sub='期間限定ミッション';
  }

  function boot(){
    sync();
    clearInterval(window.__bnRefV2Sync);
    window.__bnRefV2Sync=setInterval(sync,800);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
