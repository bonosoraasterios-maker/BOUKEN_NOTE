(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
    root.BOUKEN_NOTE_V2.productionVerificationEntry = api;
    api.start(root).catch(function (error) { api.showStop(root.document, error); });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LEGACY_SCRIPTS = Object.freeze(['js/game.js', 'js/patch-weekly-arm.js', 'js/patch-visual-runtime.js', 'js/patch-background-runtime.js', 'js/main.js']);
  const V2_SCRIPTS = Object.freeze([
    'data/v2/characters.js', 'data/v2/enemies.js', 'data/v2/skills.js',
    'data/v2/status-effects.js', 'data/v2/battle-rules.js', 'data/v2/missions.js',
    'data/v2/formal-battle-assets.js', 'js/v2/schema.js', 'js/v2/save-migration.js',
    'js/v2/seeded-rng.js', 'js/v2/battle-events.js', 'js/v2/battle-calculator.js',
    'js/v2/save-repository.js', 'js/v2/battle-event-player.js', 'js/v2/battle-controller.js',
    'js/v2/battle-fx-adapter.js', 'js/v2/battle-presentation-scheduler.js',
    'js/v2/formal-battle-ui.js', 'js/v2/formal-battle-bootstrap.js',
    'js/v2/app-operation-repository.js', 'js/v2/verification-operation-storage.js', 'js/v2/daily-attack-gate.js'
  ]);
  const FIXTURE_INPUT = Object.freeze({battleId:'phase-g-pipeline', battleDate:'2026-09-27', dailyResult:1, attackerSkillId:null, leaderCharacterId:null});
  const FIXTURE_SEED = 'phase-g-seed';
  const fail = code => { const error = new Error(code); error.code = code; throw error; };

  function selectVerification(search) {
    const query = new URLSearchParams(search);
    return ['bn2FormalBattleV2', 'bn2VerificationMode'].every(key => {
      const values = query.getAll(key);
      return values.length === 1 && values[0] === '1';
    });
  }
  async function loadSequential(document, paths) {
    for (const path of paths) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(Object.assign(new Error('SCRIPT_LOAD_FAILED: ' + path), {code:'SCRIPT_LOAD_FAILED'}));
      document.head.appendChild(script);
    });
  }
  function verifyStylesheet(document) {
    // The link precedes this deferred entry: its load attempt has completed
    // before execution. A failed/missing sheet must never expose the V2 host.
    const link = document.getElementById('bn2-verification-css');
    try {
      if (!link || link.disabled || !link.sheet ||
          !Array.from(link.sheet.cssRules).some(rule => rule.selectorText === '.bn2-shell')) fail('V2_CSS_LOAD_FAILED');
    } catch (_) { fail('V2_CSS_LOAD_FAILED'); }
  }
  // Only the Repository's three logical keys can reach sessionStorage.
  function isolatedStorage(storage, keys, scenario) {
    if (!storage) fail('SESSION_STORAGE_UNAVAILABLE');
    const allowed = new Set(Object.values(keys));
    const physical = key => {
      if (!allowed.has(key)) fail('UNKNOWN_VERIFICATION_KEY');
      return 'bn2:verification:' + scenario + ':' + key;
    };
    const adapter = Object.freeze({
      getItem:key => storage.getItem(physical(key)),
      setItem:(key, value) => storage.setItem(physical(key), value),
      removeItem:key => storage.removeItem(physical(key))
    });
    function checkWritable() {
      // Probe only the mapped backup key, restoring its exact bytes.
      const before = adapter.getItem(keys.backup);
      const probe = before === null ? 'bn2-storage-check' : before;
      adapter.setItem(keys.backup, probe);
      if (adapter.getItem(keys.backup) !== probe) fail('STORAGE_VERIFY_FAILED');
      if (before === null) adapter.removeItem(keys.backup);
      if (adapter.getItem(keys.backup) !== before) fail('STORAGE_VERIFY_FAILED');
    }
    checkWritable();
    return Object.freeze({adapter, checkWritable});
  }
  // The existing Phase G Daily-only test source; never a formal fresh State.
  function fixtureState(v2) {
    const source = {coin:20,dailyEnemies:[{id:1,hp:800,day:'2026-09-27'}],weeklyHP:0,party:[600,1200,400],daily:[1,0,0],weekly:[0,0,0],special:[0,0,0],battlePts:0,skillSP:0,beast:null,beastQueue:[],bleed:[0,0,0],weeklyPhaseSkillUsed:false,loginDay:'2026-09-27',enemyDay:'2026-09-27',weekKey:'2026-09-21'};
    const result = v2.saveMigration.migrateLegacyToV2(JSON.stringify(source), {migratedAt:'2026-09-27T05:00:00+09:00'});
    if (!result.ok) fail('FIXTURE_MIGRATION_FAILED');
    return result.candidate;
  }
  function definitions(v2) {
    return {characters:v2.characters,enemies:v2.enemies,skills:v2.skills,statusEffects:v2.statusEffects,battleRules:v2.battleRules,missions:v2.missions};
  }
  function bootGate(v2, state, defs) {
    if (!v2.schema.validateDefinitions(defs).ok) fail('INVALID_DEFINITIONS');
    if (!v2.schema.validateState(state).ok) fail('INVALID_STATE');
    if (!state.migration || state.migration.status !== 'ready') fail('NEEDS_RESOLUTION');
  }
  function attackGate(options) {
    try {
      const {v2, repository, defs, state, input, seed} = options;
      options.checkWritable();
      bootGate(v2, state, defs);
      if (repository.loadPending() || state.pendingBattle || options.locked) fail('PENDING_NOT_RECOVERED');
      v2.battleCalculator.validateInput(input);
      v2.seededRng.seedToUint32(seed);
      v2.battleCalculator.validateBattleState(state, {
        characters:defs.characters.characters,enemies:defs.enemies.enemies,
        skillProfiles:defs.enemies.skillProfiles,skills:defs.skills.byId,
        statuses:defs.statusEffects.effects,rules:defs.battleRules
      });
      for (const enemy of Object.values(state.enemiesById)) {
        if (enemy.defeated || enemy.hp <= 0) continue;
        const definition = defs.enemies.enemies[enemy.definitionId];
        if ((enemy.kind === 'weekly' || enemy.kind === 'areaBoss') &&
            (!definition.skillProfileId || !defs.enemies.skillProfiles[definition.skillProfileId])) fail('UNCONFIGURED_ENEMY_ACTION');
      }
      if (!options.fixture) fail('GENERAL_USER_SPEC_HOLD');
      if (!v2.battleEvents.deepEqual(state, fixtureState(v2))) fail('FIXTURE_COMPLETED_OR_CHANGED');
      if (!v2.battleEvents.deepEqual(input, FIXTURE_INPUT) || seed !== FIXTURE_SEED) fail('UNAPPROVED_FIXTURE_REQUEST');
      return {ok:true, reason:'DAILY_ONLY_VERIFICATION_FIXTURE'};
    } catch (error) { return {ok:false, reason:error.code || error.message || 'ATTACK_STOP'}; }
  }
  function showStop(document, error) {
    const host = document.getElementById('bn2-verification-host');
    const target = host && !host.hidden ? host : document.body;
    const message = document.createElement('p');
    message.className = 'bn2-verification-stop';
    message.setAttribute('role', 'alert');
    message.textContent = 'STOP: ' + (error.code || error.message) + ' — queryを外してreloadすると旧runtimeへ戻ります。';
    target.appendChild(message);
  }
  function bootVerification(env, options) {
    const document = env.document, v2 = env.BOUKEN_NOTE_V2;
    const host = document.getElementById('bn2-verification-host');
    const defs = definitions(v2);
    // Raw production bytes are read once; no production storage adapter is passed on.
    const rawLegacy = env.localStorage.getItem(v2.saveMigration.LEGACY_KEY);
    const fixture = rawLegacy === null;
    const storage = isolatedStorage(env.sessionStorage, v2.saveRepository.KEYS, fixture ? 'stage2a-daily1' : 'legacy-migration');
    const repository = v2.saveRepository.create(storage.adapter);
    if (storage.adapter.getItem(v2.saveRepository.KEYS.state) === null &&
        storage.adapter.getItem(v2.saveRepository.KEYS.backup) === null) {
      if (storage.adapter.getItem(v2.saveRepository.KEYS.pending) !== null) fail('ORPHAN_PENDING');
      const migrated = fixture ? {ok:true,candidate:fixtureState(v2)} :
        v2.saveMigration.migrateLegacyToV2(rawLegacy, {migratedAt:new Date().toISOString()});
      if (!migrated.ok || !migrated.candidate) fail('MIGRATION_STOP');
      bootGate(v2, migrated.candidate, defs);
      repository.saveInitialState(migrated.candidate);
    }
    const initialSnapshot = repository.loadState().state;
    bootGate(v2, initialSnapshot, defs);
    const controller = v2.battleController.create({repository,calculateBattle:v2.battleCalculator.calculateBattle});
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const skip = document.createElement('button');
    skip.type = 'button'; skip.textContent = '演出skip'; skip.disabled = true;
    let instance, operationGate, operationRepository, stopped = null, busy = false;
    const attackRequest = () => ({input:FIXTURE_INPUT,definitions:defs,rngSeed:FIXTURE_SEED});
    function render() {
      const state = repository.loadState().state;
      instance.ui.render(state, {locked:true});
      const request = attackRequest();
      const gate = attackGate({v2,repository,defs,state,input:request.input,seed:request.rngSeed,
        fixture,checkWritable:storage.checkWritable,locked:busy || controller.isLocked()});
      const operation = fixture ? operationGate.inspect() : {ok:false,reason:gate.reason};
      instance.ui.setLocked(!!stopped || !gate.ok || !operation.ok);
      status.textContent = (fixture ? 'Stage 2A Daily1検証fixture（正式初期Stateではありません）' : '旧save migration確認専用') + ' / ' + (stopped || (!operation.ok ? operation.reason : gate.reason));
      skip.disabled = !!stopped || !controller.isLocked();
    }
    function stop(error) { stopped = error.code || error.message || 'VERIFICATION_STOP'; busy = false; instance.ui.setLocked(true); skip.disabled = true; status.textContent = 'STOP: ' + stopped; }
    function attack() {
      if (stopped || busy) return;
      try {
        const state = repository.loadState().state, request = attackRequest();
        const gate = attackGate({v2,repository,defs,state,input:request.input,seed:request.rngSeed,
          fixture,checkWritable:storage.checkWritable,locked:controller.isLocked()});
        if (!gate.ok) { render(); return; }
        busy = true;
        // Use Bootstrap's onAttack hook to own both sync errors and promise rejection.
        const running = operationGate.attack();
        skip.disabled = false;
        status.textContent = 'DAILY_ONLY_VERIFICATION_RUNNING';
        Promise.resolve(running).then(() => { busy = false; if (!stopped) render(); }).catch(stop);
      } catch (error) { stop(error); }
    }
    instance = v2.formalBattleBootstrap.start({document,host,definitions:defs,controller,
      config:{formalBattleV2:true,verificationMode:true},allowNonFormalPreviewAssets:false,
      onAttack:attack,wait:options && options.wait});
    instance.ui.root.querySelector('.bn2-topbar').appendChild(status);
    instance.ui.root.querySelector('.bn2-topbar').appendChild(skip);
    skip.addEventListener('click', () => {
      if (stopped || !controller.isLocked()) return;
      try { instance.scheduler.skip(); busy = false; render(); } catch (error) { stop(error); }
    });
    // Presenter is connected by Bootstrap. Establish its locked initial view
    // before recovery, then commit via skip, reload, render, and recheck gate.
    instance.ui.render(initialSnapshot, {locked:true});
    if (fixture) {
      operationRepository = v2.appOperationRepository.create(v2.verificationOperationStorage.create(env.sessionStorage));
      operationGate = v2.dailyAttackGate.create({
        // Explicit verification clock; no production calendar update is performed.
        clock:() => '2026-09-27T12:00:00+09:00',
        createReservationId:() => 'verification-stage2a-daily1',
        operationRepository,battleRepository:repository,
        scheduler:{attack:(input,definitions,seed) => {
          const running = instance.scheduler.attack(input,definitions,seed);
          // Bootstrap's final presentation notice can unlock its UI. Hold it
          // until the operation gate is rendered, including promotion failure.
          return Promise.resolve(running).finally(() => instance.ui.setLocked(true));
        }},definitions:defs,
        requestFactory:() => ({battleId:FIXTURE_INPUT.battleId,rngSeed:FIXTURE_SEED,
          attackerSkillId:FIXTURE_INPUT.attackerSkillId,leaderCharacterId:FIXTURE_INPUT.leaderCharacterId})
      });
      const plan = operationGate.recoveryPlan();
      if (controller.recover()) instance.scheduler.skip();
      operationGate.completeRecovery(plan);
    } else if (controller.recover()) instance.scheduler.skip();
    render();
    return Object.freeze({repository,controller,ui:instance.ui,scheduler:instance.scheduler,operationGate,operationRepository,render,attack,attackRequest});
  }
  async function start(env, options) {
    const document = env.document;
    if (!selectVerification(env.location.search)) {
      await loadSequential(document, LEGACY_SCRIPTS);
      return {mode:'legacy'};
    }
    const oldRoot = document.getElementById('g');
    const host = document.getElementById('bn2-verification-host');
    if (!oldRoot || !host || host.parentNode !== document.body) fail('INVALID_VERIFICATION_HOST');
    oldRoot.hidden = true;
    oldRoot.inert = true;
    host.hidden = true;
    host.inert = true;
    document.body.classList.add('bn2-verification-mode');
    try {
      verifyStylesheet(document);
      await loadSequential(document, V2_SCRIPTS);
      const instance = bootVerification(env, options);
      // Expose only a successfully initialized, recovered and rendered host.
      host.hidden = false;
      host.inert = false;
      return {mode:'verification',instance};
    } catch (error) {
      // No same-page legacy fallback. Pending bytes remain in isolated storage.
      const attack = host.querySelector('.bn2-attack-button');
      if (attack) attack.disabled = true;
      showStop(document, error);
      return {mode:'verification-stop',reason:error.code || error.message};
    }
  }
  return Object.freeze({LEGACY_SCRIPTS,V2_SCRIPTS,FIXTURE_INPUT,FIXTURE_SEED,selectVerification,
    loadSequential,isolatedStorage,fixtureState,definitions,bootGate,attackGate,bootVerification,start,showStop});
});
