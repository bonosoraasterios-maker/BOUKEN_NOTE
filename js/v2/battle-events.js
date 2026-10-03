(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.battleEvents = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LIMITS = Object.freeze({ maxEvents: 2048, maxMutationsPerEvent: 24, maxPathDepth: 10, maxArrayLength: 256, maxObjectKeys: 256, maxDepth: 20 });
  const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const MUTABLE_ROOTS = new Set(['charactersById', 'enemiesById', 'enemyOrder', 'statusInstances', 'battleProgress', 'leaderCarry', 'missions']);
  const EVENT_KEYS = new Set(['eventId', 'slot', 'type', 'actor', 'target', 'payload', 'mutations']);
  const MUTATION_KEYS = new Set(['op', 'path', 'before', 'after']);
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function assertSafeKey(key, path) {
    if (typeof key !== 'string' || !key.length || key.length > 128 || DANGEROUS_KEYS.has(key)) throw new TypeError(`unsafe key at ${path}`);
  }

  function safeClone(value, path, depth) {
    const here = path || '$';
    const level = depth || 0;
    if (level > LIMITS.maxDepth) throw new RangeError(`maximum depth exceeded at ${here}`);
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError(`non-finite number at ${here}`);
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length > LIMITS.maxArrayLength) throw new RangeError(`array too long at ${here}`);
      return value.map((item, i) => safeClone(item, `${here}[${i}]`, level + 1));
    }
    if (typeof value !== 'object') throw new TypeError(`unsupported value at ${here}`);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError(`non-plain object at ${here}`);
    const keys = Object.keys(value);
    if (keys.length > LIMITS.maxObjectKeys) throw new RangeError(`too many keys at ${here}`);
    const copy = Object.create(null);
    keys.forEach(key => {
      assertSafeKey(key, `${here}.${key}`);
      copy[key] = safeClone(value[key], `${here}.${key}`, level + 1);
    });
    return copy;
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== typeof b || a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    if (typeof a !== 'object') return false;
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every(key => own(b, key) && deepEqual(a[key], b[key]));
  }

  function assertExactKeys(obj, allowed, path) {
    Object.keys(obj).forEach(key => { if (!allowed.has(key)) throw new TypeError(`unexpected key ${path}.${key}`); });
  }

  function validatePath(path) {
    if (!Array.isArray(path) || path.length < 1 || path.length > LIMITS.maxPathDepth) throw new TypeError('invalid mutation path');
    if (!MUTABLE_ROOTS.has(path[0])) throw new TypeError('mutation root is not allowed');
    path.forEach((segment, i) => {
      if (typeof segment === 'number') {
        if (!Number.isInteger(segment) || segment < 0 || segment >= LIMITS.maxArrayLength) throw new RangeError('invalid array path index');
      } else assertSafeKey(segment, `mutation.path[${i}]`);
    });
  }

  function resolveParent(root, path) {
    let cursor = root;
    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      if (cursor === null || typeof cursor !== 'object' || !own(cursor, segment)) throw new TypeError('mutation path does not exist');
      cursor = cursor[segment];
    }
    return { parent: cursor, key: path[path.length - 1] };
  }

  function validateEvent(event, expectedIndex) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('event must be an object');
    assertExactKeys(event, EVENT_KEYS, 'event');
    if (event.eventId !== `event-${expectedIndex}`) throw new TypeError('non-sequential eventId');
    if (!Number.isInteger(event.slot) || event.slot < 0 || event.slot > 4) throw new RangeError('invalid event slot');
    if (typeof event.type !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/.test(event.type)) throw new TypeError('invalid event type');
    if (event.actor !== null && typeof event.actor !== 'string') throw new TypeError('invalid event actor');
    if (event.target !== null && typeof event.target !== 'string' && !Array.isArray(event.target)) throw new TypeError('invalid event target');
    safeClone(event.payload, 'event.payload', 0);
    if (!Array.isArray(event.mutations) || event.mutations.length > LIMITS.maxMutationsPerEvent) throw new RangeError('invalid mutation count');
    event.mutations.forEach((mutation, i) => {
      if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) throw new TypeError('mutation must be an object');
      assertExactKeys(mutation, MUTATION_KEYS, `mutation[${i}]`);
      if (mutation.op !== 'set' && mutation.op !== 'delete') throw new TypeError('invalid mutation operation');
      validatePath(mutation.path);
      safeClone(mutation.before, `mutation[${i}].before`, 0);
      if (mutation.op === 'set') safeClone(mutation.after, `mutation[${i}].after`, 0);
    });
    return true;
  }

  function applyBattleEvent(snapshot, event, expectedIndex) {
    validateEvent(event, expectedIndex);
    const next = safeClone(snapshot, '$snapshot', 0);
    event.mutations.forEach(mutation => {
      const resolved = resolveParent(next, mutation.path);
      const exists = own(resolved.parent, resolved.key);
      const current = exists ? resolved.parent[resolved.key] : undefined;
      if (!deepEqual(current, mutation.before)) throw new Error(`event precondition failed at ${mutation.path.join('.')}`);
      if (mutation.op === 'delete') delete resolved.parent[resolved.key];
      else resolved.parent[resolved.key] = safeClone(mutation.after, '$mutation.after', 0);
    });
    return next;
  }

  function replayBattleEvents(snapshot, events, expectedFinalSnapshot) {
    if (!Array.isArray(events) || events.length > LIMITS.maxEvents) throw new RangeError('event list too long');
    let current = safeClone(snapshot, '$snapshot', 0);
    events.forEach((event, index) => { current = applyBattleEvent(current, event, index); });
    const matches = expectedFinalSnapshot === undefined ? null : deepEqual(current, expectedFinalSnapshot);
    return Object.freeze({ snapshot: current, matchesExpected: matches });
  }

  return Object.freeze({ LIMITS, safeClone, deepEqual, validateEvent, applyBattleEvent, replayBattleEvents });
});
