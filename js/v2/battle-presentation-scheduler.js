(function (root, factory) {
  const value = factory(
    typeof module === 'object' && module.exports ? require('./battle-fx-adapter.js') : root.BOUKEN_NOTE_V2.battleFxAdapter
  );
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.battlePresentationScheduler = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (battleFxAdapter) {
  'use strict';

  // Timers are deliberately confined here. The controller, calculator, saved
  // pending record, and event reducer remain deterministic and timer-free.
  function defaultWait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
  function durationFor(payload) {
    if (!payload || !payload.event || !payload.snapshot) return 0;
    const cues = battleFxAdapter.cuesFor(payload);
    return cues.reduce((maximum, item) => Math.max(maximum, item.durationMs), 0);
  }
  function stoppedError(status) {
    const error = new Error('event player stopped safely');
    error.code = 'PLAYER_STOPPED';
    error.cause = status && status.error;
    return error;
  }

  function create(options) {
    if (!options || !options.controller) throw new TypeError('controller required');
    const controller = options.controller;
    const wait = typeof options.wait === 'function' ? options.wait : defaultWait;
    const onState = typeof options.onState === 'function' ? options.onState : function () {};
    const getDuration = typeof options.durationFor === 'function' ? options.durationFor : durationFor;
    let running = false;
    let generation = 0;

    function emit(state) { onState(Object.freeze({ running, state:state || null })); }
    async function replay(token) {
      while (token === generation) {
        const status = controller.step();
        emit(status);
        if (status.stopped) throw stoppedError(status);
        const requestedDuration = getDuration(status.lastPayload);
        const duration = Math.max(0, Number.isFinite(requestedDuration) ? requestedDuration : 0);
        if (duration > 0) await wait(duration);
        if (token !== generation) return null;
        if (status.done) {
          const finalSnapshot = controller.finalize();
          emit(null);
          return finalSnapshot;
        }
      }
      return null;
    }
    function run() {
      if (running) { const error = new Error('presentation scheduler is already running'); error.code = 'SCHEDULER_RUNNING'; throw error; }
      running = true;
      const token = ++generation;
      emit(null);
      return replay(token).finally(() => { if (token === generation) { running = false; emit(null); } });
    }
    function attack(input, definitions, rngSeed) { controller.attack(input, definitions, rngSeed); return run(); }
    function recover() { const status = controller.recover(); return status ? run() : null; }
    function skip() {
      generation += 1;
      running = false;
      const finalSnapshot = controller.skip();
      emit(null);
      return finalSnapshot;
    }
    return Object.freeze({ attack, recover, run, skip, isRunning:() => running, durationFor });
  }

  return Object.freeze({ create, durationFor });
});
