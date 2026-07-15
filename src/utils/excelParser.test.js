import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';

import { exportToExcel, parseExcelTransactions } from './excelParser.js';

test('keeps the exact withdrawal column when an input/output bank column follows it', async () => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['거래 내역'],
    ['일자', '보낸분/받는분', '', '입금', '출금', '', '잔액', '입출금은행'],
    ['2026-06-01 09:00', '예약 매출', '', 250000, '', '', 1250000, '신한6101'],
    ['2026-06-02 10:00', '011코원에너지', '', '', 105250, '', 1144750, '국민1234']
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '거래내역');
  const input = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const transactions = await parseExcelTransactions(input);

  assert.equal(transactions.length, 2);
  assert.equal(transactions.reduce((sum, tx) => sum + tx.withdrawal, 0), 105250);
  assert.equal(transactions.reduce((sum, tx) => sum + tx.deposit, 0), 250000);
});

test('exports summary values, consumes duplicate payees once, and creates the report layout', () => {
  const transactions = [
    { date: '2026-06-01', description: '예약 매출', withdrawal: 0, deposit: 250000, balance: 250000, category: 'etc' },
    { date: '2026-06-02', description: '003윤영기', withdrawal: 1870000, deposit: 0, balance: 0, category: 'etc' },
    { date: '2026-06-03', description: '011코원에너지', withdrawal: 105250, deposit: 0, balance: 0, category: 'etc' },
    { date: '2026-06-04', description: '홍현기', withdrawal: 660000, deposit: 0, balance: 0, category: 'etc' },
    { date: '2026-06-05', description: '홍현기', withdrawal: 1320000, deposit: 0, balance: 0, category: 'etc' }
  ];
  const workbook = XLSX.read(exportToExcel(transactions, {}), { type: 'array' });
  const report = workbook.Sheets['호텔 월 정산'];

  assert.equal(report.C5.v, 250000);
  assert.equal(report.C7.v, 1870000);
  assert.equal(report.C11.v, 105250);
  assert.equal(report.C83.v, 660000);
  assert.equal(report.C85.v, 1320000);
  assert.equal(report.C95.v, 1980000);
  assert.equal(report['!merges'].length, 136);
  assert.equal(workbook.Sheets['상세 거래 내역']['!ref'], 'A1:G6');
});
