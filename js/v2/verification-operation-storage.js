(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.verificationOperationStorage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCENARIO='stage2a-daily1',KEY='bouken_note_app_operation_v2';
  function create(storage){
    if(!storage)throw Object.assign(new Error('SESSION_STORAGE_UNAVAILABLE'),{code:'SESSION_STORAGE_UNAVAILABLE'});
    const physical=key=>{if(key!==KEY)throw Object.assign(new Error('UNKNOWN_OPERATION_KEY'),{code:'UNKNOWN_OPERATION_KEY'});return 'bn2:verification:'+SCENARIO+':'+key;};
    return Object.freeze({getItem:key=>storage.getItem(physical(key)),setItem:(key,value)=>storage.setItem(physical(key),value),removeItem:key=>storage.removeItem(physical(key))});
  }
  return Object.freeze({SCENARIO,KEY,create});
});
