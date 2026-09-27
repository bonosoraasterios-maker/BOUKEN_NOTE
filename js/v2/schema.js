(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.schema = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATUS_IDS = new Set(['poison', 'burn', 'freeze', 'bind', 'gravity', 'finalHour']);
  const SLOT_IDS = ['protagonist', 'supporter', 'defender', 'attacker'];
  const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const STATE_KEYS = new Set(['schemaVersion','revision','writtenAt','definitionsVersion','featureFlags','profile','calendar','partySlots','charactersById','enemiesById','enemyOrder','missions','battleProgress','leaderCarry','statusInstances','pendingBattle','migration']);
  const CHARACTER_KEYS = new Set(['characterId','hp','sp','barrier','statusIds','resources','flags','weekly','battle']);
  const ENEMY_KEYS = new Set(['instanceId','definitionId','kind','hp','maxHp','barrier','phase','statusIds','spawnedOn','defeated','flags']);
  const STATUS_KEYS = new Set(['instanceId','statusId','ownerType','ownerId','sourceType','sourceId','severity','appliedBattleId','counters','payload','persistsAcrossBattle','clearsAtWeekStart']);
  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isInt = v => Number.isInteger(v);
  const issue = (path, message) => ({ path, message });

  function scanSafety(value, path, depth, errors) {
    if (depth > 20) { errors.push(issue(path, 'maximum depth exceeded')); return; }
    if (typeof value === 'number' && !Number.isFinite(value)) { errors.push(issue(path, 'number must be finite')); return; }
    if (value === null || ['string','boolean','number'].includes(typeof value)) return;
    if (Array.isArray(value)) {
      if (value.length > 256) { errors.push(issue(path, 'array length exceeds 256')); return; }
      value.forEach((item, i) => scanSafety(item, `${path}[${i}]`, depth + 1, errors));
      return;
    }
    if (typeof value !== 'object') { errors.push(issue(path, 'unsupported value type')); return; }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) { errors.push(issue(path, 'non-plain object rejected')); return; }
    const keys = Object.keys(value);
    if (keys.length > 256) { errors.push(issue(path, 'object key count exceeds 256')); return; }
    keys.forEach(key => {
      if (DANGEROUS_KEYS.has(key)) errors.push(issue(`${path}.${key}`, 'dangerous key rejected'));
      else scanSafety(value[key], `${path}.${key}`, depth + 1, errors);
    });
  }

  function rejectUnexpected(object, allowed, path, errors) {
    if (!isObject(object)) return;
    Object.keys(object).forEach(key => { if (!allowed.has(key)) errors.push(issue(`${path}.${key}`, 'unexpected key')); });
  }

  function validateDefinitions(bundle) {
    const errors = [];
    if (!isObject(bundle)) return { ok: false, errors: [issue('$', 'definition bundle must be an object')] };
    scanSafety(bundle, '$definitions', 0, errors);
    const versions = Object.entries(bundle).filter(([,v]) => isObject(v)).map(([k,v]) => [k, v.definitionsVersion]);
    versions.forEach(([k,v]) => { if (v !== '2026-09-26-1117') errors.push(issue(k, 'unexpected definitionsVersion')); });
    const characters = bundle.characters && bundle.characters.characters;
    if (!isObject(characters)) errors.push(issue('characters', 'characters missing'));
    else Object.entries(characters).forEach(([id,c]) => {
      if (c.id !== id) errors.push(issue(`characters.${id}.id`, 'id mismatch'));
      if (id === 'sora' && (c.maxHp !== null || c.maxSp !== null)) errors.push(issue(`characters.${id}`, 'Sora must not have HP or SP'));
      if (id === 'elliott' && c.maxSp !== null) errors.push(issue(`characters.${id}.maxSp`, 'Elliott must not have SP'));
      if (!['sora','elliott'].includes(id) && c.maxSp !== 5) errors.push(issue(`characters.${id}.maxSp`, 'normal SP cap must be 5'));
    });
    const effects = bundle.statusEffects && bundle.statusEffects.effects;
    if (!isObject(effects) || Object.keys(effects).length !== 6) errors.push(issue('statusEffects', 'exactly six formal statuses required'));
    else Object.keys(effects).forEach(id => { if (!STATUS_IDS.has(id)) errors.push(issue(`statusEffects.${id}`, 'non-formal status id')); });
    const enemies = bundle.enemies && bundle.enemies.enemies;
    if (!isObject(enemies)) errors.push(issue('enemies', 'enemies missing'));
    else Object.entries(enemies).forEach(([id, enemy]) => { if (enemy.id !== id) errors.push(issue(`enemies.${id}.id`, 'id mismatch')); });
    const skills = bundle.skills && bundle.skills.byId;
    if (!isObject(skills)) errors.push(issue('skills', 'skills missing'));
    else Object.entries(skills).forEach(([id, skill]) => {
      if (skill.id !== id) errors.push(issue(`skills.${id}.id`, 'id mismatch'));
      if (!characters || !characters[skill.ownerId]) errors.push(issue(`skills.${id}.ownerId`, 'unknown owner'));
    });
    return { ok: errors.length === 0, errors };
  }

  function validateState(state) {
    const errors = [];
    if (!isObject(state)) return { ok: false, errors: [issue('$', 'state must be an object')] };
    scanSafety(state, '$', 0, errors);
    rejectUnexpected(state, STATE_KEYS, '$', errors);
    if (state.schemaVersion !== 2) errors.push(issue('schemaVersion', 'must be 2'));
    if (state.definitionsVersion !== '2026-09-26-1117') errors.push(issue('definitionsVersion', 'must match 1117'));
    if (!isObject(state.featureFlags) || state.featureFlags.formalBattleV2 !== false) errors.push(issue('featureFlags.formalBattleV2', 'must default to false during migration'));
    if (!isObject(state.partySlots)) errors.push(issue('partySlots', 'missing'));
    else SLOT_IDS.forEach(slot => { if (!isObject(state.partySlots[slot]) || !('characterId' in state.partySlots[slot])) errors.push(issue(`partySlots.${slot}`, 'missing slot')); });
    const slotCharacters = state.partySlots ? SLOT_IDS.map(k => state.partySlots[k] && state.partySlots[k].characterId).filter(Boolean) : [];
    if (new Set(slotCharacters).size !== slotCharacters.length) errors.push(issue('partySlots', 'duplicate character assignment'));
    if (!isObject(state.charactersById)) errors.push(issue('charactersById', 'missing'));
    else Object.entries(state.charactersById).forEach(([id,c]) => {
      rejectUnexpected(c, CHARACTER_KEYS, `charactersById.${id}`, errors);
      if (c.characterId !== id) errors.push(issue(`charactersById.${id}.characterId`, 'id mismatch'));
      if (id === 'sora' && (c.hp !== null || c.sp !== null)) errors.push(issue(`charactersById.${id}`, 'Sora HP/SP must be null'));
      if (id === 'elliott' && c.sp !== null) errors.push(issue(`charactersById.${id}.sp`, 'Elliott SP must be null'));
      if (c.sp !== null && (!isInt(c.sp) || c.sp < 0 || c.sp > 5)) errors.push(issue(`charactersById.${id}.sp`, 'SP must be integer 0..5 or null'));
      if (!Array.isArray(c.statusIds)) errors.push(issue(`charactersById.${id}.statusIds`, 'must be an array'));
    });
    if (!isObject(state.enemiesById) || !Array.isArray(state.enemyOrder)) errors.push(issue('enemies', 'enemy map/order missing'));
    else {
      Object.entries(state.enemiesById).forEach(([id,e]) => rejectUnexpected(e, ENEMY_KEYS, `enemiesById.${id}`, errors));
      state.enemyOrder.forEach((id,i) => { if (!state.enemiesById[id]) errors.push(issue(`enemyOrder.${i}`, 'unknown enemy id')); });
      const alive = state.enemyOrder.map(id => state.enemiesById[id]).filter(e => e && !e.defeated);
      const bosses = alive.filter(e => e.kind === 'weekly' || e.kind === 'areaBoss');
      const dailies = alive.filter(e => e.kind === 'daily');
      if (alive.length > 5 || bosses.length > 1 || dailies.length > (bosses.length ? 4 : 5)) errors.push(issue('enemyOrder', 'enemy coexistence limit exceeded'));
      alive.forEach(e => {
        if (!Number.isFinite(e.hp) || !Number.isFinite(e.maxHp) || e.hp < 0 || e.hp > e.maxHp) errors.push(issue(`enemiesById.${e.instanceId}.hp`, 'invalid HP'));
      });
    }
    if (!isObject(state.statusInstances)) errors.push(issue('statusInstances', 'missing'));
    else Object.entries(state.statusInstances).forEach(([id,s]) => {
      rejectUnexpected(s, STATUS_KEYS, `statusInstances.${id}`, errors);
      if (!STATUS_IDS.has(s.statusId)) errors.push(issue(`statusInstances.${id}.statusId`, 'non-formal status'));
    });
    if (!isObject(state.battleProgress) || !isInt(state.battleProgress.suPoints) || state.battleProgress.suPoints < 0 || state.battleProgress.suPoints > 4) errors.push(issue('battleProgress.suPoints', 'must be integer 0..4'));
    if (!isObject(state.migration) || state.migration.sourceKey !== 'bouken_note_v23_20_battle_system') errors.push(issue('migration', 'migration audit missing'));
    return { ok: errors.length === 0, errors };
  }

  return Object.freeze({ SCHEMA_VERSION: 2, DEFINITIONS_VERSION: '2026-09-26-1117', validateDefinitions, validateState });
});
