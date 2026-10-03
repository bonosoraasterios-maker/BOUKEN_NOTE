(function (root, factory) {
  const value = factory(typeof module === 'object' && module.exports ? require('./battle-events.js') : root.BOUKEN_NOTE_V2.battleEvents);
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.battleEventPlayer = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (battleEvents) {
  'use strict';

  function create(record, present) {
    if (!record || !Array.isArray(record.events)) throw new TypeError('validated pending battle required');
    const notify = typeof present === 'function' ? present : function () {};
    let snapshot = battleEvents.safeClone(record.startSnapshot, '$startSnapshot', 0);
    let index = 0;
    let stopped = false;
    let error = null;
    let lastPayload = null;

    function status() {
      return Object.freeze({
        index,
        total:record.events.length,
        done:index === record.events.length,
        stopped,
        error,
        snapshot:battleEvents.safeClone(snapshot, '$presentation', 0),
        lastPayload:lastPayload ? battleEvents.safeClone(lastPayload, '$lastPayload', 0) : null
      });
    }
    function stop(cause) { stopped = true; error = cause; return status(); }
    function step() {
      if (stopped) return status();
      if (index >= record.events.length) return status();
      try {
        const event = record.events[index];
        const next = battleEvents.applyBattleEvent(snapshot, event, index);
        lastPayload = Object.freeze({ event:battleEvents.safeClone(event, '$event', 0), snapshot:battleEvents.safeClone(next, '$presentation', 0), index });
        notify(lastPayload);
        snapshot = next;
        index += 1;
        return status();
      } catch (cause) { return stop(cause); }
    }
    function playAll() { while (!stopped && index < record.events.length) step(); return finish(); }
    function skip() {
      if (stopped) return status();
      try {
        while (index < record.events.length) {
          snapshot = battleEvents.applyBattleEvent(snapshot, record.events[index], index);
          index += 1;
        }
        lastPayload = Object.freeze({ event:null, snapshot:battleEvents.safeClone(snapshot, '$presentation', 0), index, skipped:true });
        notify(lastPayload);
        return finish();
      } catch (cause) { return stop(cause); }
    }
    function finish() {
      if (!stopped && index === record.events.length && !battleEvents.deepEqual(snapshot, record.finalSnapshot)) return stop(new Error('presentation snapshot mismatch'));
      return status();
    }
    return Object.freeze({ step, playAll, skip, finish, status });
  }

  return Object.freeze({ create });
});
