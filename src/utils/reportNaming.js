const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]+/g;
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function detectSettlementPeriod(transactions) {
  const months = transactions.flatMap(transaction => {
    const match = String(transaction?.date || '').match(/(?:^|\D)(\d{4})\s*(?:[-./]|년)\s*(\d{1,2})/);
    if (!match) return [];
    const month = Number(match[2]);
    if (month < 1 || month > 12) return [];
    return [`${match[1]}-${String(month).padStart(2, '0')}`];
  }).sort();

  if (months.length === 0) return '기간미상';
  const firstMonth = months[0];
  const lastMonth = months.at(-1);
  return firstMonth === lastMonth ? firstMonth : `${firstMonth}_${lastMonth}`;
}

export function inferBusinessName(sourceFileName) {
  const baseName = String(sourceFileName || '')
    .normalize('NFC')
    .replace(/\.xlsx?$/i, '')
    .replace(/\b\d{2,}\s*\(\s*[^)]*~[^)]*\)\s*/g, ' ')
    .replace(/\d{4}\s*(?:[-_.]|년)\s*\d{1,2}\s*(?:월)?(?:\s*[-_.]?\s*\d{1,2}\s*(?:일)?)?/g, ' ')
    .replace(/(?:입출금|계좌)?\s*거래\s*내역\s*(?:조회|서)?/gi, ' ')
    .replace(/(?:입출금|계좌|정산)\s*내역\s*(?:조회|서)?/gi, ' ')
    .replace(/[_\-.\s]+/g, ' ')
    .trim();

  return baseName || '사업장';
}

export function normalizeDownloadFileName(fileName) {
  let baseName = String(fileName || '')
    .trim()
    .replace(/\.xlsx?$/i, '')
    .replace(INVALID_FILE_NAME_CHARS, '_')
    .replace(/_+/g, '_')
    .trim()
    .replace(/[. ]+$/g, '');

  if (!baseName) baseName = '월정산';
  if (RESERVED_WINDOWS_NAMES.test(baseName)) baseName = `_${baseName}`;
  return `${baseName}.xlsx`;
}

export function createReportNaming(transactions, sourceFileName) {
  const businessName = inferBusinessName(sourceFileName);
  const settlementPeriod = detectSettlementPeriod(transactions);
  return {
    title: `${businessName} ${settlementPeriod} 월 정산`,
    fileName: normalizeDownloadFileName(`${businessName}_${settlementPeriod}_월정산.xlsx`)
  };
}
