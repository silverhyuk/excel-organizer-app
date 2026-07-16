import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeReportCategories } from './reportConfig.js';

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
