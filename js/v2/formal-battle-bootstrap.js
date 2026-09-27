(function (root, factory) {
  const value = factory(
    typeof module === 'object' && module.exports ? require('./formal-battle-ui.js') : root.BOUKEN_NOTE_V2.formalBattleUi
  );
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.formalBattleBootstrap = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (formalBattleUi) {
  'use strict';

  const DEFAULT_CONFIG = Object.freeze({ formalBattleV2:false, verificationMode:false });
  function start(options) {
    const config = options && options.config ? options.config : DEFAULT_CONFIG;
    return formalBattleUi.mountIfEnabled({
      document:options && options.document,
      host:options && options.host,
      definitions:options && options.definitions,
      onAttack:options && options.onAttack,
      featureFlags:{ formalBattleV2:config.formalBattleV2 === true },
      verificationMode:config.verificationMode === true
    });
  }
  return Object.freeze({ DEFAULT_CONFIG, start });
});
