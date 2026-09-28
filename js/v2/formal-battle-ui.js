(function (root, factory) {
  const value = factory(
    typeof module === 'object' && module.exports ? require('./battle-fx-adapter.js') : root.BOUKEN_NOTE_V2.battleFxAdapter,
    typeof module === 'object' && module.exports ? require('../../data/v2/formal-battle-assets.js') : root.BOUKEN_NOTE_V2.formalBattleAssets
  );
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.formalBattleUi = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (battleFxAdapter, formalBattleAssets) {
  'use strict';

  const ROLES = Object.freeze(['protagonist', 'supporter', 'defender', 'attacker']);
  const ROLE_LABELS = Object.freeze({ protagonist:'主人公', supporter:'Supporter', defender:'Defender', attacker:'Attacker' });
  const STATUS_SLOTS = Object.freeze([
    ['poison','毒症','軽度'], ['burn','火傷','軽度'], ['freeze','凍結','中度'],
    ['bind','呪縛','中度'], ['gravity','重力','高度'], ['finalHour','終刻','高度']
  ]);
  const DEFAULT_FLAGS = Object.freeze({ formalBattleV2:false });

  function element(document, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function add(parent, child) { parent.appendChild(child); return child; }
  function finite(value, fallback) { return Number.isFinite(value) ? value : fallback; }
  function percent(value, maximum) {
    const max = finite(maximum, 0);
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, finite(value, 0) / max * 100));
  }
  function safeId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : ''; }
  function safeAssetKey(value) { return typeof value === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(value) ? value : ''; }
  function shouldEnable(flags, verificationMode) {
    return verificationMode === true && !!flags && flags.formalBattleV2 === true;
  }

  function create(options) {
    if (!options || !options.document || !options.host) throw new TypeError('document and host are required');
    const document = options.document;
    const definitionBundle = options.definitions || {};
    const definitions = definitionBundle.characters && definitionBundle.characters.characters
      ? definitionBundle.characters.characters
      : (definitionBundle.characters || definitionBundle);
    const skillDefinitions = definitionBundle.skills && definitionBundle.skills.byId
      ? Object.values(definitionBundle.skills.byId)
      : (definitionBundle.skills && Array.isArray(definitionBundle.skills.skills) ? definitionBundle.skills.skills : []);
    const onAttack = typeof options.onAttack === 'function' ? options.onAttack : function () {};
    const assets = options.assetRegistry && typeof options.assetRegistry.resolve === 'function'
      ? options.assetRegistry
      : formalBattleAssets;
    const allowNonFormalPreviewAssets = options.allowNonFormalPreviewAssets === true;
    const host = options.host;
    const registry = Object.create(null);
    let locked = true;
    let latestSnapshot = null;

    const root = element(document, 'section', 'bn2-shell');
    root.setAttribute('data-bn2-root', 'formal-battle');
    root.setAttribute('aria-label', '正式戦闘画面');
    registry.root = root;
    const battlefieldAsset = allowNonFormalPreviewAssets && assets && assets.resolve ? assets.resolve('background.legacyBattlefield') : null;
    if (battlefieldAsset && battlefieldAsset.approval === 'legacyPlaceholder') {
      root.setAttribute('data-bn2-background-asset-key', battlefieldAsset.key);
      root.style.backgroundImage = `linear-gradient(rgba(3,9,25,.28), rgba(3,9,25,.62)), url("${battlefieldAsset.path}")`;
    }

    const topbar = add(root, element(document, 'header', 'bn2-topbar'));
    const utilities = add(topbar, element(document, 'nav', 'bn2-utilities'));
    utilities.setAttribute('aria-label', '所持ポイントとユーティリティ');
    const values = add(utilities, element(document, 'div', 'bn2-owned-values', '所持ポイント'));
    values.setAttribute('data-bn2-owned-values', '');
    ['図鑑','設定','メニュー'].forEach(label => {
      const button = add(utilities, element(document, 'button', 'bn2-utility-button', label));
      button.type = 'button'; button.disabled = true; button.setAttribute('aria-disabled', 'true');
    });

    const stage = add(root, element(document, 'div', 'bn2-stage'));
    const routes = add(stage, element(document, 'aside', 'bn2-routes'));
    routes.setAttribute('aria-label', '星図航路');
    [['daily','Daily'],['weekly','Weekly'],['special','Special']].forEach(([id,label]) => {
      const route = add(routes, element(document, 'section', 'bn2-route'));
      route.setAttribute('data-bn2-route', id);
      add(route, element(document, 'h2', 'bn2-route-title', label));
      add(route, element(document, 'div', 'bn2-route-content', '航路情報'));
    });

    const formation = add(stage, element(document, 'section', 'bn2-formation'));
    formation.setAttribute('aria-label', '味方編成');
    registry.formation = formation;
    ROLES.forEach(role => {
      const mount = add(formation, element(document, 'div', 'bn2-ally-mount'));
      mount.setAttribute('data-bn2-ally-role', role);
      registry[`ally-${role}`] = mount;
    });

    const enemies = add(stage, element(document, 'section', 'bn2-enemies'));
    enemies.setAttribute('aria-label', '敵編成');
    registry.enemies = enemies;

    const attackArea = add(stage, element(document, 'aside', 'bn2-attack-area'));
    const attack = add(attackArea, element(document, 'button', 'bn2-attack-button'));
    attack.type = 'button'; attack.setAttribute('aria-label', '攻撃');
    add(attack, element(document, 'span', 'bn2-attack-jp', '攻撃'));
    add(attack, element(document, 'span', 'bn2-attack-en', 'ATTACK'));
    attack.addEventListener('click', function () { if (!locked) onAttack(latestSnapshot); });
    registry.attack = attack;
    const eventMount = add(stage, element(document, 'div', 'bn2-event-mount'));
    eventMount.setAttribute('data-bn2-event-mount', '');
    eventMount.setAttribute('aria-live', 'polite');
    registry.eventMount = eventMount;
    const fxAdapter = options.fxAdapter && typeof options.fxAdapter.present === 'function'
      ? options.fxAdapter
      : battleFxAdapter.create({ document, mount:eventMount });

    const hud = add(root, element(document, 'section', 'bn2-hud'));
    hud.setAttribute('aria-label', 'パーティーHUD');
    registry.hud = hud;
    ROLES.forEach(role => {
      const mount = add(hud, element(document, 'article', 'bn2-hud-card'));
      mount.setAttribute('data-bn2-hud-role', role);
      registry[`hud-${role}`] = mount;
    });

    const ad = add(root, element(document, 'div', 'bn2-ad-slot', '広告枠（Phase D placeholder）'));
    ad.setAttribute('data-bn2-ad-slot', 'placeholder');
    host.appendChild(root);

    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
    function assetFor(key, fallbackKey) { return assets && assets.resolve ? assets.resolve(key, fallbackKey) : null; }
    function formalFieldAsset(key, fallbackKey) {
      const asset = assetFor(key, fallbackKey);
      return asset && (asset.approval === 'formal' || allowNonFormalPreviewAssets) ? asset : null;
    }
    function hudPortraitAsset(key) {
      const asset = assetFor(key);
      return asset && (asset.approval === 'formal' || allowNonFormalPreviewAssets) ? asset : null;
    }
    function addImage(parent, className, asset, alt) {
      if (!asset) return null;
      const image = add(parent, element(document, 'img', className));
      image.setAttribute('data-bn2-asset-key', asset.key);
      image.setAttribute('data-bn2-asset-source', asset.sourcePath);
      image.setAttribute('src', asset.path);
      image.setAttribute('alt', typeof alt === 'string' ? alt : '');
      return image;
    }
    function characterDefinition(id) { return definitions[id] || { id, name:id || '未編成', maxHp:null, maxSp:null, resources:[] }; }
    function renderStatuses(parent, activeIds, statusInstances) {
      const active = new Set((Array.isArray(activeIds) ? activeIds : []).map(id => {
        const instance = statusInstances && statusInstances[id];
        return instance && typeof instance.statusId === 'string' ? instance.statusId : id;
      }));
      const row = add(parent, element(document, 'div', 'bn2-status-list'));
      row.setAttribute('aria-label', '状態異常');
      STATUS_SLOTS.forEach(([id,name,severity]) => {
        const slot = add(row, element(document, 'span', `bn2-status-slot${active.has(id) ? ' bn2-status-active' : ''}`, name));
        slot.setAttribute('data-bn2-status', id);
        slot.setAttribute('data-bn2-severity', severity);
        slot.setAttribute('aria-label', `${severity}状態異常 ${name}${active.has(id) ? ' 有効' : ' なし'}`);
      });
    }
    function renderGauge(parent, state, maxHp) {
      const barrierCurrent = state && state.barrier && typeof state.barrier === 'object'
        ? finite(state.barrier.current, 0)
        : 0;
      const frame = add(parent, element(document, 'div', 'bn2-vital-frame'));
      frame.setAttribute('data-bn2-vital-gauge', '');
      const hp = add(frame, element(document, 'span', 'bn2-hp-fill'));
      hp.style.width = `${percent(state && state.hp, maxHp)}%`;
      const barrier = add(frame, element(document, 'span', 'bn2-barrier-fill'));
      barrier.style.width = `${percent(barrierCurrent, maxHp)}%`;
      add(parent, element(document, 'span', 'bn2-vital-text', `${finite(state && state.hp, 0)} / ${finite(maxHp, 0)}　Barrier ${barrierCurrent}`));
    }
    function renderAbilityMount(parent, definition) {
      const mount = add(parent, element(document, 'div', 'bn2-ability-mount'));
      mount.setAttribute('data-bn2-ability-mount', safeId(definition.id));
      skillDefinitions.filter(skill => skill && skill.ownerId === definition.id && typeof skill.hudSlot === 'string')
        .sort((left, right) => finite(left.hudOrder, 0) - finite(right.hudOrder, 0) || left.id.localeCompare(right.id))
        .forEach(skill => {
          const slot = add(mount, element(document, 'span', 'bn2-ability-slot'));
          slot.setAttribute('data-bn2-ability-slot', safeId(skill.hudSlot));
          slot.setAttribute('data-bn2-ability-id', safeId(skill.id));
          slot.setAttribute('data-bn2-ability-kind', safeId(skill.kind));
          slot.textContent = typeof skill.hudLabel === 'string' ? skill.hudLabel : `${skill.hudSlot} ${skill.name}`;
        });
    }
    function renderResourceMount(parent, characterState, definition) {
      const mount = add(parent, element(document, 'div', 'bn2-resource-mount'));
      mount.setAttribute('data-bn2-resource-mount', safeId(definition.id));
      const resources = characterState && characterState.resources;
      if (!resources || typeof resources !== 'object') return;
      Object.keys(resources).sort().slice(0, 12).forEach(key => {
        const item = add(mount, element(document, 'span', 'bn2-resource-item'));
        item.setAttribute('data-bn2-resource-key', safeId(key));
        item.textContent = `${key}: ${typeof resources[key] === 'object' ? '保持中' : String(resources[key])}`;
      });
    }
    function renderCharacter(role, snapshot) {
      const partySlot = snapshot && snapshot.partySlots && snapshot.partySlots[role];
      const id = partySlot && partySlot.characterId;
      const definition = characterDefinition(id);
      const state = snapshot && snapshot.charactersById && snapshot.charactersById[id];
      const ally = registry[`ally-${role}`]; clear(ally);
      const fieldAsset = formalFieldAsset(definition.fieldAssetKey);
      const portraitAsset = hudPortraitAsset(definition.hudPortraitAssetKey);
      ally.setAttribute('data-bn2-field-asset-key', safeAssetKey(definition.fieldAssetKey || 'missing'));
      if (fieldAsset) addImage(ally, 'bn2-ally-art', fieldAsset, `${definition.name} フィールド`);
      else add(ally, element(document, 'span', 'bn2-ally-placeholder', definition.name));
      const card = registry[`hud-${role}`]; clear(card);
      add(card, element(document, 'span', 'bn2-role-label', ROLE_LABELS[role]));
      add(card, element(document, 'strong', 'bn2-character-name', definition.name));
      if (portraitAsset) addImage(card, 'bn2-portrait-art', portraitAsset, `${definition.name} 肖像`);
      else {
        const portrait = add(card, element(document, 'div', 'bn2-portrait-placeholder', 'PORTRAIT'));
        portrait.setAttribute('data-bn2-hud-portrait-asset-key', safeAssetKey(definition.hudPortraitAssetKey || 'missing'));
      }
      if (definition.maxHp !== null && state) renderGauge(card, state, definition.maxHp);
      if (definition.maxSp !== null && state && state.sp !== null) {
        const sp = add(card, element(document, 'div', 'bn2-sp', `SP ${finite(state.sp, 0)} / ${finite(definition.maxSp, 5)}`));
        sp.setAttribute('data-bn2-sp', '');
      }
      renderAbilityMount(card, definition);
      renderResourceMount(card, state, definition);
      renderStatuses(card, state && state.statusIds, snapshot && snapshot.statusInstances);
    }
    function renderEnemies(snapshot) {
      clear(registry.enemies);
      const order = snapshot && Array.isArray(snapshot.enemyOrder) ? snapshot.enemyOrder : [];
      if (order.length > 5) throw new RangeError('formal UI supports at most five enemies');
      order.forEach(id => {
        const state = snapshot.enemiesById && snapshot.enemiesById[id];
        if (!state || state.defeated) return;
        const card = add(registry.enemies, element(document, 'article', 'bn2-enemy-card'));
        const enemyAsset = formalFieldAsset(state.assetKey || state.definitionId, assets && assets.fallbackEnemyKey ? assets.fallbackEnemyKey(state.kind) : null);
        card.setAttribute('data-bn2-enemy-kind', safeId(state.kind));
        card.setAttribute('data-bn2-asset-key', safeAssetKey(state.assetKey || state.definitionId));
        add(card, element(document, 'strong', 'bn2-enemy-name', state.displayName || state.definitionId || 'Enemy'));
        if (enemyAsset) addImage(card, 'bn2-enemy-art', enemyAsset, `${state.displayName || state.definitionId || 'Enemy'} 敵素材`);
        else add(card, element(document, 'div', 'bn2-enemy-placeholder', 'ENEMY'));
        renderGauge(card, state, state.maxHp);
        renderStatuses(card, state.statusIds, snapshot.statusInstances);
      });
    }
    function setLocked(value) {
      locked = value === true;
      registry.attack.disabled = locked;
      registry.attack.setAttribute('aria-disabled', locked ? 'true' : 'false');
      root.setAttribute('data-bn2-locked', locked ? 'true' : 'false');
    }
    function render(snapshot, viewState) {
      if (!snapshot || typeof snapshot !== 'object') throw new TypeError('presentation snapshot required');
      latestSnapshot = snapshot;
      ROLES.forEach(role => renderCharacter(role, snapshot));
      renderEnemies(snapshot);
      const controllerLocked = viewState && typeof viewState.locked === 'boolean' ? viewState.locked : locked;
      setLocked(controllerLocked);
      return root;
    }
    function present(payload) {
      if (!payload || !payload.snapshot) throw new TypeError('event and presentation snapshot required');
      render(payload.snapshot, { locked:true });
      const fxResult = fxAdapter.present(payload);
      const eventType = payload.event && payload.event.type;
      if (eventType === 'STARLIGHT_UNION') {
        const unionAsset = formalFieldAsset('fx.starlightUnionCandidate');
        if (unionAsset) addImage(eventMount, 'bn2-fx-art', unionAsset, 'スターライトユニオン演出素材');
      }
      return fxResult;
    }
    function destroy() { if (root.parentNode === host) host.removeChild(root); latestSnapshot = null; }
    setLocked(true);
    return Object.freeze({ root, registry:Object.freeze(registry), render, present, setLocked, destroy });
  }

  function mountIfEnabled(options) {
    const flags = options && options.featureFlags ? options.featureFlags : DEFAULT_FLAGS;
    if (!shouldEnable(flags, options && options.verificationMode)) return null;
    return create(options);
  }

  return Object.freeze({ DEFAULT_FLAGS, ROLES, STATUS_SLOTS, shouldEnable, create, mountIfEnabled });
});
