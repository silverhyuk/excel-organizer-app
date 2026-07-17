import * as XLSX from 'xlsx';
import JSZip from 'jszip';

/**
 * Standardize column keys to help map varying bank formats
 */
const COLUMN_MAPPINGS = {
  date: ['거래일시', '거래일자', '일자', '날짜', '일시', '일자시간', '거래일', 'date', 'datetime'],
  description: ['적요', '내용', '거래내용', '기재내용', '가맹점명', '수신인', '보낸분/받는분', '거래처', 'description', 'memo', 'payee'],
  withdrawal: ['출금액', '출금금액', '출금', '찾으신금액', '지출', '지급액', '지급', 'withdrawal', 'out', 'expense'],
  deposit: ['입금액', '입금금액', '맡기신금액', '수입', '입금', 'deposit', 'in', 'income'],
  balance: ['잔액', '거래후잔액', '잔고', 'balance']
};

/**
 * Parse an Excel file arrayBuffer and extract transactions and account metadata
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<{ transactions: Array, accountHolderName: string }>}
 */
export function parseExcelFile(arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get the first worksheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert sheet to 2D array of raw values to locate header row
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (rawRows.length === 0) {
        throw new Error('엑셀 파일에 데이터가 존재하지 않습니다.');
      }
      
      // Find the header row index
      // Korean bank excels often have 3~10 rows of metadata (account number, period, etc.) at the top
      let headerRowIndex = -1;
      let mappingsFound = {};
      
      for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
        const row = rawRows[i];
        const currentMapping = findHeaderMapping(row);
        
        // If we found at least date and one of description/withdrawal/deposit, we assume this is the header row
        if (
          currentMapping.date !== undefined &&
          currentMapping.description !== undefined &&
          (currentMapping.withdrawal !== undefined || currentMapping.deposit !== undefined)
        ) {
          headerRowIndex = i;
          mappingsFound = currentMapping;
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        throw new Error('올바른 계좌 내역 엑셀 헤더를 찾을 수 없습니다. 날짜, 거래내용, 출금액 또는 입금액 열이 필요합니다.');
      }
      
      const transactions = [];
      
      // Parse transaction rows starting from headerRowIndex + 1
      for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        
        // Skip empty rows or summary rows
        if (!row || row.length === 0 || !row[mappingsFound.date]) continue;
        
        const dateVal = parseDate(row[mappingsFound.date]);
        const descVal = String(row[mappingsFound.description] || '').trim();
        
        // If date is invalid or description is empty, check if it's a summary row
        if (!dateVal || descVal.includes('합계') || descVal.includes('소계') || descVal.includes('누적')) continue;
        
        const withdrawalVal = parseNumber(row[mappingsFound.withdrawal]);
        const depositVal = parseNumber(row[mappingsFound.deposit]);
        const balanceVal = parseNumber(row[mappingsFound.balance]);
        const balanceCell = row[mappingsFound.balance];
        const hasBalance = mappingsFound.balance !== undefined
          && balanceCell !== undefined
          && balanceCell !== null
          && balanceCell !== '';
        
        // Skip row if it has no financial value change
        if (withdrawalVal === 0 && depositVal === 0) continue;
        
        transactions.push({
          id: `tx-${i}-${Date.now()}`,
          date: dateVal,
          description: descVal,
          withdrawal: withdrawalVal,
          deposit: depositVal,
          balance: balanceVal,
          hasBalance,
          category: 'etc' // default, classified dynamically
        });
      }
      
      // Sort by date ascending (oldest first)
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      resolve({
        transactions,
        accountHolderName: findAccountHolderName(rawRows.slice(0, headerRowIndex))
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function parseExcelTransactions(arrayBuffer) {
  const { transactions } = await parseExcelFile(arrayBuffer);
  return transactions;
}

function findAccountHolderName(rows) {
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (let index = 0; index < row.length; index++) {
      const cell = String(row[index] ?? '').normalize('NFC').trim();
      const inlineMatch = cell.match(/^(?:예금주명|예금주|계좌명의인)(?:\s*[:：]+\s*|\s+)([^:：].*)$/);
      const inlineValue = inlineMatch?.[1].trim();
      if (inlineValue) return inlineValue;

      const label = cell.replace(/\s*[:：]\s*$/, '');
      if (/^(?:예금주명|예금주|계좌명의인)$/.test(label)) {
        const value = row.slice(index + 1)
          .map(candidate => String(candidate ?? '').normalize('NFC').trim())
          .find(Boolean);
        if (value) return value;
      }
    }
  }
  return '';
}

/**
 * Identify indices of columns matching bank mappings
 */
function findHeaderMapping(row) {
  const mapping = {};
  const normalizedAliases = Object.fromEntries(
    Object.entries(COLUMN_MAPPINGS).map(([key, aliases]) => [
      key,
      aliases.map(alias => alias.replace(/\s+/g, '').toLowerCase())
    ])
  );
  
  row.forEach((cell, index) => {
    if (!cell) return;
    const cellStr = String(cell).replace(/\s+/g, '').toLowerCase();
    
    for (const [key, aliases] of Object.entries(normalizedAliases)) {
      // Do not let a later, broader header such as "입출금은행" replace
      // the exact "출금" column found earlier in the row.
      if (mapping[key] === undefined && aliases.includes(cellStr)) {
        mapping[key] = index;
      }
    }
  });

  row.forEach((cell, index) => {
    if (!cell) return;
    const cellStr = String(cell).replace(/\s+/g, '').toLowerCase();

    for (const [key, aliases] of Object.entries(normalizedAliases)) {
      if (
        mapping[key] === undefined &&
        aliases.some(alias => cellStr.startsWith(alias) || cellStr.endsWith(alias))
      ) {
        mapping[key] = index;
      }
    }
  });
  
  return mapping;
}

/**
 * Clean and parse numbers from excel cells (handles strings with commas, currency symbols, minus signs)
 */
function parseNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Math.abs(val);
  
  const cleaned = String(val).replace(/,/g, '').replace(/₩/g, '').replace(/\s/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parse various date formats from Korean bank exports
 */
function parseDate(val) {
  if (!val) return '';
  
  // If Excel serial date number
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    const m = String(date.m).padStart(2, '0');
    const d = String(date.d).padStart(2, '0');
    const h = String(date.H || 0).padStart(2, '0');
    const min = String(date.M || 0).padStart(2, '0');
    return `${date.y}-${m}-${d} ${h}:${min}`;
  }
  
  let dateStr = String(val).trim();
  
  // Format: "2026.07.14 12:30:00" or "2026/07/14" or "2026-07-14"
  // Normalize delimiters to dash
  dateStr = dateStr.replace(/[\.\/]/g, '-');
  
  // If date contains Korean chars like "2026년 07월 14일"
  dateStr = dateStr.replace(/년\s*/g, '-').replace(/월\s*/g, '-').replace(/일\s*/g, ' ');
  
  // Remove trailing dashes if any
  dateStr = dateStr.replace(/-\s*$/, '');
  
  return dateStr;
}

// Report template definitions matching result.xlsx
const REPORT_TEMPLATE = [
  { row: 1, type: "static", cells: { A: "호텔 월 정산" } },
  { row: 4, type: "static", cells: { A: "목차", C: "금액", G: "비고" } },
  { row: 5, type: "total_revenue", cells: { A: "총 매출액" } },
  { row: 7, type: "salary", cells: { A: "총 급여" } },
  { row: 9, type: "formula", formula: "SUM(C7)", cells: { A: "총 급여" } },
  { row: 11, type: "expense", keyword: "코원에너지", cells: { A: "가스요금", G: "코원에너지" } },
  { row: 13, type: "expense", keyword: "맑은물관리사업소", cells: { A: "수도요금", G: "맑은물관리사업소" } },
  { row: 15, type: "expense", keyword: "한전㈜카인드", cells: { A: "전기요금", G: "한전㈜카인드" } },
  { row: 17, type: "expense", keyword: "한국지역난방공사", cells: { A: "지역난방요금", G: "한국지역난방공사" } },
  { row: 19, type: "formula", formula: "SUM(C11:F18)", cells: { A: "공과금" } },
  { row: 21, type: "expense", keyword: "수협카드대금", cells: { A: "지출카드(수협)", G: "수협카드대금" } },
  { row: 23, type: "formula", formula: "SUM(C21)", cells: { A: "지출카드 " } },
  { row: 25, type: "expense", keyword: "㈜놀유니버스", cells: { A: "야놀자", G: "㈜놀유니버스" } },
  { row: 27, type: "expense", keyword: "㈜여기어때", cells: { A: "여기어때", G: "㈜여기어때" } },
  { row: 29, type: "expense", keyword: "서병주(잠자리컴퍼니)", cells: { A: "잠자리", G: "서병주(잠자리컴퍼니)" } },
  { row: 31, type: "formula", formula: "SUM(C25:F30)", cells: { A: "광고비" } },
  { row: 33, type: "expense", keyword: "김옥희", cells: { A: "세탁비", G: "김옥희" } },
  { row: 35, type: "expense", keyword: "㈜에이치투오솔", cells: { A: "객실 세탁비", G: "㈜에이치투오솔" } },
  { row: 37, type: "expense", keyword: "㈜아나한별유통", cells: { A: "비품비", G: "㈜아나한별유통" } },
  { row: 39, type: "expense", keyword: "고려유통", cells: { A: "식자재", G: "고려유통" } },
  { row: 41, type: "expense", keyword: "유림기업", cells: { A: "음식물쓰레기", G: "유림기업" } },
  { row: 43, type: "expense", keyword: "지앤씨바이오", cells: { A: "소독비", G: "지앤씨바이오" } },
  { row: 45, type: "expense", keyword: "㈜하이엠솔루텍", cells: { A: "에어컨 F.M", G: "㈜하이엠솔루텍" } },
  { row: 47, type: "expense", keyword: "현대엘레베이터", cells: { A: "엘리베이터 F.M", G: "현대엘레베이터" } },
  { row: 49, type: "expense", keyword: "현대엘레베이터", cells: { A: "카리프트 F.M", G: "현대엘레베이터" } },
  { row: 51, type: "expense", keyword: "이희윤", cells: { A: "매트세척비", G: "이희윤" } },
  { row: 53, type: "expense", keyword: "아하소프트", cells: { A: "벤사", G: "아하소프트" } },
  { row: 55, type: "expense", keyword: "산하정보기술", cells: { A: "산하정보기술", G: "산하정보기술" } },
  { row: 57, type: "expense", keyword: "노무법인신아", cells: { A: "노무법인 신아", G: "노무법인신아" } },
  { row: 59, type: "expense", keyword: "최종현(최종현세무회계)", cells: { A: "세무법인 최종현", G: "최종현(최종현세무회계)" } },
  { row: 61, type: "expense", keyword: "㈜에스원", cells: { A: "에스원", G: "㈜에스원" } },
  { row: 63, type: "expense", keyword: "KT", cells: { A: "KT(전화)", G: "KT" } },
  { row: 65, type: "expense", keyword: "KT통신요금", cells: { A: "KT(인터넷)", G: "KT통신요금" } },
  { row: 67, type: "expense", keyword: "카피올", cells: { A: "복사기", G: "카피올" } },
  { row: 69, type: "expense", keyword: "한화손해보험", cells: { A: "손해보험", G: "한화손해보험" } },
  { row: 71, type: "expense", keyword: "㈜에바센트", cells: { A: "향기마케팅", G: "㈜에바센트" } },
  { row: 73, type: "expense", keyword: "도솔방재", cells: { A: "도솔소방방재", G: "도솔방재" } },
  { row: 75, type: "expense", keyword: "한빛전기", cells: { A: "전기관리", G: "한빛전기" } },
  { row: 77, type: "expense", keyword: "㈜엑세스", cells: { A: "객실 OTT", G: "㈜엑세스" } },
  { row: 79, type: "expense", keyword: "㈜주안운수", cells: { A: "셔틀버스 서비스", G: "㈜주안운수" } },
  { row: 81, type: "formula", formula: "SUM(C33:F80)", cells: { A: "지출" } },
  { row: 83, type: "expense", keyword: "홍현기", cells: { A: "생수텍", G: "홍현기" } },
  { row: 85, type: "expense", keyword: "홍현기", cells: { A: "객실카드홀더", G: "홍현기" } },
  { row: 87, type: "expense", keyword: "황영주", cells: { A: "카드키 단말기", G: "황영주" } },
  { row: 89, type: "expense", keyword: "이순이", cells: { A: "식자재", G: "이순이" } },
  { row: 91, type: "expense", keyword: "㈜장안주류판매", cells: { A: "디너 소주/맥주", G: "㈜장안주류판매" } },
  { row: 93, type: "expense", keyword: "이순이", cells: { A: "식자재", G: "이순이" } },
  { row: 95, type: "formula", formula: "SUM(C83:F94)", cells: { A: "기타잡비" } }
];

export const SUMMARY_ROW_OPTIONS = [
  { id: 'salary', row: 9, label: '급여' },
  { id: 'utilities', row: 19, label: '공과금' },
  { id: 'card', row: 23, label: '지출카드' },
  { id: 'advertising', row: 31, label: '광고비' },
  { id: 'expenses', row: 81, label: '지출' },
  { id: 'misc', row: 95, label: '기타잡비' }
];

// Helper to clean descriptions/keywords for matching
function normalizeText(str) {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9가-힣]/g, '');
}

// Check if a transaction description matches a keyword
function checkKeywordMatch(desc, keyword) {
  const normDesc = normalizeText(desc);
  const normKw = normalizeText(keyword);
  
  if (normKw === '한전카인드') {
    return normDesc.includes('한전');
  }
  if (normKw === '에스원') {
    return normDesc.includes('s1') || normDesc.includes('에스원');
  }
  if (normKw === '한화손해보험') {
    return normDesc.includes('한화손');
  }
  if (normKw === '도솔방재') {
    return normDesc.includes('도솔');
  }
  if (normKw === '한빛전기') {
    return normDesc.includes('한빛');
  }
  if (normKw === '서병주잠자리컴퍼니') {
    return normDesc.includes('서병주') || normDesc.includes('잠자리');
  }
  if (normKw === '코원에너지') {
    return normDesc.includes('코원');
  }
  if (normKw === '맑은물관리사업소') {
    return normDesc.includes('맑은물');
  }
  if (normKw === '한국지역난방공사') {
    return normDesc.includes('난방');
  }
  if (normKw === '수협카드대금') {
    return normDesc.includes('수협카드');
  }
  if (normKw === '놀유니버스') {
    return normDesc.includes('놀유니버스');
  }
  if (normKw === '여기어때') {
    return normDesc.includes('여기어때컴퍼') || normDesc === '여기어때';
  }
  if (normKw === '에이치투오솔') {
    return normDesc.includes('에이치투오');
  }
  if (normKw === '아나한별유통') {
    return normDesc.includes('아나한별');
  }
  if (normKw === '유림기업') {
    return normDesc.includes('유림');
  }
  if (normKw === '하이엠솔루텍') {
    return normDesc.includes('하이엠');
  }
  if (normKw === '현대엘레베이터') {
    return normDesc.includes('현대엘');
  }
  if (normKw === '아하소프트') {
    return normDesc.includes('아하소프트');
  }
  if (normKw === '산하정보기술') {
    return normDesc.includes('산하');
  }
  if (normKw === '노무법인신아') {
    return normDesc.includes('신아');
  }
  if (normKw === '최종현최종현세무회계') {
    return normDesc.includes('최종현');
  }
  
  return normDesc.includes(normKw);
}

/**
 * Export standardized data array back to Excel file (Summary report + Detail list)
 * @param {Array} transactions 
 * @param {object} rules 
 * @returns {ArrayBuffer} 
 */
async function calculateReportValues(transactions) {
  const cValues = {};
  const expenseItems = REPORT_TEMPLATE.filter(item => item.type === 'expense');
  const keywordCounts = expenseItems.reduce((counts, item) => {
    const key = normalizeText(item.keyword);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const keywordOccurrences = {};
  
  // A. Build static and raw data cells
  REPORT_TEMPLATE.forEach(item => {
    // Fill calculated values in Column C
    if (item.type === 'total_revenue') {
      const totalDeposits = transactions.reduce((sum, tx) => sum + tx.deposit, 0);
      cValues[item.row] = totalDeposits;
    }
    
    else if (item.type === 'salary') {
      const vendorKeywords = [
        '코원', '맑은물', '한전', '난방', '수협', '놀유니버스', '여기어때', '잠자리', 
        '에이치투오', '아나한별', '유림', '하이엠', '현대엘', '이희윤', '아하소프트', 
        '산하', '신아', '카피올', '에바센트', '도솔', '한빛전기', '엑세스', '주안운수', 
        '홍현기', '황영주', '이순이', '장안주류', '한화손'
      ];
      
      const salarySum = transactions
        .filter(tx => {
          const desc = tx.description;
          const isNamePattern = /^\d{3}[가-힣]{2,4}$/.test(desc) || /^\d{3}[가-힣]{2,4}\(/.test(desc);
          const isVendor = vendorKeywords.some(kw => desc.includes(kw));
          return isNamePattern && !isVendor && tx.withdrawal > 0;
        })
        .reduce((sum, tx) => sum + tx.withdrawal, 0);
        
      cValues[item.row] = salarySum;
    }
    
    else if (item.type === 'expense') {
      const keyword = item.keyword;
      let expenseSum = 0;
      
      if (keyword === '현대엘레베이터' && item.cells['A'] === '엘리베이터 F.M') {
        expenseSum = transactions
          .filter(tx => checkKeywordMatch(tx.description, keyword) && tx.withdrawal === 726000)
          .reduce((sum, tx) => sum + tx.withdrawal, 0);
      } else if (keyword === '현대엘레베이터' && item.cells['A'] === '카리프트 F.M') {
        expenseSum = transactions
          .filter(tx => checkKeywordMatch(tx.description, keyword) && tx.withdrawal !== 726000)
          .reduce((sum, tx) => sum + tx.withdrawal, 0);
      } else if (keyword === 'KT' && item.cells['A'] === 'KT(전화)') {
        expenseSum = transactions
          .filter(tx => checkKeywordMatch(tx.description, keyword) && tx.withdrawal < 100000)
          .reduce((sum, tx) => sum + tx.withdrawal, 0);
      } else if (keyword === 'KT통신요금' && item.cells['A'] === 'KT(인터넷)') {
        expenseSum = transactions
          .filter(tx => checkKeywordMatch(tx.description, keyword))
          .reduce((sum, tx) => sum + tx.withdrawal, 0);
      } else {
        const matches = transactions.filter(
          tx => checkKeywordMatch(tx.description, keyword) && tx.withdrawal > 0
        );
        const normalizedKeyword = normalizeText(keyword);
        const occurrence = keywordOccurrences[normalizedKeyword] || 0;
        keywordOccurrences[normalizedKeyword] = occurrence + 1;

        if (keywordCounts[normalizedKeyword] > 1) {
          // Some report rows share a payee but represent separate purchases.
          // Allocate each transaction once instead of duplicating it in every row.
          const isLastOccurrence = occurrence === keywordCounts[normalizedKeyword] - 1;
          const allocated = isLastOccurrence ? matches.slice(occurrence) : matches.slice(occurrence, occurrence + 1);
          expenseSum = allocated.reduce((sum, tx) => sum + tx.withdrawal, 0);
        } else {
          expenseSum = matches.reduce((sum, tx) => sum + tx.withdrawal, 0);
        }
      }
      
      cValues[item.row] = expenseSum;
    }
  });
  
  // B. Process formula evaluation
  REPORT_TEMPLATE.forEach(item => {
    if (item.type === 'formula') {
      let sumValue = 0;
      if (item.formula === 'SUM(C7)') {
        sumValue = cValues[7] || 0;
      } else if (item.formula === 'SUM(C11:F18)') {
        for (let i = 11; i <= 18; i++) sumValue += cValues[i] || 0;
      } else if (item.formula === 'SUM(C21)') {
        sumValue = cValues[21] || 0;
      } else if (item.formula === 'SUM(C25:F30)') {
        for (let i = 25; i <= 30; i++) sumValue += cValues[i] || 0;
      } else if (item.formula === 'SUM(C33:F80)') {
        for (let i = 33; i <= 80; i++) sumValue += cValues[i] || 0;
      } else if (item.formula === 'SUM(C83:F94)') {
        for (let i = 83; i <= 94; i++) sumValue += cValues[i] || 0;
      }
      
      cValues[item.row] = sumValue;
    }
  });

  return cValues;
}

function replaceCellValue(sheetXml, cellRef, value) {
  const cellPattern = new RegExp(`(<c\\s+[^>]*r="${cellRef}"[^>]*>[\\s\\S]*?<v>)([^<]*)(</v>)`);
  if (!cellPattern.test(sheetXml)) {
    throw new Error(`기준 양식에서 ${cellRef} 셀을 찾을 수 없습니다.`);
  }
  return sheetXml.replace(cellPattern, `$1${value}$3`);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createSharedStringWriter(sharedStringsXml) {
  const initialUniqueCount = Number(sharedStringsXml.match(/uniqueCount="(\d+)"/)?.[1] || 0);
  const additions = [];
  const additionIndexes = new Map();
  return {
    add(value) {
      const text = String(value).normalize('NFC');
      if (additionIndexes.has(text)) return additionIndexes.get(text);
      additions.push(`<si><t>${escapeXml(text)}</t></si>`);
      const index = initialUniqueCount + additions.length - 1;
      additionIndexes.set(text, index);
      return index;
    },
    toXml() {
      const totalStringCount = initialUniqueCount + additions.length;
      return sharedStringsXml
        .replace(/\bcount="\d+"/, `count="${totalStringCount}"`)
        .replace(/uniqueCount="\d+"/, `uniqueCount="${totalStringCount}"`)
        .replace('</sst>', `${additions.join('')}</sst>`);
    }
  };
}

function isSalaryTransaction(transaction) {
  const vendorKeywords = [
    '코원', '맑은물', '한전', '난방', '수협', '놀유니버스', '여기어때', '잠자리',
    '에이치투오', '아나한별', '유림', '하이엠', '현대엘', '이희윤', '아하소프트',
    '산하', '신아', '카피올', '에바센트', '도솔', '한빛전기', '엑세스', '주안운수',
    '홍현기', '황영주', '이순이', '장안주류', '한화손'
  ];
  const description = transaction.description || '';
  const isNamePattern = /^\d{3}[가-힣]{2,4}$/.test(description) || /^\d{3}[가-힣]{2,4}\(/.test(description);
  return isNamePattern && !vendorKeywords.some(keyword => description.includes(keyword)) && transaction.withdrawal > 0;
}

function calculateConfiguredDetails(transactions, reportCategories) {
  const activeCategories = reportCategories.filter(category => category.enabled !== false);
  const allocatedTransactions = new Set();
  const categoryAssignments = new Map();
  const configuredCategoryIds = new Set(activeCategories.map(category => category.id));
  const manualTotals = new Map();
  const keywordTotals = new Map();
  const keywordIndexes = new Map();

  for (const transaction of transactions) {
    const categoryId = transaction.categoryOverride;
    if (!(transaction.withdrawal > 0) || !configuredCategoryIds.has(categoryId)) continue;
    allocatedTransactions.add(transaction);
    categoryAssignments.set(transaction, categoryId);
    manualTotals.set(categoryId, (manualTotals.get(categoryId) || 0) + transaction.withdrawal);
  }

  for (const category of activeCategories) {
    for (const detail of category.details) {
      if (!detail.keyword) continue;
      const normalized = normalizeText(detail.keyword);
      keywordTotals.set(normalized, (keywordTotals.get(normalized) || 0) + 1);
    }
  }

  const configured = activeCategories.map(category => {
    const details = category.details.map(detail => {
      if (detail.matchType === 'salary') {
        const selected = transactions.filter(tx => !allocatedTransactions.has(tx) && isSalaryTransaction(tx));
        selected.forEach(tx => {
          allocatedTransactions.add(tx);
          categoryAssignments.set(tx, category.id);
        });
        return { ...detail, value: selected.reduce((sum, tx) => sum + tx.withdrawal, 0) };
      }
      const matches = transactions.filter(
        tx => !allocatedTransactions.has(tx) && checkKeywordMatch(tx.description, detail.keyword) && tx.withdrawal > 0
      );
      const normalized = normalizeText(detail.keyword);
      const occurrence = keywordIndexes.get(normalized) || 0;
      keywordIndexes.set(normalized, occurrence + 1);
      let selected = matches;
      if ((keywordTotals.get(normalized) || 0) > 1) {
        const last = occurrence === keywordTotals.get(normalized) - 1;
        selected = last ? matches : matches.slice(0, 1);
      }
      if (normalized === '현대엘레베이터') {
        selected = matches.filter(tx => detail.label.includes('카리프트') ? tx.withdrawal !== 726000 : tx.withdrawal === 726000);
      } else if (normalized === 'KT') {
        selected = matches.filter(tx => tx.withdrawal < 100000);
      }
      selected.forEach(tx => {
        allocatedTransactions.add(tx);
        categoryAssignments.set(tx, category.id);
      });
      return { ...detail, value: selected.reduce((sum, tx) => sum + tx.withdrawal, 0) };
    });
    return {
      ...category,
      details,
      manualTotal: manualTotals.get(category.id) || 0,
      total: details.reduce((sum, detail) => sum + detail.value, 0) + (manualTotals.get(category.id) || 0)
    };
  });

  const unclassifiedTransactions = transactions
    .filter(tx => tx.withdrawal > 0 && !allocatedTransactions.has(tx));
  const unclassifiedTotal = unclassifiedTransactions
    .reduce((sum, tx) => sum + tx.withdrawal, 0);
  const misc = configured.find(category => category.id === 'misc');
  if (misc) {
    misc.details.push({
      id: 'unclassified-withdrawals',
      label: '미분류 지출',
      keyword: '',
      value: unclassifiedTotal
    });
    misc.total += unclassifiedTotal;
    unclassifiedTransactions.forEach(tx => categoryAssignments.set(tx, 'misc'));
  }

  return { configured, categoryAssignments, unclassifiedTransactions };
}

function calculateReportIncomeTotal(transactions) {
  return transactions.reduce((sum, transaction) => sum + (Number(transaction.deposit) || 0), 0);
}

export function calculateReportCategoryView(transactions, reportCategories) {
  const { configured, categoryAssignments, unclassifiedTransactions } = calculateConfiguredDetails(transactions, reportCategories);
  const unclassified = new Set(unclassifiedTransactions);
  return {
    categories: configured,
    incomeTotal: calculateReportIncomeTotal(transactions),
    assignments: transactions.map(tx => (
      tx.deposit > 0 && !(tx.withdrawal > 0) ? 'income' : categoryAssignments.get(tx) || 'misc'
    )),
    unclassifiedIndexes: transactions.flatMap((tx, index) => unclassified.has(tx) ? [index] : [])
  };
}

function createSharedStringCell(ref, style, value, sharedStrings) {
  if (!value) return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}" t="s"><v>${sharedStrings.add(value)}</v></c>`;
}

function createNumberCell(ref, style, value, formula = '') {
  const formulaXml = formula ? `<f>${escapeXml(formula)}</f>` : '';
  return `<c r="${ref}" s="${style}">${formulaXml}<v>${Number(value) || 0}</v></c>`;
}

function createEmptyCell(ref, style) {
  return `<c r="${ref}" s="${style}"/>`;
}

function createDetailRows(row, detail, sharedStrings) {
  const hidden = detail.value > 0 ? '' : ' hidden="1"';
  const firstRow = [
    createSharedStringCell(`A${row}`, 14, detail.label, sharedStrings),
    createEmptyCell(`B${row}`, 14),
    createNumberCell(`C${row}`, 19, detail.value),
    ...['D', 'E', 'F'].map(column => createEmptyCell(`${column}${row}`, 19)),
    createSharedStringCell(`G${row}`, 14, detail.keyword, sharedStrings),
    createEmptyCell(`H${row}`, 14),
    createEmptyCell(`I${row}`, 14)
  ].join('');
  const secondRow = [
    ...['A', 'B'].map(column => createEmptyCell(`${column}${row + 1}`, 14)),
    ...['C', 'D', 'E', 'F'].map(column => createEmptyCell(`${column}${row + 1}`, 19)),
    ...['G', 'H', 'I'].map(column => createEmptyCell(`${column}${row + 1}`, 14))
  ].join('');
  return `<row r="${row}" spans="1:9"${hidden} x14ac:dyDescent="0.3">${firstRow}</row>`
    + `<row r="${row + 1}" spans="1:9"${hidden} x14ac:dyDescent="0.3">${secondRow}</row>`;
}

function createSummaryRows(row, category, detailStartRow, detailEndRow, sharedStrings) {
  const formula = detailStartRow <= detailEndRow ? `SUM(C${detailStartRow}:C${detailEndRow})` : '';
  const firstRow = [
    createSharedStringCell(`A${row}`, 28, category.label, sharedStrings),
    createEmptyCell(`B${row}`, 28),
    createNumberCell(`C${row}`, 21, category.total, formula),
    ...['D', 'E', 'F', 'G', 'H', 'I'].map(column => createEmptyCell(`${column}${row}`, 20))
  ].join('');
  const secondRow = [
    ...['A', 'B'].map(column => createEmptyCell(`${column}${row + 1}`, 29)),
    ...['C', 'D', 'E', 'F', 'G', 'H', 'I'].map(column => createEmptyCell(`${column}${row + 1}`, 22))
  ].join('');
  return `<row r="${row}" spans="1:9" ht="17.25" thickTop="1" x14ac:dyDescent="0.3">${firstRow}</row>`
    + `<row r="${row + 1}" spans="1:9" ht="17.25" thickBot="1" x14ac:dyDescent="0.35">${secondRow}</row>`;
}

function buildDynamicConfiguredReport(sheetXml, transactions, reportCategories, sharedStrings) {
  const { configured } = calculateConfiguredDetails(transactions, reportCategories);
  sheetXml = replaceCellValue(sheetXml, 'C5', calculateReportIncomeTotal(transactions));
  const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!sheetDataMatch) throw new Error('기준 양식의 시트 데이터를 찾을 수 없습니다.');
  const headerRows = [...sheetDataMatch[1].matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)]
    .filter(match => Number(match[1]) <= 6)
    .map(match => match[0])
    .join('');
  if (!headerRows.includes('r="6"')) throw new Error('기준 양식의 머리글 행을 찾을 수 없습니다.');

  const rows = [headerRows];
  const merges = ['A1:I3', 'A4:B4', 'C4:F4', 'G4:I4', 'A5:B6', 'C5:F6', 'G5:I6'];
  let currentRow = 7;
  for (const category of configured) {
    const exportDetails = [...category.details];
    if (category.manualTotal > 0) {
      exportDetails.push({
        id: `manual-${category.id}`,
        label: '수동 분류',
        keyword: '',
        value: category.manualTotal
      });
    }
    const detailStartRow = currentRow;
    for (const detail of exportDetails) {
      rows.push(createDetailRows(currentRow, detail, sharedStrings));
      merges.push(`A${currentRow}:B${currentRow + 1}`, `C${currentRow}:F${currentRow + 1}`, `G${currentRow}:I${currentRow + 1}`);
      currentRow += 2;
    }
    const detailEndRow = currentRow - 1;
    rows.push(createSummaryRows(currentRow, category, detailStartRow, detailEndRow, sharedStrings));
    merges.push(`A${currentRow}:B${currentRow + 1}`, `C${currentRow}:I${currentRow + 1}`);
    currentRow += 2;
  }
  const lastRow = Math.max(6, currentRow - 1);
  const mergeXml = `<mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
  return sheetXml
    .replace(/<dimension ref="[^"]+"\s*\/>/, `<dimension ref="A1:I${lastRow}"/>`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rows.join('')}</sheetData>`)
    .replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/, mergeXml);
}

function hideDisabledSummaryRows(sheetXml, enabledSummaryRows) {
  const enabled = new Set(enabledSummaryRows);

  for (const summary of SUMMARY_ROW_OPTIONS) {
    if (enabled.has(summary.id)) continue;

    for (const rowNumber of [summary.row, summary.row + 1]) {
      const rowPattern = new RegExp(`<row\\s+([^>]*\\br="${rowNumber}"[^>]*)>`);
      sheetXml = sheetXml.replace(rowPattern, (rowTag, attributes) => {
        const withoutHidden = attributes.replace(/\\s+hidden="[^"]*"/g, '');
        return `<row ${withoutHidden} hidden="1">`;
      });
    }
  }

  return sheetXml;
}

async function removeStaleCalculationChain(zip) {
  zip.remove('xl/calcChain.xml');

  const relationshipsPath = 'xl/_rels/workbook.xml.rels';
  const relationshipsFile = zip.file(relationshipsPath);
  if (relationshipsFile) {
    const relationshipsXml = await relationshipsFile.async('string');
    zip.file(
      relationshipsPath,
      relationshipsXml.replace(
        /<Relationship\b[^>]*\bType="[^"]*\/calcChain"[^>]*\/>/g,
        ''
      )
    );
  }

  const contentTypesPath = '[Content_Types].xml';
  const contentTypesFile = zip.file(contentTypesPath);
  if (contentTypesFile) {
    const contentTypesXml = await contentTypesFile.async('string');
    zip.file(
      contentTypesPath,
      contentTypesXml.replace(
        /<Override\b[^>]*\bPartName="\/xl\/calcChain\.xml"[^>]*\/>/g,
        ''
      )
    );
  }

  const workbookPath = 'xl/workbook.xml';
  const workbookFile = zip.file(workbookPath);
  if (workbookFile) {
    const workbookXml = await workbookFile.async('string');
    zip.file(
      workbookPath,
      workbookXml.replace(/<calcPr\b([^>]*)\/>/, (_, attributes) => {
        const cleaned = attributes
          .replace(/\s+fullCalcOnLoad="[^"]*"/g, '')
          .replace(/\s+forceFullCalc="[^"]*"/g, '');
        return `<calcPr${cleaned} fullCalcOnLoad="1" forceFullCalc="1"/>`;
      })
    );
  }
}

/**
 * Fill calculated values into the original result.xlsx package. Editing only
 * sheet XML keeps the template's styles, borders, merges and print settings.
 * @param {Array} transactions
 * @param {object} rules
 * @param {ArrayBuffer|Uint8Array} templateBuffer
 * @param {{ enabledSummaryRows?: string[], reportCategories?: Array, reportTitle?: string }} options
 * @returns {Promise<ArrayBuffer>}
 */
export async function exportToExcel(transactions, rules, templateBuffer, options = {}) {
  if (!templateBuffer) {
    throw new Error('result.xlsx 기준 양식을 불러오지 못했습니다.');
  }

  const zip = await JSZip.loadAsync(templateBuffer);
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) {
    throw new Error('result.xlsx 기준 양식의 첫 번째 시트를 찾을 수 없습니다.');
  }

  let sheetXml = await sheetFile.async('string');
  const hasDynamicReport = Array.isArray(options.reportCategories);
  const hasCustomTitle = Boolean(options.reportTitle?.trim());
  if (hasDynamicReport || hasCustomTitle) {
    const sharedStringsPath = 'xl/sharedStrings.xml';
    const sharedStringsFile = zip.file(sharedStringsPath);
    if (!sharedStringsFile) throw new Error('result.xlsx 기준 양식의 공유 문자열을 찾을 수 없습니다.');
    const sharedStrings = createSharedStringWriter(await sharedStringsFile.async('string'));
    if (hasCustomTitle) {
      sheetXml = replaceCellValue(sheetXml, 'A1', sharedStrings.add(options.reportTitle.trim()));
    }
    if (hasDynamicReport) {
      sheetXml = buildDynamicConfiguredReport(sheetXml, transactions, options.reportCategories, sharedStrings);
    }
    zip.file(sharedStringsPath, sharedStrings.toXml());
  }
  if (!hasDynamicReport) {
    const cValues = await calculateReportValues(transactions);
    for (const item of REPORT_TEMPLATE) {
      if (item.row < 5 || cValues[item.row] === undefined) continue;
      sheetXml = replaceCellValue(sheetXml, `C${item.row}`, cValues[item.row]);
    }
    const enabledSummaryRows = options.enabledSummaryRows
      ?? SUMMARY_ROW_OPTIONS.map(summary => summary.id);
    sheetXml = hideDisabledSummaryRows(sheetXml, enabledSummaryRows);
  }
  zip.file(sheetPath, sheetXml);
  if (hasDynamicReport) await removeStaleCalculationChain(zip);

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}
