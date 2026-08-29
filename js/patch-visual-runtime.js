(function(){
  function ensureWeeklyVisual(){
    const scene=document.getElementById('scene');
    if(!scene)return;

    const legacy=scene.querySelector('.weeklyMirrorArm');
    if(legacy)legacy.remove();

    if(!scene.querySelector('.weeklyOriginalArt')){
      const a=document.createElement('div');
      a.className='weeklyOriginalArt';
      a.setAttribute('aria-hidden','true');
      scene.appendChild(a);
    }

    if(!scene.querySelector('#weeklyFootStatus')){
      const s=document.createElement('div');
      s.id='weeklyFootStatus';
      s.className='weeklyFootStatus';
      s.innerHTML=
        '<div class="wname">虚空統べるセレスティア</div>'+
        '<div class="wrow"><span>HP</span><b id="weeklyFootText">4000/4000</b></div>'+
        '<div class="wbar"><i id="weeklyFootBar" style="width:100%"></i></div>';
      scene.appendChild(s);
    }
  }

  function syncWeeklyFoot(){
    const out=document.getElementById('weeklyFootText');
    const outBar=document.getElementById('weeklyFootBar');
    const source=document.getElementById('weeklyText');
    const sourceBar=document.getElementById('weeklyBar');

    if(out&&source){
      const m=(source.textContent||'').match(/(\d[\d,]*)\/(\d[\d,]*)/);
      if(m){
        const next=m[1]+'/'+m[2];
        if(out.textContent!==next)out.textContent=next;
      }
    }

    if(outBar&&sourceBar){
      const next=sourceBar.style.width||'100%';
      if(outBar.style.width!==next)outBar.style.width=next;
    }
  }

  function refreshWeeklyVisual(){
    ensureWeeklyVisual();
    syncWeeklyFoot();
  }

  function boot(){
    refreshWeeklyVisual();

    /* v23.24 bug fix:
       Do NOT observe style mutations here.
       The previous observer watched #weeklyFootBar style and then rewrote
       that same style, producing a recursive MutationObserver loop in
       LiveCodes/Safari. */
    const originalRender=window.render;
    if(typeof originalRender==='function'&&!window.__v2325RenderPatched){
      window.render=function(){
        const result=originalRender.apply(this,arguments);
        requestAnimationFrame(refreshWeeklyVisual);
        return result;
      };
      window.__v2325RenderPatched=true;
    }

    /* Lightweight fallback for any state change that bypasses render().
       No MutationObserver and no self-triggering DOM loop. */
    clearInterval(window.__v2325WeeklySyncTimer);
    window.__v2325WeeklySyncTimer=setInterval(syncWeeklyFoot,700);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
