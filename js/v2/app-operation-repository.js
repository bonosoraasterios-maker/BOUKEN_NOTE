(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BOUKEN_NOTE_V2=root.BOUKEN_NOTE_V2||{};root.BOUKEN_NOTE_V2.appOperationRepository=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='bouken_note_app_operation_v2';
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  const identity=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value);
  function day(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
  }
  function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));}
  function validate(value){
    if(!exact(value,['version','timezone','dailyAttack'])||value.version!==1||value.timezone!=='Asia/Tokyo')fail('MALFORMED_OPERATION');
    const a=value.dailyAttack;
    if(a!==null&&(!exact(a,['dayKey','status','reservationId','battleId','dailyResult'])||!day(a.dayKey)||!['reserved','consumed'].includes(a.status)||!identity(a.reservationId)||!identity(a.battleId)||!Number.isInteger(a.dailyResult)||a.dailyResult<1||a.dailyResult>3))fail('MALFORMED_OPERATION');
    return JSON.parse(JSON.stringify(value));
  }
  function create(storage){
    if(!storage||!['getItem','setItem','removeItem'].every(k=>typeof storage[k]==='function'))fail('INVALID_OPERATION_STORAGE');
    function read(){try{return storage.getItem(KEY);}catch(_){fail('OPERATION_READ_FAILED');}}
    function load(){const bytes=read();if(bytes===null)return null;let value;try{value=JSON.parse(bytes);}catch(_){fail('MALFORMED_OPERATION');}return validate(value);}
    function save(value){const bytes=JSON.stringify(validate(value));try{storage.setItem(KEY,bytes);}catch(_){fail('OPERATION_WRITE_FAILED');}if(read()!==bytes)fail('OPERATION_VERIFY_FAILED');return validate(value);}
    function matching(a,b){return a&&b&&a.status===b.status&&a.reservationId===b.reservationId&&a.battleId===b.battleId&&a.dayKey===b.dayKey&&a.dailyResult===b.dailyResult;}
    function consume(expected){const current=load();if(!current||!matching(current.dailyAttack,expected)||expected.status!=='reserved')fail('ATTACK_RESERVATION_CONFLICT');return save({...current,dailyAttack:{...current.dailyAttack,status:'consumed'}});}
    function rollback(expected,previous){const current=load();if(!current||!matching(current.dailyAttack,expected)||expected.status!=='reserved')fail('ATTACK_RESERVATION_CONFLICT');
      if(previous!==null)return save(previous);
      try{storage.removeItem(KEY);}catch(_){fail('OPERATION_REMOVE_FAILED');}if(read()!==null)fail('OPERATION_VERIFY_FAILED');return null;
    }
    return Object.freeze({load,save,consume,rollback});
  }
  return Object.freeze({KEY,create,validate,identity});
});
