(function(){
  function ensureV29SceneLayers(){
    const scene=document.getElementById('scene');
    if(!scene)return;
    if(!scene.querySelector('.heroOriginalV29')){
      const hero=document.createElement('div');
      hero.className='heroOriginalV29';
      hero.setAttribute('aria-hidden','true');
      scene.appendChild(hero);
    }
    if(!scene.querySelector('.sceneLoreV29')){
      const lore=document.createElement('div');
      lore.className='sceneLoreV29';
      lore.innerHTML=
        '<div class="ttl">ぼうけんノート</div>';
      scene.appendChild(lore);
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensureV29SceneLayers,{once:true});
  }else{
    ensureV29SceneLayers();
  }
})();
