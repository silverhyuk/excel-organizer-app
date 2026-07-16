import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

import { calculateReportCategoryView, exportToExcel, parseExcelTransactions } from './excelParser.js';
import { cloneDefaultReportCategories } from './reportConfig.js';

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

test('rejects unknown headers instead of guessing an input and output column order', async () => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['기준일', '거래명', '금액A', '금액B', '현재금액'],
    ['2026-06-01', '예약 매출', 250000, 0, 250000]
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '거래내역');
  const input = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  await assert.rejects(parseExcelTransactions(input), /엑셀 헤더를 찾을 수 없습니다/);
});

test('exports summary values while preserving the exact result.xlsx layout', async () => {
  const transactions = [
    { date: '2026-06-01', description: '예약 매출', withdrawal: 0, deposit: 250000, balance: 250000, category: 'etc' },
    { date: '2026-06-02', description: '003윤영기', withdrawal: 1870000, deposit: 0, balance: 0, category: 'etc' },
    { date: '2026-06-03', description: '011코원에너지', withdrawal: 105250, deposit: 0, balance: 0, category: 'etc' },
    { date: '2026-06-04', description: '홍현기', withdrawal: 660000, deposit: 0, balance: 0, category: 'etc' },
    { date: '2026-06-05', description: '홍현기', withdrawal: 1320000, deposit: 0, balance: 0, category: 'etc' }
  ];
  const template = await fs.readFile(new URL('../../result.xlsx', import.meta.url));
  const output = await exportToExcel(transactions, {}, template);
  const workbook = XLSX.read(output, { type: 'array', cellStyles: true });
  const report = workbook.Sheets['Sheet1'];

  assert.equal(report.C5.v, 250000);
  assert.equal(report.C7.v, 1870000);
  assert.equal(report.C11.v, 105250);
  assert.equal(report.C83.v, 660000);
  assert.equal(report.C85.v, 1320000);
  assert.equal(report.C95.v, 1980000);
  assert.equal(report['!merges'].length, 136);
  assert.deepEqual(workbook.SheetNames, ['Sheet1']);
  assert.equal(report.A1.v, '호텔 월 정산');
  assert.deepEqual(
    ['A9', 'A19', 'A23', 'A31', 'A81', 'A95'].map(cell => report[cell].v),
    ['총 급여', '공과금', '지출카드 ', '광고비', '지출', '기타잡비']
  );
  assert.deepEqual(
    ['C9', 'C19', 'C23', 'C31', 'C81', 'C95'].map(cell => report[cell].f),
    ['SUM(C7)', 'SUM(C11:F18)', 'SUM(C21)', 'SUM(C25:F30)', 'SUM(C33:F80)', 'SUM(C83:F94)']
  );
  assert.equal(report.C5.z, '_-* #,##0_-;\\-* #,##0_-;_-* "-"_-;_-@_-');
  assert.equal(report['!rows'][3].hpt, 20.25);
});

test('can remove and add predefined summary rows without changing report structure', async () => {
  const template = await fs.readFile(new URL('../../result.xlsx', import.meta.url));
  const output = await exportToExcel([], {}, template, {
    enabledSummaryRows: ['salary', 'card', 'advertising', 'expenses', 'misc']
  });
  const workbook = XLSX.read(output, { type: 'array', cellStyles: true });
  const report = workbook.Sheets.Sheet1;

  assert.equal(report['!rows'][18].hidden, true);
  assert.equal(report['!rows'][19].hidden, true);
  assert.equal(report['!rows'][8].hidden, undefined);
  assert.equal(report.A19.v, '공과금');
  assert.equal(report.C19.f, 'SUM(C11:F18)');
  assert.equal(report['!merges'].length, 136);
});

test('exports saved detail categories, hides removed items, and recalculates the major category', async () => {
  const template = await fs.readFile(new URL('../../result.xlsx', import.meta.url));
  const categories = cloneDefaultReportCategories();
  const utilities = categories.find(category => category.id === 'utilities');
  utilities.label = '관리비';
  utilities.details = [
    { id: 'gas-custom', label: '도시가스', keyword: '코원에너지' },
    { id: 'electric-custom', label: '전기료', keyword: '한전' }
  ];
  const transactions = [
    { description: '011코원에너지', withdrawal: 105250, deposit: 0 },
    { description: '한전 전기요금', withdrawal: 220000, deposit: 0 }
  ];

  const output = await exportToExcel(transactions, {}, template, { reportCategories: categories });
  const zip = await JSZip.loadAsync(output);
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml').async('string');
  const workbook = XLSX.read(output, { type: 'array', cellStyles: true });
  const report = workbook.Sheets.Sheet1;

  assert.equal(report.A11.v, '도시가스');
  assert.equal(report.G11.v, '코원에너지');
  assert.equal(report.C11.v, 105250);
  assert.equal(report.A13.v, '전기료');
  assert.equal(report.C13.v, 220000);
  assert.equal(report.C19.v, 325250);
  assert.equal(report.A19.v, '관리비');
  assert.equal(/<c\b[^>]*\bt="[^"]*"[^>]*\bt="/.test(sheetXml), false);
  assert.match(sheetXml, /<c r="A11" s="14" t="s"><v>\d+<\/v><\/c>/);
  assert.match(sharedStringsXml, /<si><t>도시가스<\/t><\/si>/);
  assert.equal(sheetXml.includes('inlineStr'), false);
  assert.equal(report['!rows'][14].hidden, true);
  assert.equal(report['!rows'][16].hidden, true);
  assert.equal(report['!rows'][20].hidden, true);
  assert.equal(report.A21.v, '');
  assert.equal(report.G21.v, '');
});

test('adds unclassified withdrawals to misc so exported expenses match the dashboard total', async () => {
  const template = await fs.readFile(new URL('../../result.xlsx', import.meta.url));
  const categories = cloneDefaultReportCategories();
  const transactions = [
    { description: '011코원에너지', withdrawal: 105250, deposit: 0 },
    { description: '등록되지 않은 거래처', withdrawal: 330000, deposit: 0 },
    { description: '예약 매출', withdrawal: 0, deposit: 500000 }
  ];

  const output = await exportToExcel(transactions, {}, template, { reportCategories: categories });
  const workbook = XLSX.read(output, { type: 'array', cellStyles: true });
  const report = workbook.Sheets.Sheet1;
  const exportedWithdrawal = ['C9', 'C19', 'C23', 'C31', 'C81', 'C95']
    .reduce((sum, cell) => sum + report[cell].v, 0);

  assert.equal(report.C5.v, 500000);
  assert.equal(report.C19.v, 105250);
  assert.equal(report.A93.v, '미분류 지출');
  assert.equal(report.C93.v, 330000);
  assert.equal(report.C95.v, 330000);
  assert.equal(exportedWithdrawal, 435250);
});

test('does not match a short description against a longer keyword', async () => {
  const template = await fs.readFile(new URL('../../result.xlsx', import.meta.url));
  const categories = cloneDefaultReportCategories().map(category => ({ ...category, details: [] }));
  categories.find(category => category.id === 'utilities').details = [
    { id: 'long-keyword', label: '인터넷', keyword: 'KT통신요금' }
  ];
  const transactions = [{ description: 'KT', withdrawal: 50000, deposit: 0 }];

  const output = await exportToExcel(transactions, {}, template, { reportCategories: categories });
  const workbook = XLSX.read(output, { type: 'array', cellStyles: true });
  const report = workbook.Sheets.Sheet1;

  assert.equal(report.C11.v, 0);
  assert.equal(report.C93.v, 50000);
  assert.equal(report.C95.v, 50000);
});

test('uses the same major category totals for the dashboard and exported report', () => {
  const categories = cloneDefaultReportCategories();
  const transactions = [
    { description: '011코원에너지', withdrawal: 105250, deposit: 0 },
    { description: '등록되지 않은 거래처', withdrawal: 330000, deposit: 0 },
    { description: '예약 매출', withdrawal: 0, deposit: 500000 }
  ];

  const view = calculateReportCategoryView(transactions, categories);

  assert.deepEqual(view.assignments, ['utilities', 'misc', 'income']);
  assert.equal(view.categories.find(category => category.id === 'utilities').total, 105250);
  assert.equal(view.categories.find(category => category.id === 'misc').total, 330000);
});

test('manual category overrides take precedence over salary name detection', () => {
  const categories = cloneDefaultReportCategories();
  const transactions = [
    {
      description: '003윤영기',
      withdrawal: 1870000,
      deposit: 0,
      categoryOverride: 'misc'
    }
  ];

  const view = calculateReportCategoryView(transactions, categories);

  assert.deepEqual(view.assignments, ['misc']);
  assert.equal(view.categories.find(category => category.id === 'salary').total, 0);
  assert.equal(view.categories.find(category => category.id === 'misc').total, 1870000);
});
