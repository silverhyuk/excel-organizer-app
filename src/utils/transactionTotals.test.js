import assert from 'node:assert/strict';
import test from 'node:test';

import { getTransactionAmount, sumTransactionAmounts } from './transactionTotals.js';

test('uses the actual transaction direction independently of its category', () => {
  assert.equal(getTransactionAmount({ category: 'income', withdrawal: 120000, deposit: 0 }), 120000);
  assert.equal(getTransactionAmount({ category: 'etc', withdrawal: 0, deposit: 250000 }), 250000);
  assert.equal(sumTransactionAmounts([
    { category: 'income', withdrawal: 120000, deposit: 0 },
    { category: 'etc', withdrawal: 0, deposit: 250000 }
  ]), 370000);
});
