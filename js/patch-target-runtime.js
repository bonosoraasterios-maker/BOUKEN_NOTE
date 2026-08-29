(function(){
  function ensureTargetMeta(){
    const scene=document.getElementById('scene');
    if(!scene)return;
    if(!scene.querySelector('.targetLoreMeta')){
      const el=document.createElement('div');
      el.className='targetLoreMeta';
      el.innerHTML='<div class="chapter">第12章　星界の門</div><div class="wave">WAVE 1/1</div>';
      scene.appendChild(el);
    }
    if(!scene.querySelector('#dailyFootStatus')){
      const s=document.createElement('div');
      s.id='dailyFootStatus';
      s.className='dailyFootStatus';
      s.innerHTML='<div class="dname">アストラル・セントリー</div><div class="drow"><span>HP</span><b id="dailyFootText">0/0</b></div><div class="dbar"><i id="dailyFootBar"></i></div>';
      scene.appendChild(s);
    }
  }
  function syncDaily(){
    const src=document.getElementById('dailyText');
    const srcBar=document.getElementById('dailyBar');
    const out=document.getElementById('dailyFootText');
    const outBar=document.getElementById('dailyFootBar');
    const box=document.getElementById('dailyFootStatus');
    if(src&&out){
      const m=(src.textContent||'').match(/(\d[\d,]*)\/(\d[\d,]*)/);
      out.textContent=m?(m[1]+'/'+m[2]):'撃破済み';
      if(box)box.style.opacity=m?'1':'.45';
    }
    if(srcBar&&outBar)outBar.style.width=srcBar.style.width||'0%';
  }
  function boot(){
    ensureTargetMeta();
    syncDaily();
    clearInterval(window.__bnTargetSync);
    window.__bnTargetSync=setInterval(syncDaily,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
