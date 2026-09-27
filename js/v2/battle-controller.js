(function (root, factory) {
  const value = factory(
    typeof module === 'object' && module.exports ? require('./battle-events.js') : root.BOUKEN_NOTE_V2.battleEvents,
    typeof module === 'object' && module.exports ? require('./save-repository.js') : root.BOUKEN_NOTE_V2.saveRepository,
    typeof module === 'object' && module.exports ? require('./battle-event-player.js') : root.BOUKEN_NOTE_V2.battleEventPlayer
  );
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.battleController = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (battleEvents, saveRepository, eventPlayer) {
  'use strict';

  function create(options) {
    if (!options || !options.repository || typeof options.calculateBattle !== 'function') throw new TypeError('controller dependencies missing');
    const repository = options.repository;
    const calculateBattle = options.calculateBattle;
    const present = options.present;
    let locked = false;
    let active = null;

    function attach(record) { active = { record, player:eventPlayer.create(record, present) }; locked = true; return active.player.status(); }
    function attack(input, definitions, rngSeed) {
      if (locked || repository.loadPending()) { const error = new Error('battle input is locked'); error.code = 'ATTACK_LOCKED'; throw error; }
      locked = true;
      try {
        const start = repository.loadState().state;
        const result = calculateBattle(battleEvents.safeClone(start, '$battleStart', 0), input, definitions, rngSeed);
        const pending = saveRepository.createPending(start, result);
        repository.persistPending(pending);
        active = { record:pending, player:eventPlayer.create(pending, present) };
        return active.player.status();
      } catch (error) { locked = false; active = null; throw error; }
    }
    function recover() {
      if (active) return active.player.status();
      const pending = repository.loadPending();
      if (!pending) { locked = false; return null; }
      return attach(pending);
    }
    function ensureActive() { if (!active) recover(); if (!active) { const error = new Error('no pending battle'); error.code = 'NO_PENDING_BATTLE'; throw error; } }
    function step() { ensureActive(); return active.player.step(); }
    function complete(status) {
      if (status.stopped) { const error = new Error('event player stopped safely'); error.code = 'PLAYER_STOPPED'; error.cause = status.error; throw error; }
      if (!status.done || !battleEvents.deepEqual(status.snapshot, active.record.finalSnapshot)) { const error = new Error('presentation incomplete'); error.code = 'PRESENTATION_INCOMPLETE'; throw error; }
      const committed = repository.commitPending(active.record.battleId);
      active = null; locked = false;
      return committed;
    }
    function playAll() { ensureActive(); return complete(active.player.playAll()); }
    function skip() { ensureActive(); return complete(active.player.skip()); }
    function finalize() { ensureActive(); return complete(active.player.finish()); }
    return Object.freeze({ attack, recover, step, playAll, skip, finalize, isLocked:() => locked });
  }

  return Object.freeze({ create });
});
