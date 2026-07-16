import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultReportCategories } from './reportConfig.js';
import { createSettlementValidationReport } from './settlementValidation.js';

test('uses report category calculations for totals and unclassified warnings', () => {
  const transactions = [
    { id: 'income', date: '2026-07-01', description: '예약 매출', withdrawal: 0, deposit: 500000 },
    { id: 'utility', date: '2026-07-02', description: '코원에너지', withdrawal: 105250, deposit: 0 },
    { id: 'unknown', date: '2026-07-03', description: '등록되지 않은 거래처', withdrawal: 330000, deposit: 0 }
  ];

  const report = createSettlementValidationReport(transactions, cloneDefaultReportCategories());

  assert.equal(report.canExport, true);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.totals, {
    dashboardDeposit: 500000,
    dashboardWithdrawal: 435250,
    reportDeposit: 500000,
    reportWithdrawal: 435250
  });
  assert.equal(report.warnings[0].id, 'unclassified');
  assert.deepEqual(report.warnings[0].transactionIds, ['unknown']);
});

test('blocks export when configured report categories omit transaction amounts', () => {
  const transactions = [
    { id: 'unknown', date: '2026-07-01', description: '등록되지 않은 거래처', withdrawal: 330000, deposit: 0 }
  ];
  const categoriesWithoutMisc = cloneDefaultReportCategories().filter(category => category.id !== 'misc');

  const report = createSettlementValidationReport(transactions, categoriesWithoutMisc);

  assert.equal(report.canExport, false);
  assert.equal(report.errors[0].id, 'totals-mismatch');
  assert.equal(report.totals.reportWithdrawal, 0);
});

test('reports exact duplicate transactions and inconsistent balance flow', () => {
  const transactions = [
    { id: 'first', date: '2026-07-01 09:00', description: '예약 매출', withdrawal: 0, deposit: 100000, balance: 100000 },
    { id: 'duplicate-a', date: '2026-07-02 09:00', description: '코원에너지', withdrawal: 10000, deposit: 0, balance: 90000 },
    { id: 'duplicate-b', date: '2026-07-02 09:00', description: '코원에너지', withdrawal: 10000, deposit: 0, balance: 70000 }
  ];

  const report = createSettlementValidationReport(transactions, cloneDefaultReportCategories());

  assert.deepEqual(report.warnings.map(warning => warning.id), ['duplicates', 'balance-flow']);
  assert.deepEqual(report.warnings[0].transactionIds, ['duplicate-a', 'duplicate-b']);
  assert.deepEqual(report.warnings[1].transactionIds, ['duplicate-a', 'duplicate-b']);
});

test('skips balance checks when the source has no balance column', () => {
  const transactions = [
    { id: 'first', date: '2026-07-01', description: '예약 매출', withdrawal: 0, deposit: 100000, balance: 0, hasBalance: false },
    { id: 'second', date: '2026-07-02', description: '코원에너지', withdrawal: 10000, deposit: 0, balance: 0, hasBalance: false }
  ];

  const report = createSettlementValidationReport(transactions, cloneDefaultReportCategories());

  assert.equal(report.warnings.some(warning => warning.id === 'balance-flow'), false);
});
