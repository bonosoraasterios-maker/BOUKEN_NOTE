(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.seededRng = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function seedToUint32(seed) {
    if (typeof seed !== 'string' && typeof seed !== 'number') throw new TypeError('rngSeed must be a string or finite number');
    if (typeof seed === 'number' && !Number.isFinite(seed)) throw new TypeError('rngSeed must be finite');
    const text = String(seed);
    if (!text.length || text.length > 256) throw new RangeError('rngSeed length must be 1..256');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRng(seed) {
    let state = seedToUint32(seed) || 0x6d2b79f5;
    let draws = 0;
    function nextUint32() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      draws += 1;
      return (value ^ (value >>> 14)) >>> 0;
    }
    return Object.freeze({
      next: () => nextUint32() / 4294967296,
      int: (min, max) => {
        if (!Number.isInteger(min) || !Number.isInteger(max) || min > max || max - min > 1000000) throw new RangeError('invalid integer RNG range');
        return min + (nextUint32() % (max - min + 1));
      },
      pick: array => {
        if (!Array.isArray(array) || array.length < 1 || array.length > 256) throw new RangeError('invalid RNG pick array');
        return array[nextUint32() % array.length];
      },
      snapshot: () => Object.freeze({ state: state >>> 0, draws })
    });
  }

  return Object.freeze({ seedToUint32, createSeededRng });
});
