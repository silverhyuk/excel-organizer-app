import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLearnedVendorDetail,
  getDetailPatterns,
  getDetailRuleKey,
  matchesDetail,
  normalizeVendorText,
  validateMatchPattern
} from './vendorMatcher.js';

test('normalizes account prefixes and common corporation markers', () => {
  assert.equal(normalizeVendorText('011 ㈜코원 에너지'), '코원에너지');
  assert.equal(normalizeVendorText('(주) 한빛전기'), '한빛전기');
});

test('matches any configured alias with contains matching', () => {
  const detail = {
    keyword: '한국전력공사',
    aliases: ['한전', 'KEPCO'],
    matchType: 'contains'
  };

  assert.equal(matchesDetail('004한전 전기요금', detail), true);
  assert.equal(matchesDetail('KEPCO PAYMENT', detail), true);
});

test('supports exact and regular expression matching', () => {
  assert.equal(matchesDetail('011 KT', { keyword: 'KT', aliases: [], matchType: 'exact' }), true);
  assert.equal(matchesDetail('KT통신요금', { keyword: 'KT', aliases: [], matchType: 'exact' }), false);
  assert.equal(matchesDetail('호텔 2026-07 정산', { keyword: '^호텔\\s+\\d{4}-\\d{2}', aliases: [], matchType: 'regex' }), true);
});

test('rejects an invalid regular expression', () => {
  assert.match(validateMatchPattern('[', 'regex'), /정규식/);
  assert.equal(validateMatchPattern('^호텔', 'regex'), '');
});

test('creates an exact learned rule from a transaction description', () => {
  const detail = createLearnedVendorDetail('011 ㈜코원 에너지');

  assert.equal(detail.label, '㈜코원 에너지');
  assert.equal(detail.keyword, '011 ㈜코원 에너지');
  assert.equal(detail.matchType, 'exact');
  assert.deepEqual(detail.aliases, []);
  assert.equal(matchesDetail('코원에너지', detail), true);
});

test('memoizes parsed patterns for an unchanged detail object', () => {
  const detail = { keyword: '한국전력공사', aliases: ['한전'], matchType: 'contains' };

  assert.equal(getDetailPatterns(detail), getDetailPatterns(detail));
});

test('builds collision-safe keys for regex patterns containing alternation', () => {
  const first = { keyword: 'a|b', aliases: ['c'], matchType: 'regex' };
  const second = { keyword: 'a', aliases: ['b|c'], matchType: 'regex' };

  assert.notEqual(getDetailRuleKey(first), getDetailRuleKey(second));
});
