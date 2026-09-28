(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.battleFxAdapter = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CUE_TYPES = Object.freeze({
    damage: Object.freeze({ className:'bn2-fx-damage', label:'ダメージ', durationMs:420 }),
    vitalChange: Object.freeze({ className:'bn2-fx-vital-change', label:'HP／Barrier変化', durationMs:260 }),
    barrierAbsorbed: Object.freeze({ className:'bn2-fx-barrier-absorbed', label:'Barrier吸収', durationMs:520 }),
    statusApplied: Object.freeze({ className:'bn2-fx-status-applied', label:'状態異常付与', durationMs:520 }),
    statusRemoved: Object.freeze({ className:'bn2-fx-status-removed', label:'状態異常解除', durationMs:420 }),
    knockout: Object.freeze({ className:'bn2-fx-knockout', label:'KO', durationMs:650 }),
    dailyDefeat: Object.freeze({ className:'bn2-fx-daily-defeat', label:'Daily Enemy 撃破', durationMs:2500 }),
    bossDefeat: Object.freeze({ className:'bn2-fx-boss-defeat', label:'Boss 撃破', durationMs:6000 }),
    starRoad: Object.freeze({ className:'bn2-fx-star-road', label:'――《星路再結》――', durationMs:1100 }),
    leader: Object.freeze({ className:'bn2-fx-leader', label:'Leader 発動', durationMs:800 }),
    union: Object.freeze({ className:'bn2-fx-union', label:'スターライトユニオン', durationMs:1200 }),
    overbreak: Object.freeze({ className:'bn2-fx-overbreak', label:'オーバーブレイク', durationMs:1200 }),
    skipped: Object.freeze({ className:'bn2-fx-final', label:'最終状態を表示', durationMs:0 })
  });

  function safeText(value, fallback) { return typeof value === 'string' && value.length <= 128 ? value : fallback; }
  function enemyKind(snapshot, id) {
    const enemies = snapshot && snapshot.enemiesById;
    const enemy = enemies && typeof enemies === 'object' ? enemies[id] : null;
    return enemy && typeof enemy.kind === 'string' ? enemy.kind : 'unknown';
  }
  function cue(event, index, name, target) {
    const source = CUE_TYPES[name];
    return Object.freeze({
      id: `${safeText(event && event.eventId, 'final')}:${index}:${name}`,
      type: name,
      eventType: event ? safeText(event.type, 'UNKNOWN') : 'SKIPPED',
      target: target === null || typeof target === 'string' ? target : null,
      className: source.className,
      label: source.label,
      durationMs: source.durationMs
    });
  }

  // This is a pure event-to-cue mapping. It receives an already-applied presentation
  // snapshot and never derives combat facts from the DOM or changes that snapshot.
  function cuesFor(payload) {
    if (!payload || !payload.snapshot || typeof payload.snapshot !== 'object') throw new TypeError('event and presentation snapshot required');
    if (payload.skipped === true || payload.event === null) return Object.freeze([cue(null, 0, 'skipped', null)]);
    const event = payload.event;
    if (!event || typeof event.type !== 'string') throw new TypeError('battle event required');
    const target = typeof event.target === 'string' ? event.target : null;
    const result = [];
    function add(name) { result.push(cue(event, result.length, name, target)); }
    switch (event.type) {
      case 'DAMAGE': add('damage'); add('vitalChange'); break;
      case 'HEAL': add('vitalChange'); break;
      case 'BARRIER_ABSORBED': add('barrierAbsorbed'); add('vitalChange'); break;
      case 'STATUS_APPLIED': add('statusApplied'); break;
      case 'STATUS_REMOVED': add('statusRemoved'); break;
      case 'KNOCKOUT': add('knockout'); break;
      case 'ENEMY_DEFEATED':
        add(enemyKind(payload.snapshot, target) === 'daily' ? 'dailyDefeat' : 'bossDefeat');
        break;
      case 'STAR_ROAD_RECONNECTION': add('starRoad'); break;
      case 'LEADER_SKILL': add('leader'); break;
      case 'STARLIGHT_UNION': add('union'); break;
      case 'OVERBREAK': add('overbreak'); break;
      default: break;
    }
    return Object.freeze(result);
  }

  function defaultRender(document, mount, cueItem) {
    if (!document || !mount || !cueItem) return;
    const item = document.createElement('span');
    item.className = `bn2-fx-cue ${cueItem.className}`;
    item.setAttribute('data-bn2-fx-cue', cueItem.type);
    item.setAttribute('data-bn2-fx-event', cueItem.eventType);
    item.setAttribute('data-bn2-fx-duration-ms', String(cueItem.durationMs));
    item.textContent = cueItem.label;
    mount.appendChild(item);
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function create(options) {
    const config = options || {};
    const mount = config.mount || null;
    const renderer = typeof config.renderCue === 'function'
      ? config.renderCue
      : function (cueItem) { defaultRender(config.document, mount, cueItem); };
    function present(payload) {
      const visualCues = cuesFor(payload);
      clear(mount);
      visualCues.forEach(cueItem => renderer(cueItem, payload));
      return Object.freeze({ cues:visualCues });
    }
    return Object.freeze({ present });
  }

  return Object.freeze({ CUE_TYPES, cuesFor, create });
});
