import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyTransaction } from './classifier.js';

const rules = {
  hotel: { name: '호텔', keywords: ['호텔'] },
  income: { name: '입금', keywords: [] },
  etc: { name: '기타 지출', keywords: [] }
};

test('classifies deposit-only transactions as income', () => {
  const transaction = { description: '예약 입금', withdrawal: 0, deposit: 250000 };
  assert.equal(classifyTransaction(transaction.description, rules, transaction), 'income');
});

test('continues to classify withdrawals by keyword', () => {
  const transaction = { description: '호텔 결제', withdrawal: 120000, deposit: 0 };
  assert.equal(classifyTransaction(transaction.description, rules, transaction), 'hotel');
});
