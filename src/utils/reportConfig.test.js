import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addLearnedVendorRule,
  createReportDetail,
  normalizeReportCategories,
  validateReportCategories
} from './reportConfig.js';

test('preserves arbitrary major categories and every detail item when saving configuration', () => {
  const categories = Array.from({ length: 12 }, (_, categoryIndex) => ({
    id: `major-${categoryIndex}`,
    label: `큰 카테고리 ${categoryIndex + 1}`,
    enabled: true,
    details: Array.from({ length: 30 }, (_, detailIndex) => ({
      id: `detail-${categoryIndex}-${detailIndex}`,
      label: `작은 카테고리 ${detailIndex + 1}`,
      keyword: `키워드 ${categoryIndex + 1}-${detailIndex + 1}`
    }))
  }));
  categories.push({ id: 'misc', label: '기타잡비', enabled: false, details: [] });

  const normalized = normalizeReportCategories(categories);

  assert.equal(normalized.length, 13);
  assert.equal(normalized[0].details.length, 30);
  assert.equal(normalized[11].details.length, 30);
  assert.equal(normalized.find(category => category.id === 'misc').enabled, true);
});

test('restores the required unclassified category without dropping custom categories', () => {
  const normalized = normalizeReportCategories([
    { id: 'custom', label: '사용자 카테고리', details: [] }
  ]);

  assert.deepEqual(normalized.map(category => category.id), ['custom', 'misc']);
});

test('preserves aliases and supported match types while normalizing saved settings', () => {
  const normalized = normalizeReportCategories([
    {
      id: 'utilities',
      label: '공과금',
      details: [{
        id: 'electricity',
        label: '전기',
        keyword: '한국전력공사',
        aliases: ['한전', '한전', '  KEPCO  ', ''],
        matchType: 'exact'
      }]
    }
  ]);

  assert.deepEqual(normalized[0].details[0], {
    id: 'electricity',
    label: '전기',
    keyword: '한국전력공사',
    aliases: ['한전', 'KEPCO'],
    matchType: 'exact'
  });
});

test('learns a vendor rule once in the selected category', () => {
  const initial = normalizeReportCategories([
    { id: 'utilities', label: '공과금', details: [] },
    { id: 'misc', label: '기타잡비', details: [] }
  ]);

  const learned = addLearnedVendorRule(initial, 'utilities', '011 ㈜코원 에너지');
  const repeated = addLearnedVendorRule(learned.categories, 'utilities', '코원에너지');

  assert.equal(learned.added, true);
  assert.equal(repeated.added, false);
  assert.equal(repeated.categories[0].details.length, 1);
});

test('creates report detail ids through the safe config id generator', () => {
  const detail = createReportDetail({ label: '전기', keyword: '한전' });

  assert.match(detail.id, /^detail-/);
  assert.equal(detail.matchType, 'contains');
});

test('rejects a non-salary detail without any match patterns', () => {
  const error = validateReportCategories([
    { id: 'utilities', label: '공과금', details: [{ id: 'empty', label: '전기', keyword: '', aliases: [], matchType: 'contains' }] }
  ]);

  assert.match(error, /키워드 또는 별칭/);
});
