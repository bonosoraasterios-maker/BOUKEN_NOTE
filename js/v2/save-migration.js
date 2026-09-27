(function (root, factory) {
  const value = factory(typeof module === 'object' && module.exports ? require('./schema.js') : root.BOUKEN_NOTE_V2.schema);
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.saveMigration = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (schema) {
  'use strict';

  const LEGACY_KEY = 'bouken_note_v23_20_battle_system';
  const V2_KEY = 'bouken_note_battle_state_v2';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const int = (v, fallback) => Math.floor(finite(v, fallback));
  const boolArray = v => Array.isArray(v) ? v.slice(0, 3).map(Boolean) : [false, false, false];
  const isoDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;
  const clone = v => JSON.parse(JSON.stringify(v));

  function sha256(ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    const maxWord = Math.pow(2, 32), words = [], asciiBitLength = ascii.length * 8;
    let hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], primeCounter = k.length;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8;
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16), oldHash = hash.slice(0);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    return hash.slice(0, 8).map(v => ('00000000' + (v >>> 0).toString(16)).slice(-8)).join('');
  }

  function weeklyHp(oldHp) {
    const numeric = finite(oldHp, 4000);
    if (numeric <= 0) return 0;
    return clamp(Math.ceil((numeric / 4000) * 3000), 1, 3000);
  }

  function character(id, hp, sp) {
    return { characterId: id, hp, sp, barrier: null, statusIds: [], resources: {}, flags: {}, weekly: {}, battle: null };
  }

  function migrateLegacyToV2(legacyInput, options) {
    const opts = options || {};
    const legacyBytes = typeof legacyInput === 'string' ? legacyInput : JSON.stringify(legacyInput || {});
    let legacy;
    try { legacy = typeof legacyInput === 'string' ? JSON.parse(legacyInput) : clone(legacyInput || {}); }
    catch (error) { return { ok: false, candidate: null, errors: [{ path: '$legacy', message: 'invalid JSON' }], legacyBytes }; }
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return { ok: false, candidate: null, errors: [{ path: '$legacy', message: 'legacy save must be an object' }], legacyBytes };

    const daily = boolArray(legacy.daily), weekly = boolArray(legacy.weekly), special = boolArray(legacy.special);
    const party = Array.isArray(legacy.party) ? legacy.party : [];
    const oldWeeklyHp = finite(legacy.weeklyHP, 4000);
    const newWeeklyHp = weeklyHp(oldWeeklyHp);
    const enemiesById = {};
    const enemyOrder = [];
    const dailyLimit = newWeeklyHp > 0 ? 4 : 5;
    (Array.isArray(legacy.dailyEnemies) ? legacy.dailyEnemies : []).filter(e => e && finite(e.hp, 0) > 0).slice(0, dailyLimit).forEach((e, i) => {
      const id = `legacy_daily_${String(e.id == null ? i + 1 : e.id)}`;
      enemiesById[id] = { instanceId: id, definitionId: 'daily_base', kind: 'daily', hp: clamp(int(e.hp, 800), 1, 800), maxHp: 800, barrier: null, phase: { current: null, pending: null, pendingAppliesAt: null }, statusIds: [], spawnedOn: isoDay(e.day), defeated: false, flags: {} };
      enemyOrder.push(id);
    });
    const weeklyId = 'legacy_weekly_current';
    enemiesById[weeklyId] = { instanceId: weeklyId, definitionId: 'weekly_base', kind: 'weekly', hp: newWeeklyHp, maxHp: 3000, barrier: null, phase: { current: null, pending: null, pendingAppliesAt: null }, statusIds: [], spawnedOn: null, defeated: newWeeklyHp <= 0, flags: { legacyPhaseSkillUsed: legacy.weeklyPhaseSkillUsed === true } };
    if (newWeeklyHp > 0) enemyOrder.unshift(weeklyId);
    while (enemyOrder.filter(id => enemiesById[id].kind === 'daily').length > 4) enemyOrder.pop();

    const completed = (flags, category) => flags.map((done, i) => done ? `${category}_${i + 1}` : null).filter(Boolean);
    const candidate = {
      schemaVersion: 2,
      revision: 0,
      writtenAt: opts.migratedAt || null,
      definitionsVersion: '2026-09-26-1117',
      featureFlags: { formalBattleV2: false },
      profile: { points: Math.max(0, int(legacy.coin, 0)), currentAreaId: null, progressionFlags: [], unlockedCharacterIds: ['aria', 'ceres', 'linnet'], selectedLeaderCharacterId: null },
      calendar: { localDate: isoDay(legacy.loginDay), weekKey: isoDay(legacy.weekKey), enemySpawnDate: isoDay(legacy.enemyDay), timezone: 'Asia/Tokyo' },
      partySlots: { protagonist: { characterId: 'sora' }, supporter: { characterId: 'aria' }, defender: { characterId: 'ceres' }, attacker: { characterId: 'linnet' } },
      charactersById: {
        sora: character('sora', null, null),
        aria: character('aria', clamp(int(party[0], 600), 0, 600), 0),
        ceres: character('ceres', clamp(int(party[1], 1200), 0, 1200), 0),
        linnet: character('linnet', clamp(int(party[2], 400), 0, 400), 0)
      },
      enemiesById,
      enemyOrder,
      missions: {
        daily: { completedIds: completed(daily, 'daily'), resultCount: daily.filter(Boolean).length, date: isoDay(legacy.loginDay) },
        weekly: { completedIds: completed(weekly, 'weekly'), clearCount: weekly.filter(Boolean).length, weekKey: isoDay(legacy.weekKey) },
        special: { completedIds: completed(special, 'special') }
      },
      battleProgress: { suPoints: 0, dailySuUsedOn: null, pendingElliottHits: { amount: null, expiresOn: null }, currentBattleId: null },
      leaderCarry: { defenderDamageReductionByCharacterId: {} },
      statusInstances: {},
      pendingBattle: null,
      migration: {
        sourceKey: LEGACY_KEY,
        sourceFingerprint: { algorithm: 'sha256', value: sha256(unescape(encodeURIComponent(legacyBytes))) },
        migratedAt: opts.migratedAt || null,
        status: 'ready',
        audit: {
          weeklyHp: { oldHp: oldWeeklyHp, oldMaxHp: 4000, newHp: newWeeklyHp, newMaxHp: 3000, method: 'ceil-progress-ratio' },
          sharedSkillSp: { oldValue: finite(legacy.skillSP, null), converted: false, newIndividualSp: 0 },
          battlePts: { oldValue: finite(legacy.battlePts, null), converted: false, newSuPoints: 0 },
          legacyUnsupported: { bleed: clone(legacy.bleed == null ? null : legacy.bleed) },
          legacyTame: { beast: clone(legacy.beast == null ? null : legacy.beast), beastQueue: clone(Array.isArray(legacy.beastQueue) ? legacy.beastQueue : []), converted: false, newActiveTameRoster: [] }
        }
      }
    };
    candidate.charactersById.linnet.resources.tameRoster = [];
    const validation = schema.validateState(candidate);
    return { ok: validation.ok, candidate: validation.ok ? candidate : null, rejectedCandidate: validation.ok ? null : candidate, errors: validation.errors, legacyBytes };
  }

  function prepareFromStorage(storage, options) {
    const before = storage.getItem(LEGACY_KEY);
    if (before === null) return { ok: false, candidate: null, errors: [{ path: LEGACY_KEY, message: 'legacy save not found' }], legacyBytesUnchanged: true };
    const result = migrateLegacyToV2(before, options);
    const after = storage.getItem(LEGACY_KEY);
    return Object.assign({}, result, { legacyBytesUnchanged: before === after, wroteV2: storage.getItem(V2_KEY) !== null });
  }

  return Object.freeze({ LEGACY_KEY, V2_KEY, weeklyHp, sha256, migrateLegacyToV2, prepareFromStorage });
});
