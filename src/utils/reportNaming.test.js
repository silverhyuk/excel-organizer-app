import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReportNaming,
  detectSettlementPeriod,
  inferBusinessName,
  normalizeDownloadFileName
} from './reportNaming.js';

test('detects a single settlement month from transaction dates', () => {
  const period = detectSettlementPeriod([
    { date: '2026-06-30 23:50' },
    { date: '2026-06-01 09:00' }
  ]);

  assert.equal(period, '2026-06');
});

test('uses the first and last month when transactions span multiple months', () => {
  const period = detectSettlementPeriod([
    { date: '2026년 7월 01일' },
    { date: '2026-06-30' },
    { date: 'invalid' }
  ]);

  assert.equal(period, '2026-06_2026-07');
});

test('infers the business name from a typical bank export file name', () => {
  assert.equal(inferBusinessName('해오름호텔_2026-06_거래내역.xlsx'), '해오름호텔');
  assert.equal(inferBusinessName('2026년 6월 입출금내역.xls'), '사업장');
});

test('ignores a decomposed generic bank export name and account suffix', () => {
  const sourceFileName = '거래내역조회 2084( ~ ).xlsx'.normalize('NFD');

  assert.equal(inferBusinessName(sourceFileName), '사업장');
  assert.deepEqual(createReportNaming([{ date: '2026-06-15' }], sourceFileName), {
    title: '사업장 2026-06 월 정산',
    fileName: '사업장_2026-06_월정산.xlsx'
  });
});

test('creates editable report defaults from the source file and transaction period', () => {
  const naming = createReportNaming(
    [{ date: '2026-06-03' }, { date: '2026-06-28' }],
    '해오름호텔_거래내역.xlsx'
  );

  assert.deepEqual(naming, {
    title: '해오름호텔 2026-06 월 정산',
    fileName: '해오름호텔_2026-06_월정산.xlsx'
  });
});

test('removes unsafe file name characters and guarantees an xlsx extension', () => {
  assert.equal(normalizeDownloadFileName('해오름<호텔>:6월/정산?.xlsx'), '해오름_호텔_6월_정산_.xlsx');
  assert.equal(normalizeDownloadFileName('CON'), '_CON.xlsx');
  assert.equal(normalizeDownloadFileName('CON.txt'), '_CON.txt.xlsx');
  assert.equal(normalizeDownloadFileName('해오름.xlsx '), '해오름.xlsx');
  assert.equal(normalizeDownloadFileName('해오름_월정산.xlsx'.normalize('NFD')), '해오름_월정산.xlsx');
  assert.equal(normalizeDownloadFileName('...'), '월정산.xlsx');
});
