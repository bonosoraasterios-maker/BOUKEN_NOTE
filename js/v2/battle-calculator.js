(function (root, factory) {
  const value = factory(
    typeof module === 'object' && module.exports ? require('./schema.js') : root.BOUKEN_NOTE_V2.schema,
    typeof module === 'object' && module.exports ? require('./seeded-rng.js') : root.BOUKEN_NOTE_V2.seededRng,
    typeof module === 'object' && module.exports ? require('./battle-events.js') : root.BOUKEN_NOTE_V2.battleEvents
  );
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.battleCalculator = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (schema, seededRng, battleEvents) {
  'use strict';

  const INPUT_KEYS = new Set(['battleId', 'battleDate', 'dailyResult', 'attackerSkillId', 'leaderCharacterId']);
  const MAX_ACTIONS = 64;
  const MAX_HITS = 100;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const fail = (code, message, details) => { const error = new Error(message); error.code = code; error.details = details || null; throw error; };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const floorDamage = value => value <= 0 ? 0 : Math.max(1, Math.floor(value));

  function exactKeys(object, allowed, path) {
    Object.keys(object).forEach(key => { if (!allowed.has(key)) fail('INVALID_INPUT', `unexpected key ${path}.${key}`); });
  }

  function definitionMaps(definitions) {
    return {
      characters: definitions.characters.characters,
      enemies: definitions.enemies.enemies,
      skillProfiles: definitions.enemies.skillProfiles || {},
      skills: definitions.skills.byId,
      statuses: definitions.statusEffects.effects,
      rules: definitions.battleRules
    };
  }

  function validateInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) fail('INVALID_INPUT', 'input must be a plain object');
    battleEvents.safeClone(input, '$input', 0);
    exactKeys(input, INPUT_KEYS, 'input');
    if (typeof input.battleId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(input.battleId)) fail('INVALID_INPUT', 'invalid battleId');
    if (typeof input.battleDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.battleDate)) fail('INVALID_INPUT', 'battleDate must be YYYY-MM-DD');
    if (!Number.isInteger(input.dailyResult) || input.dailyResult < 0 || input.dailyResult > 3) fail('INVALID_INPUT', 'dailyResult must be 0..3');
    if (input.attackerSkillId !== null && typeof input.attackerSkillId !== 'string') fail('INVALID_INPUT', 'invalid attackerSkillId');
    if (input.leaderCharacterId !== null && typeof input.leaderCharacterId !== 'string') fail('INVALID_INPUT', 'invalid leaderCharacterId');
  }

  function validateBattleState(snapshot, maps) {
    const base = schema.validateState(snapshot);
    if (!base.ok) fail('INVALID_SNAPSHOT', 'snapshot schema rejected', base.errors);
    battleEvents.safeClone(snapshot, '$snapshot', 0);
    Object.entries(snapshot.charactersById).forEach(([id, character]) => {
      const def = maps.characters[id];
      if (!def) fail('UNKNOWN_CHARACTER_ID', `unknown character ${id}`);
      if (character.hp !== null && (!Number.isFinite(character.hp) || character.hp < 0 || character.hp > def.maxHp)) fail('INVALID_SNAPSHOT', `invalid HP for ${id}`);
      character.statusIds.forEach(statusInstanceId => {
        const instance = snapshot.statusInstances[statusInstanceId];
        if (!instance || instance.ownerType !== 'character' || instance.ownerId !== id) fail('INVALID_STATUS_ID', `invalid character status reference ${statusInstanceId}`);
      });
    });
    Object.entries(snapshot.enemiesById).forEach(([id, enemy]) => {
      if (enemy.instanceId !== id || !maps.enemies[enemy.definitionId]) fail('UNKNOWN_ENEMY_ID', `unknown enemy definition or instance ${id}`);
      enemy.statusIds.forEach(statusInstanceId => {
        const instance = snapshot.statusInstances[statusInstanceId];
        if (!instance || instance.ownerType !== 'enemy' || instance.ownerId !== id) fail('INVALID_STATUS_ID', `invalid enemy status reference ${statusInstanceId}`);
      });
    });
    const seenStatusOwners = new Set();
    Object.entries(snapshot.statusInstances).forEach(([id, status]) => {
      if (status.instanceId !== id || !maps.statuses[status.statusId]) fail('UNKNOWN_STATUS_ID', `unknown status ${id}`);
      const ownerMap = status.ownerType === 'character' ? snapshot.charactersById : status.ownerType === 'enemy' ? snapshot.enemiesById : null;
      if (!ownerMap || !ownerMap[status.ownerId]) fail('INVALID_STATUS_ID', `unknown status owner ${id}`);
      const unique = `${status.ownerType}:${status.ownerId}:${status.statusId}`;
      if (seenStatusOwners.has(unique)) fail('DUPLICATE_STATUS', `duplicate active status ${unique}`);
      seenStatusOwners.add(unique);
    });
  }

  function calculateBattle(snapshot, input, definitions, rngSeed) {
    const defValidation = schema.validateDefinitions(definitions);
    if (!defValidation.ok) fail('INVALID_DEFINITIONS', 'definitions rejected', defValidation.errors);
    validateInput(input);
    const maps = definitionMaps(definitions);
    validateBattleState(snapshot, maps);
    const rng = seededRng.createSeededRng(rngSeed);
    const startSnapshot = battleEvents.safeClone(snapshot, '$snapshot', 0);
    let current = battleEvents.safeClone(snapshot, '$snapshot', 0);
    const events = [];
    let actionCount = 0;

    function read(path) {
      let value = current;
      for (const segment of path) {
        if (value === null || typeof value !== 'object' || !own(value, segment)) fail('INTERNAL_PATH', `missing path ${path.join('.')}`);
        value = value[segment];
      }
      return battleEvents.safeClone(value, '$read', 0);
    }

    function mutation(path, after) { return { op: 'set', path, before: read(path), after: battleEvents.safeClone(after, '$after', 0) }; }

    function emit(slot, type, actor, target, payload, mutations) {
      if (events.length >= battleEvents.LIMITS.maxEvents) fail('EVENT_LIMIT', 'event limit exceeded');
      const event = {
        eventId: `event-${events.length}`, slot, type,
        actor: actor === undefined ? null : actor,
        target: target === undefined ? null : target,
        payload: payload || {}, mutations: mutations || []
      };
      current = battleEvents.applyBattleEvent(current, event, events.length);
      events.push(event);
      return event;
    }

    function mainAction(slot, type, actor, target, payload) {
      actionCount += 1;
      if (actionCount > MAX_ACTIONS) fail('ACTION_LIMIT', 'action limit exceeded');
      emit(slot, type, actor, target, Object.assign({ mainActionNumber: actionCount }, payload || {}), []);
    }

    const characterDef = id => maps.characters[id] || fail('UNKNOWN_CHARACTER_ID', `unknown character ${id}`);
    const enemyDef = instance => maps.enemies[instance.definitionId] || fail('UNKNOWN_ENEMY_ID', `unknown enemy ${instance.definitionId}`);
    const livingCharacters = () => ['supporter','defender','attacker'].map(slot => current.partySlots[slot].characterId).filter(id => id && current.charactersById[id] && current.charactersById[id].hp > 0);
    const livingEnemies = () => current.enemyOrder.map(id => current.enemiesById[id]).filter(enemy => enemy && !enemy.defeated && enemy.hp > 0);
    const bosses = () => livingEnemies().filter(enemy => enemy.kind === 'weekly' || enemy.kind === 'areaBoss');
    const dailies = () => livingEnemies().filter(enemy => enemy.kind === 'daily');

    function statusInstancesFor(ownerType, ownerId, statusId) {
      return Object.values(current.statusInstances).filter(status => status.ownerType === ownerType && status.ownerId === ownerId && (!statusId || status.statusId === statusId));
    }

    function removeStatus(slot, instance, reason) {
      const all = Object.assign(Object.create(null), current.statusInstances);
      delete all[instance.instanceId];
      const ownerRoot = instance.ownerType === 'character' ? 'charactersById' : 'enemiesById';
      const owner = current[ownerRoot][instance.ownerId];
      emit(slot, 'STATUS_REMOVED', instance.sourceId || null, instance.ownerId, { statusId: instance.statusId, reason }, [
        mutation(['statusInstances'], all),
        mutation([ownerRoot, instance.ownerId, 'statusIds'], owner.statusIds.filter(id => id !== instance.instanceId))
      ]);
    }

    function applyStatus(slot, statusId, ownerType, ownerId, sourceType, sourceId, payload) {
      if (!maps.statuses[statusId]) fail('UNKNOWN_STATUS_ID', `unknown status ${statusId}`);
      if (statusInstancesFor(ownerType, ownerId, statusId).length) {
        emit(slot, 'STATUS_IGNORED_DUPLICATE', sourceId, ownerId, { statusId }, []);
        return;
      }
      if (statusId === 'bind' && ownerType === 'character' && ownerId === 'elliott') {
        emit(slot, 'STATUS_NOT_APPLICABLE', sourceId, ownerId, { statusId, reason: 'characterHasNoSp' }, []);
        return;
      }
      const index = Object.keys(current.statusInstances).length;
      if (index >= 60) fail('STATUS_LIMIT', 'status instance limit exceeded');
      const instanceId = `status-${input.battleId}-${index}`;
      const template = maps.statuses[statusId];
      const instance = {
        instanceId, statusId, ownerType, ownerId, sourceType, sourceId,
        severity: template.severity, appliedBattleId: input.battleId,
        counters: Object.assign({ ticksRemaining:null, attemptsRemaining:null, spBlockRemaining:null, numericActionsRemaining:null, mainActionMarks:null }, template.counters || {}),
        payload: payload || {}, persistsAcrossBattle: template.persistsAcrossBattle, clearsAtWeekStart: template.clearsAtWeekStart
      };
      const all = Object.assign(Object.create(null), current.statusInstances, { [instanceId]: instance });
      const ownerRoot = ownerType === 'character' ? 'charactersById' : 'enemiesById';
      emit(slot, 'STATUS_APPLIED', sourceId, ownerId, { statusId, instanceId }, [
        mutation(['statusInstances'], all),
        mutation([ownerRoot, ownerId, 'statusIds'], current[ownerRoot][ownerId].statusIds.concat(instanceId))
      ]);
    }

    function setStatusInstance(slot, instance, next, type, payload) {
      const all = Object.assign(Object.create(null), current.statusInstances, { [instance.instanceId]: next });
      emit(slot, type, instance.sourceId, instance.ownerId, Object.assign({ statusId: instance.statusId, instanceId: instance.instanceId }, payload || {}), [mutation(['statusInstances'], all)]);
    }

    function tickPoisonAfterSkillAttempt(slot, characterId) {
      const poison = statusInstancesFor('character', characterId, 'poison')[0];
      if (!poison) return;
      const dotDamage = Number(poison.payload.dotDamage);
      if (!Number.isFinite(dotDamage) || dotDamage < 1) fail('INVALID_STATUS_STATE', 'poison requires a finite positive dotDamage');
      damageCharacter(slot, poison.sourceId, characterId, dotDamage, false);
      const live = current.statusInstances[poison.instanceId];
      if (!live) return;
      const next = battleEvents.safeClone(live, '$poison', 0);
      next.counters.ticksRemaining -= 1;
      if (next.counters.ticksRemaining <= 0) removeStatus(slot, live, 'ticksExhausted');
      else setStatusInstance(slot, live, next, 'STATUS_TICKED', { remaining:next.counters.ticksRemaining, damage:dotDamage });
    }

    function gravityMultiplierForSuccessfulNumericAction(slot, characterId) {
      const gravity = statusInstancesFor('character', characterId, 'gravity')[0];
      if (!gravity) return 1;
      const next = battleEvents.safeClone(gravity, '$gravity', 0);
      next.counters.numericActionsRemaining -= 1;
      if (next.counters.numericActionsRemaining <= 0) removeStatus(slot, gravity, 'numericActionsExhausted');
      else setStatusInstance(slot, gravity, next, 'STATUS_NUMERIC_ACTION_USED', { remaining:next.counters.numericActionsRemaining, multiplier:.5 });
      return .5;
    }

    function recordFinalHourSourceDamage(slot, enemyId, amount) {
      if (amount <= 0) return;
      const instances = Object.values(current.statusInstances).filter(status => status.statusId === 'finalHour' && status.sourceType === 'enemy' && status.sourceId === enemyId);
      instances.forEach(instance => {
        const live = current.statusInstances[instance.instanceId];
        if (!live) return;
        const next = battleEvents.safeClone(live, '$finalHour', 0);
        next.payload.damageToSource = Number(next.payload.damageToSource || 0) + amount;
        const source = current.enemiesById[enemyId];
        const threshold = Math.floor(source.maxHp * .20);
        if (next.payload.damageToSource >= threshold) removeStatus(slot, live, 'sourceDamageThreshold');
        else setStatusInstance(slot, live, next, 'FINAL_HOUR_SOURCE_DAMAGE', { accumulated:next.payload.damageToSource, threshold });
      });
    }

    function completeMainAction(slot) {
      const instances = Object.values(current.statusInstances).filter(status => status.statusId === 'finalHour');
      instances.forEach(instance => {
        const live = current.statusInstances[instance.instanceId];
        if (!live) return;
        const source = live.sourceType === 'enemy' ? current.enemiesById[live.sourceId] : null;
        if (source && source.defeated) { removeStatus(slot, live, 'sourceDefeated'); return; }
        const next = battleEvents.safeClone(live, '$finalHour', 0);
        next.counters.mainActionMarks += 1;
        if (next.counters.mainActionMarks >= next.counters.triggerAt) {
          const owner = current.charactersById[next.ownerId];
          if (owner && owner.hp > 0) {
            emit(slot, 'FINAL_HOUR_TRIGGERED', next.sourceId, next.ownerId, { mark:next.counters.mainActionMarks }, [mutation(['charactersById',next.ownerId,'hp'],0)]);
            emit(slot, 'KNOCKOUT', next.sourceId, next.ownerId, { reason:'finalHour' }, []);
          }
          removeStatus(slot, current.statusInstances[next.instanceId], 'triggered');
        } else setStatusInstance(slot, live, next, 'FINAL_HOUR_MARKED', { marks:next.counters.mainActionMarks });
      });
    }

    function damageCharacter(slot, sourceId, characterId, rawAmount, direct) {
      const character = current.charactersById[characterId];
      if (!character || character.hp === null || character.hp <= 0) return 0;
      let amount = floorDamage(rawAmount);
      const burn = direct ? statusInstancesFor('character', characterId, 'burn')[0] : null;
      if (burn) amount = floorDamage(amount * 1.10);
      if (direct && character.barrier && character.barrier.current > 0) {
        const before = character.barrier;
        const after = Object.assign({}, before, { current: Math.max(0, before.current - amount) });
        emit(slot, 'BARRIER_ABSORBED', sourceId, characterId, { amount, overflowDiscarded: Math.max(0, amount - before.current) }, [mutation(['charactersById', characterId, 'barrier'], after)]);
        if (burn) removeStatus(slot, burn, 'directHitConsumed');
        return 0;
      }
      const carry = current.leaderCarry.defenderDamageReductionByCharacterId[characterId];
      const muts = [];
      if (direct && carry && carry.remainingUses > 0) {
        amount = floorDamage(amount * carry.multiplier);
        const allCarry = Object.assign(Object.create(null), current.leaderCarry.defenderDamageReductionByCharacterId);
        delete allCarry[characterId];
        muts.push(mutation(['leaderCarry', 'defenderDamageReductionByCharacterId'], allCarry));
      }
      const afterHp = Math.max(0, character.hp - amount);
      muts.unshift(mutation(['charactersById', characterId, 'hp'], afterHp));
      emit(slot, 'DAMAGE', sourceId, characterId, { amount, direct: !!direct, beforeHp: character.hp, afterHp }, muts);
      if (burn) removeStatus(slot, burn, 'directHitConsumed');
      if (afterHp === 0) emit(slot, 'KNOCKOUT', sourceId, characterId, {}, []);
      return amount;
    }

    function damageEnemy(slot, sourceId, enemyId, rawAmount, options) {
      const enemy = current.enemiesById[enemyId];
      if (!enemy || enemy.defeated || enemy.hp <= 0) return 0;
      const opts = options || {};
      const amount = floorDamage(rawAmount);
      if (!opts.penetratesBarrier && enemy.barrier && enemy.barrier.current > 0) {
        const before = enemy.barrier;
        const after = Object.assign({}, before, { current: Math.max(0, before.current - amount) });
        emit(slot, 'BARRIER_ABSORBED', sourceId, enemyId, { amount, overflowDiscarded: Math.max(0, amount - before.current) }, [mutation(['enemiesById', enemyId, 'barrier'], after)]);
        return 0;
      }
      const afterHp = Math.max(0, enemy.hp - amount);
      emit(slot, 'DAMAGE', sourceId, enemyId, { amount, direct: true, beforeHp: enemy.hp, afterHp }, [mutation(['enemiesById', enemyId, 'hp'], afterHp)]);
      if (afterHp === 0) {
        emit(slot, 'ENEMY_DEFEATED', sourceId, enemyId, {}, [mutation(['enemiesById', enemyId, 'defeated'], true)]);
      } else if (enemy.kind === 'areaBoss') {
        const def = enemyDef(enemy);
        const ratio = afterHp / enemy.maxHp;
        let pending = null;
        if (def.phaseRules) {
          if (ratio <= def.phaseRules.rgEnhancedThreshold) pending = 'enhancedSkill2';
          else if (ratio <= def.phaseRules.rgSkill2Threshold) pending = 'skill2';
          else if (ratio <= def.phaseRules.initialSkill2Threshold) pending = 'skill2';
        }
        if (pending && enemy.phase.pending !== pending && enemy.phase.current !== pending) {
          const phase = Object.assign({}, enemy.phase, { pending, pendingAppliesAt: 'nextEnemySkillSlot' });
          emit(slot, 'PHASE_PENDING', enemyId, enemyId, { pending }, [mutation(['enemiesById', enemyId, 'phase'], phase)]);
        }
      }
      recordFinalHourSourceDamage(slot, enemyId, amount);
      return amount;
    }

    function weightedEnemyTarget(damage) {
      const bossList = bosses(), dailyList = dailies();
      if (!bossList.length && !dailyList.length) return null;
      let group = dailyList.length ? 'daily' : 'boss';
      if (bossList.length && dailyList.length) {
        const weights = maps.rules.targetWeightsWithBoss[dailyList.length];
        if (!weights) fail('INVALID_STATE', 'unsupported daily count for target weights');
        group = rng.int(1, 100) <= weights.daily ? 'daily' : 'boss';
      }
      const pool = group === 'daily' ? dailyList : bossList;
      if (pool.length > 1) fail('UNCONFIGURED_FAVORABLE_TARGET_POLICY', 'multiple targets require an approved favorable-target tie-break');
      return pool[0] || null;
    }

    function enemyTarget() {
      const ids = livingCharacters();
      if (!ids.length) return null;
      const ceresActive = ids.includes('ceres');
      const scores = ids.map(id => {
        const slot = ['supporter','defender','attacker'].find(name => current.partySlots[name].characterId === id);
        let base = maps.rules.hate[slot];
        if (ceresActive) base += id === 'ceres' ? 10 : -5;
        return { id, score: base + rng.int(maps.rules.hate.randomBonusMin, maps.rules.hate.randomBonusMax) };
      });
      scores.sort((a,b) => b.score - a.score || a.id.localeCompare(b.id));
      return scores[0].id;
    }

    function resolveEnemyAttack(slot, enemy, profile, type) {
      if (!profile) fail('UNCONFIGURED_ENEMY_ACTION', `enemy action is unconfigured for ${enemy.definitionId}`);
      const targets = [];
      if (profile.pattern === 'single') {
        const target = enemyTarget(); if (target) targets.push(target);
      } else if (profile.pattern === 'all') targets.push(...livingCharacters());
      else if (profile.pattern === 'multi3') {
        for (let i = 0; i < 3 && livingCharacters().length; i++) targets.push(enemyTarget());
      } else fail('UNCONFIGURED_ENEMY_ACTION', `unknown enemy pattern ${profile.pattern}`);
      mainAction(slot, type, enemy.instanceId, targets, { profileId: profile.id, hits: targets.length });
      targets.forEach(targetId => {
        if (current.charactersById[targetId] && current.charactersById[targetId].hp > 0) {
          damageCharacter(slot, enemy.instanceId, targetId, profile.damagePerHit, true);
          if (profile.statusId && current.charactersById[targetId].hp > 0) applyStatus(slot, profile.statusId, 'character', targetId, 'enemy', enemy.instanceId, { pureDamage: profile.pureDamage, dotDamage: profile.dotDamage || null });
        }
      });
      completeMainAction(slot);
    }

    function consumeSp(slot, characterId, amount, reason) {
      const before = current.charactersById[characterId].sp;
      if (before === null || before < amount) return false;
      emit(slot, 'SP_CHANGED', characterId, characterId, { amount: -amount, reason }, [mutation(['charactersById', characterId, 'sp'], before - amount)]);
      const bind = statusInstancesFor('character', characterId, 'bind')[0];
      if (bind) {
        const live = current.statusInstances[bind.instanceId];
        const next = battleEvents.safeClone(live, '$bind', 0);
        next.counters.spentSpToClearRemaining = Math.max(0, next.counters.spentSpToClearRemaining - amount);
        if (next.counters.spentSpToClearRemaining === 0) removeStatus(slot, live, 'existingSpSpent');
        else setStatusInstance(slot, live, next, 'BIND_SP_SPENT', { remaining:next.counters.spentSpToClearRemaining });
      }
      return true;
    }

    function grantSp(slot, sourceId, characterId, requested, reason) {
      const character = current.charactersById[characterId];
      if (!character || character.sp === null || requested <= 0) return 0;
      let allowed = requested;
      const bind = statusInstancesFor('character', characterId, 'bind')[0];
      if (bind) {
        const blocked = Math.min(allowed, bind.counters.spBlockRemaining);
        allowed -= blocked;
        const live = current.statusInstances[bind.instanceId];
        const next = battleEvents.safeClone(live, '$bind', 0);
        next.counters.spBlockRemaining -= blocked;
        emit(slot, 'SP_BLOCKED', live.sourceId, characterId, { requested, blocked, reason }, []);
        if (next.counters.spBlockRemaining <= 0) removeStatus(slot, live, 'spBlockExhausted');
        else setStatusInstance(slot, live, next, 'BIND_SP_BLOCKED', { remaining:next.counters.spBlockRemaining });
      }
      const before = current.charactersById[characterId].sp;
      const after = Math.min(5, before + allowed);
      if (after > before) emit(slot, 'SP_CHANGED', sourceId, characterId, { amount:after-before, reason }, [mutation(['charactersById',characterId,'sp'],after)]);
      return after - before;
    }

    function resolveAttackerA() {
      if (input.attackerSkillId === null) return;
      const attackerId = current.partySlots.attacker.characterId;
      const actor = current.charactersById[attackerId];
      const skill = maps.skills[input.attackerSkillId];
      if (!actor || !skill || skill.ownerId !== attackerId || skill.kind !== 'A') fail('INVALID_SKILL_ID', 'attackerSkillId does not belong to assigned Attacker');
      if (actor.hp <= 0) { emit(2, 'SKILL_SKIPPED', attackerId, null, { skillId: skill.id, reason: 'knockout' }, []); return; }
      const availableActions = attackerId === 'elliott' ? 1 : actor.sp;
      if (!Number.isInteger(availableActions) || availableActions <= 0) { emit(2, 'SKILL_SKIPPED', attackerId, null, { skillId: skill.id, reason:'noActionCount' }, []); return; }
      const freeze = statusInstancesFor('character', attackerId, 'freeze')[0];
      if (freeze) {
        const disabled = rng.int(1, 100) <= 20;
        const next = battleEvents.safeClone(freeze, '$freeze', 0);
        next.counters.attemptsRemaining -= 1;
        setStatusInstance(2, freeze, next, 'STATUS_ATTEMPT_RESOLVED', { disabled, skillKind: 'A' });
        if (next.counters.attemptsRemaining <= 0) removeStatus(2, next, 'attemptsExhausted');
        if (disabled) { emit(2, 'SKILL_DISABLED', attackerId, null, { skillId: skill.id, statusId: 'freeze' }, []); tickPoisonAfterSkillAttempt(2, attackerId); return; }
      }
      let damage = 0, target = null, targets = [], spCost = skill.spCost;
      let gravityMultiplier = 1;
      if (skill.id === 'linnet_a_tame_attack') {
        const roster = Array.isArray(actor.resources.tameRoster) ? actor.resources.tameRoster : [];
        const allowed = [0,1,3,5][input.dailyResult];
        const participants = Math.min(allowed, roster.length);
        if (!participants) { emit(2, 'SKILL_SKIPPED', attackerId, null, { skillId: skill.id, reason: 'noTameParticipants' }, []); return; }
        damage = participants * 50; target = weightedEnemyTarget(damage);
      } else if (skill.id === 'sierra_a_sniper_rifle') {
        target = bosses()[0] || null;
        if (!target) { emit(2, 'SKILL_SKIPPED', attackerId, null, { skillId: skill.id, reason: 'noBoss' }, []); return; }
        if ((actor.resources.faceCoins || 0) < 5) { emit(2, 'SKILL_SKIPPED', attackerId, target.instanceId, { skillId: skill.id, reason: 'insufficientFaceCoins' }, []); return; }
        damage = 1200;
      } else if (skill.id === 'noel_a_swing') {
        if (!consumeSp(2, attackerId, 1, skill.id)) { emit(2, 'SKILL_SKIPPED', attackerId, null, { skillId: skill.id, reason: 'insufficientSp' }, []); return; }
        gravityMultiplier = gravityMultiplierForSuccessfulNumericAction(2, attackerId);
        mainAction(2, 'ALLY_A_SKILL', attackerId, null, { skillId: skill.id, hits: 5 });
        for (let i = 0; i < 5 && livingEnemies().length; i++) {
          const t = rng.pick(livingEnemies());
          const minRatio = Math.min(...livingCharacters().map(id => current.charactersById[id].hp / characterDef(id).maxHp));
          const accuracy = minRatio > .75 ? 80 : minRatio > .50 ? 65 : minRatio > .25 ? 50 : 35;
          const hit = rng.int(1,100) <= accuracy;
          const critical = hit && rng.int(1,100) <= 5;
          emit(2, hit ? 'HIT_CONFIRMED' : 'MISS', attackerId, t.instanceId, { hitIndex:i, critical }, []);
          if (hit) damageEnemy(2, attackerId, t.instanceId, (critical ? 200 : 100) * gravityMultiplier);
        }
        completeMainAction(2);
        tickPoisonAfterSkillAttempt(2, attackerId);
        return;
      } else if (skill.id === 'rg_a_rune_fist') {
        const runes = actor.resources.runesByStatusId || {};
        const count = clamp(Math.max(1, Object.keys(runes).length), 1, 6);
        damage = skill.damageByRuneCount[count]; target = weightedEnemyTarget(damage);
      } else if (skill.id === 'myart_a_weakness_protocol') {
        if (!actor.flags.weaknessProtocolDeveloped) fail('UNCONFIGURED_SKILL_STATE', 'Phase B requires an already-developed Weakness Protocol state');
        const count = livingEnemies().length; damage = 200 * count; targets = livingEnemies(); spCost = 0;
      } else if (skill.id === 'ceres_a_sacred_stigma') {
        const def = characterDef(attackerId);
        const barrierLoss = Number(actor.resources.weeklyBarrierLoss || 0);
        damage = actor.flags.recoveryLocked ? 100 : (def.maxHp - Math.max(actor.hp, 100)) + barrierLoss;
        if (damage <= 0) { emit(2, 'SKILL_SKIPPED', attackerId, null, { skillId: skill.id, reason: 'zeroBaseDamage' }, []); return; }
        target = weightedEnemyTarget(damage);
      } else if (skill.id === 'elliott_a_brave') {
        emit(2, 'SKILL_REGISTERED_FOR_SU', attackerId, null, { skillId: skill.id }, []); tickPoisonAfterSkillAttempt(2, attackerId); return;
      } else if (skill.id === 'aria_a_sanctuary' || skill.id === 'irina_a_reinforcement') {
        fail('UNCONFIGURED_SKILL', `${skill.id} requires approved encounter/reinforcement configuration`);
      } else fail('UNCONFIGURED_SKILL', `no calculator handler for ${skill.id}`);

      if (!target && !targets.length) { emit(2, 'SKILL_SKIPPED', attackerId, null, { skillId: skill.id, reason: 'noTarget' }, []); return; }
      if (spCost > 0 && !consumeSp(2, attackerId, spCost, skill.id)) { emit(2, 'SKILL_SKIPPED', attackerId, target && target.instanceId, { skillId: skill.id, reason: 'insufficientSp' }, []); return; }
      if (skill.id === 'sierra_a_sniper_rifle') {
        const resources = Object.assign({}, actor.resources, { faceCoins: actor.resources.faceCoins - 5 });
        emit(2, 'RESOURCE_CHANGED', attackerId, attackerId, { resourceId: 'faceCoins', amount:-5 }, [mutation(['charactersById', attackerId, 'resources'], resources)]);
      }
      gravityMultiplier = gravityMultiplierForSuccessfulNumericAction(2, attackerId);
      damage = floorDamage(damage * gravityMultiplier);
      mainAction(2, 'ALLY_A_SKILL', attackerId, targets.length ? targets.map(v=>v.instanceId) : target.instanceId, { skillId: skill.id, damage });
      if (targets.length) targets.forEach(enemy => damageEnemy(2, attackerId, enemy.instanceId, damage));
      else damageEnemy(2, attackerId, target.instanceId, damage, { penetratesBarrier: skill.id === 'sierra_a_sniper_rifle' });
      completeMainAction(2);
      tickPoisonAfterSkillAttempt(2, attackerId);
    }

    function resolveLeader() {
      const leaderId = input.leaderCharacterId;
      if (leaderId === null) return;
      const slot = ['supporter','defender','attacker'].find(name => current.partySlots[name].characterId === leaderId);
      if (!slot || current.charactersById[leaderId].hp <= 0) { emit(4, 'LEADER_SKILL_SKIPPED', leaderId, null, { reason:'notLivingAssignedLeader' }, []); return; }
      emit(4, 'LEADER_SKILL', leaderId, null, { role: slot }, []);
      if (slot === 'supporter') {
        livingCharacters().filter(id => id !== leaderId).forEach(id => {
          const before = current.charactersById[id].hp;
          const after = Math.min(characterDef(id).maxHp, before + Math.floor(characterDef(id).maxHp * .05));
          if (after > before) emit(4, 'HEAL', leaderId, id, { amount:after-before, reason:'supporterLeader' }, [mutation(['charactersById',id,'hp'],after)]);
        });
      } else if (slot === 'defender') {
        livingCharacters().filter(id => id !== leaderId).forEach(id => {
          if (current.leaderCarry.defenderDamageReductionByCharacterId[id]) return;
          const all = Object.assign(Object.create(null), current.leaderCarry.defenderDamageReductionByCharacterId, { [id]: { multiplier:.5, remainingUses:1, grantedBy:leaderId } });
          emit(4, 'LEADER_CARRY_GRANTED', leaderId, id, { multiplier:.5 }, [mutation(['leaderCarry','defenderDamageReductionByCharacterId'], all)]);
        });
      } else {
        ['supporter','defender'].forEach(role => {
          const id = current.partySlots[role].characterId;
          if (!id || id === leaderId || current.charactersById[id].sp === null) return;
          grantSp(4, leaderId, id, 1, 'attackerLeader');
        });
      }
    }

    function selectSuTarget() { return weightedEnemyTarget(100); }

    emit(0, 'BATTLE_STARTED', null, null, { battleId: input.battleId, rngSeed: String(rngSeed) }, []);
    const earned = maps.rules.su.earnedByDailyResult[input.dailyResult];
    const oldPoints = current.battleProgress.suPoints;
    const totalPoints = oldPoints + earned;
    const alreadyUsed = current.battleProgress.dailySuUsedOn === input.battleDate;
    if (alreadyUsed) fail('DAILY_RESULT_ALREADY_USED', 'SU points for this date were already processed');
    const activateSu = totalPoints >= maps.rules.su.activationCost;
    const remainder = activateSu ? totalPoints - maps.rules.su.activationCost : totalPoints;
    emit(0, 'SU_POINTS_EARNED', null, null, { dailyResult:input.dailyResult, earned, before:oldPoints, after:remainder, activationReserved:activateSu }, [mutation(['battleProgress','suPoints'], remainder)]);

    const slotOne = [{ kind:'sora' }].concat(livingEnemies().map(enemy => ({ kind:'enemy', id:enemy.instanceId })));
    for (let i = slotOne.length - 1; i > 0; i--) { const j = rng.int(0, i); const tmp = slotOne[i]; slotOne[i] = slotOne[j]; slotOne[j] = tmp; }
    slotOne.forEach(action => {
      if (action.kind === 'sora') {
        const target = weightedEnemyTarget(100);
        if (target) { mainAction(1, 'PROTAGONIST_NORMAL', 'sora', target.instanceId, { damage:100 }); damageEnemy(1, 'sora', target.instanceId, 100); completeMainAction(1); }
      } else {
        const enemy = current.enemiesById[action.id];
        if (enemy && !enemy.defeated && enemy.hp > 0) resolveEnemyAttack(1, enemy, { id:'normal', pattern:'single', damagePerHit:100, statusId:null }, 'ENEMY_NORMAL');
      }
    });

    resolveAttackerA();

    livingEnemies().filter(enemy => enemy.kind === 'weekly' || enemy.kind === 'areaBoss').forEach(enemy => {
      if (enemy.phase.pending && enemy.phase.pendingAppliesAt === 'nextEnemySkillSlot') {
        const phase = { current:enemy.phase.pending, pending:null, pendingAppliesAt:null };
        emit(3, 'PHASE_CHANGED', enemy.instanceId, enemy.instanceId, { phase:phase.current }, [mutation(['enemiesById',enemy.instanceId,'phase'],phase)]);
      }
      const def = enemyDef(current.enemiesById[enemy.instanceId]);
      const profile = maps.skillProfiles[def.skillProfileId];
      resolveEnemyAttack(3, current.enemiesById[enemy.instanceId], profile, 'ENEMY_SKILL');
    });

    if (activateSu) {
      emit(4, 'SU_POINTS_CONSUMED', null, null, { cost:5 }, [mutation(['battleProgress','dailySuUsedOn'], input.battleDate)]);
      emit(4, 'STAR_ROAD_RECONNECTION', 'sora', livingCharacters(), {}, []);
      ['supporter','defender','attacker'].forEach(role => {
        const id = current.partySlots[role].characterId;
        if (id && current.charactersById[id].hp === 0) emit(4, 'REVIVE', 'sora', id, { hp:100 }, [mutation(['charactersById',id,'hp'],100)]);
      });
      resolveLeader();
      const weeklyCount = current.missions.weekly.clearCount;
      const hits = weeklyCount >= 3 ? 10 : maps.rules.unionHitsByWeeklyClearCount[weeklyCount];
      if (!Number.isInteger(hits) || hits < 1 || hits > MAX_HITS) fail('HIT_LIMIT', 'invalid SU hit count');
      mainAction(4, weeklyCount ? 'OVERBREAK' : 'STARLIGHT_UNION', 'party', null, { hits, damagePerHit:100 });
      for (let i = 0; i < hits && livingEnemies().length; i++) {
        const target = selectSuTarget();
        if (!target) break;
        emit(4, 'HIT_CONFIRMED', 'party', target.instanceId, { hitIndex:i, damage:100 }, []);
        damageEnemy(4, 'party', target.instanceId, 100);
      }
      completeMainAction(4);
    }

    emit(4, 'BATTLE_FINISHED', null, null, { rng: rng.snapshot(), actionCount }, []);
    const replay = battleEvents.replayBattleEvents(startSnapshot, events, current);
    if (!replay.matchesExpected) fail('REPLAY_MISMATCH', 'event replay did not match final snapshot');
    return Object.freeze({ battleId: input.battleId, events: Object.freeze(events), finalSnapshot: current, rng: rng.snapshot() });
  }

  return Object.freeze({ calculateBattle, validateInput, validateBattleState, LIMITS:Object.freeze({ maxActions:MAX_ACTIONS, maxHits:MAX_HITS, maxEvents:battleEvents.LIMITS.maxEvents }) });
});
