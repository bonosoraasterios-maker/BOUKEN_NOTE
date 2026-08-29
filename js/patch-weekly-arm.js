(function(){
  function installWeeklyMirrorArm(){
    const scene=document.getElementById('scene');
    if(!scene||scene.querySelector('.weeklyMirrorArm'))return;
    const bg=getComputedStyle(scene).backgroundImage||'';
    const m=bg.match(/url\(["']?(data:image\/[^"')]+)["']?\)/i);
    if(!m)return;
    const wrap=document.createElement('div');
    wrap.className='weeklyMirrorArm';
    wrap.setAttribute('aria-hidden','true');
    const img=document.createElement('img');
    img.alt='';
    img.src=m[1];
    wrap.appendChild(img);
    scene.appendChild(wrap);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installWeeklyMirrorArm,{once:true});
  else installWeeklyMirrorArm();
})();
