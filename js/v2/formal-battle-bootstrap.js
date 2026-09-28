(function (root, factory) {
  const value = factory(
    typeof module === 'object' && module.exports ? require('./formal-battle-ui.js') : root.BOUKEN_NOTE_V2.formalBattleUi,
    typeof module === 'object' && module.exports ? require('./battle-presentation-scheduler.js') : root.BOUKEN_NOTE_V2.battlePresentationScheduler
  );
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.formalBattleBootstrap = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (formalBattleUi, battlePresentationScheduler) {
  'use strict';

  const DEFAULT_CONFIG = Object.freeze({ formalBattleV2:false, verificationMode:false });
  function start(options) {
    const config = options && options.config ? options.config : DEFAULT_CONFIG;
    let scheduler = null;
    const ui = formalBattleUi.mountIfEnabled({
      document:options && options.document,
      host:options && options.host,
      definitions:options && options.definitions,
      allowNonFormalPreviewAssets:options && options.allowNonFormalPreviewAssets === true,
      onAttack:function () {
        if (scheduler && options && typeof options.attackRequest === 'function') {
          const request = options.attackRequest();
          scheduler.attack(request.input, request.definitions, request.rngSeed);
        } else if (options && typeof options.onAttack === 'function') options.onAttack();
      },
      featureFlags:{ formalBattleV2:config.formalBattleV2 === true },
      verificationMode:config.verificationMode === true
    });
    if (!ui || !options || !options.controller) return ui;
    options.controller.setPresenter(ui.present);
    scheduler = battlePresentationScheduler.create({
      controller:options.controller,
      wait:options.wait,
      onState:function (state) { ui.setLocked(state.running || options.controller.isLocked()); }
    });
    return Object.freeze({ ui, scheduler });
  }
  return Object.freeze({ DEFAULT_CONFIG, start });
});
