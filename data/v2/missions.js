(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.BOUKEN_NOTE_V2 = root.BOUKEN_NOTE_V2 || {};
  root.BOUKEN_NOTE_V2.missions = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const categories = {
    daily: Object.freeze([0, 1, 2].map(i => Object.freeze({ id: `daily_${i + 1}`, legacyIndex: i }))),
    weekly: Object.freeze([0, 1, 2].map(i => Object.freeze({ id: `weekly_${i + 1}`, legacyIndex: i }))),
    special: Object.freeze([0, 1, 2].map(i => Object.freeze({ id: `special_${i + 1}`, legacyIndex: i })))
  };
  return Object.freeze({ definitionsVersion: '2026-09-26-1117', categories: Object.freeze(categories) });
});
