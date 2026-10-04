(function (root, factory) {
  const value = factory(
    typeof module === 'object' && module.exports ? require('./schema.js') : root.BOUKEN_NOTE_V2.schema,
    typeof module === 'object' && module.exports ? require('./battle-events.js') : root.BOUKEN_NOTE_V2.battleEvents
  );
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.saveRepository = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (schema, battleEvents) {
  'use strict';

  const KEYS = Object.freeze({ state:'bouken_note_battle_state_v2', backup:'bouken_note_battle_state_v2_backup', pending:'bouken_note_pending_battle_v2' });
  const LIMITS = Object.freeze({ maxBytes: 1500000, maxEvents: Math.min(battleEvents.LIMITS.maxEvents, battleEvents.LIMITS.maxArrayLength) });
  const PENDING_KEYS = new Set(['version','battleId','startSnapshot','events','finalSnapshot']);
  const fail = (code, message, cause) => { const error = new Error(message); error.code = code; error.cause = cause || null; throw error; };

  function encode(value, code) {
    let bytes;
    try { bytes = JSON.stringify(value); } catch (error) { fail(code || 'SERIALIZE_FAILED', 'save serialization failed', error); }
    if (typeof bytes !== 'string' || bytes.length > LIMITS.maxBytes) fail('SAVE_TOO_LARGE', 'save exceeds byte limit');
    return bytes;
  }

  function parse(bytes, code) {
    if (typeof bytes !== 'string' || bytes.length > LIMITS.maxBytes) fail(code, 'save bytes missing or too large');
    try { return JSON.parse(bytes); } catch (error) { fail(code, 'save parse failed', error); }
  }

  function validateState(state, code) {
    const result = schema.validateState(state);
    if (!result.ok) fail(code || 'INVALID_STATE', 'state schema rejected');
    return battleEvents.safeClone(state, '$state', 0);
  }

  function validatePending(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail('MALFORMED_PENDING', 'pending battle must be an object');
    Object.keys(record).forEach(key => { if (!PENDING_KEYS.has(key)) fail('MALFORMED_PENDING', 'unexpected pending battle key'); });
    if (record.version !== 1 || typeof record.battleId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(record.battleId)) fail('MALFORMED_PENDING', 'invalid pending identity');
    const start = validateState(record.startSnapshot, 'MALFORMED_PENDING');
    const finalSnapshot = validateState(record.finalSnapshot, 'MALFORMED_PENDING');
    if (!Array.isArray(record.events) || record.events.length > LIMITS.maxEvents) fail('MALFORMED_PENDING', 'invalid pending events');
    let replay;
    try { replay = battleEvents.replayBattleEvents(start, record.events, finalSnapshot); }
    catch (error) { fail('MALFORMED_PENDING', 'pending replay rejected', error); }
    if (!replay.matchesExpected) fail('MALFORMED_PENDING', 'pending final snapshot mismatch');
    return Object.freeze({ version:1, battleId:record.battleId, startSnapshot:start, events:battleEvents.safeClone(record.events, '$events', 0), finalSnapshot });
  }

  function createPending(startSnapshot, result) {
    if (!result || result.battleId === undefined) fail('INVALID_RESULT', 'battle result missing');
    return validatePending({ version:1, battleId:result.battleId, startSnapshot, events:result.events, finalSnapshot:result.finalSnapshot });
  }

  function create(storage) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') fail('INVALID_STORAGE', 'storage adapter incomplete');
    const read = key => { try { return storage.getItem(key); } catch (error) { fail('STORAGE_READ_FAILED', 'storage read failed', error); } };
    const write = (key, bytes) => { try { storage.setItem(key, bytes); } catch (error) { fail('STORAGE_WRITE_FAILED', 'storage write failed', error); } };
    const remove = key => { try { storage.removeItem(key); } catch (error) { fail('STORAGE_WRITE_FAILED', 'storage remove failed', error); } };

    function loadState() {
      const primary = read(KEYS.state);
      try { return Object.freeze({ state:validateState(parse(primary, 'STATE_PARSE_FAILED')), recoveredFromBackup:false }); }
      catch (primaryError) {
        const backup = read(KEYS.backup);
        if (backup === null) throw primaryError;
        try { return Object.freeze({ state:validateState(parse(backup, 'BACKUP_PARSE_FAILED')), recoveredFromBackup:true }); }
        catch (_) { throw primaryError; }
      }
    }

    function saveInitialState(state) {
      const candidate = validateState(state);
      const bytes = encode(candidate);
      const existing = read(KEYS.state);
      if (existing !== null) fail('STATE_ALREADY_EXISTS', 'initial state already exists');
      write(KEYS.state, bytes);
      if (read(KEYS.state) !== bytes) fail('STORAGE_VERIFY_FAILED', 'initial state verification failed');
      return candidate;
    }

    function loadPending() {
      const bytes = read(KEYS.pending);
      if (bytes === null) return null;
      return validatePending(parse(bytes, 'MALFORMED_PENDING'));
    }

    function persistPending(record) {
      const candidate = validatePending(record);
      if (read(KEYS.pending) !== null) fail('PENDING_ALREADY_EXISTS', 'another pending battle exists');
      const bytes = encode(candidate);
      write(KEYS.pending, bytes);
      if (read(KEYS.pending) !== bytes) fail('STORAGE_VERIFY_FAILED', 'pending battle verification failed');
      return candidate;
    }

    function commitPending(battleId) {
      const pending = loadPending();
      if (!pending) fail('NO_PENDING_BATTLE', 'pending battle not found');
      if (pending.battleId !== battleId) fail('PENDING_ID_MISMATCH', 'pending battle id mismatch');
      const current = loadState().state;
      if (battleEvents.deepEqual(current, pending.finalSnapshot)) {
        remove(KEYS.pending);
        return pending.finalSnapshot;
      }
      if (!battleEvents.deepEqual(current, pending.startSnapshot)) fail('STATE_CONFLICT', 'authoritative state no longer matches battle start');
      const currentBytes = encode(current);
      const finalBytes = encode(pending.finalSnapshot);
      write(KEYS.backup, currentBytes);
      write(KEYS.state, finalBytes);
      if (read(KEYS.state) !== finalBytes) fail('STORAGE_VERIFY_FAILED', 'final state verification failed');
      remove(KEYS.pending);
      return pending.finalSnapshot;
    }

    function commitStateTransition(expectedState, nextState, validateTransition) {
      if (loadPending() !== null) fail('NON_BATTLE_PENDING', 'pending battle blocks State transition');
      const current = loadState().state;
      if (!battleEvents.deepEqual(current, expectedState)) fail('STATE_CONFLICT', 'stale expected State');
      if (typeof validateTransition !== 'function') fail('TRANSITION_POLICY_REQUIRED', 'domain invariant required');
      const candidate = battleEvents.safeClone(nextState, '$nextState', 0);
      if (validateTransition(battleEvents.safeClone(current), battleEvents.safeClone(candidate)) !== true)
        fail('INVALID_STATE_TRANSITION', 'domain invariant rejected');
      validateState(candidate);
      // Exact equality is an idempotent no-op, never a field merge.
      if (battleEvents.deepEqual(current,candidate)) return candidate;
      const currentBytes = encode(current), nextBytes = encode(candidate);
      write(KEYS.backup,currentBytes);
      if (read(KEYS.backup) !== currentBytes) fail('STORAGE_VERIFY_FAILED','backup verification failed');
      write(KEYS.state,nextBytes);
      if (read(KEYS.state) !== nextBytes) fail('STORAGE_VERIFY_FAILED','State transition verification failed');
      return candidate;
    }

    return Object.freeze({ loadState, saveInitialState, loadPending, persistPending, commitPending, commitStateTransition });
  }

  return Object.freeze({ KEYS, LIMITS, createPending, validatePending, create });
});
