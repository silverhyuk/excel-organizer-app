import * as XLSX from 'xlsx';

/**
 * Standardize column keys to help map varying bank formats
 */
const COLUMN_MAPPINGS = {
  date: ['거래일시', '거래일자', '일자', '날짜', '일시', '일자시간', '거래일', 'date', 'datetime'],
  description: ['적요', '내용', '거래내용', '기재내용', '가맹점명', '수신인', '보낸분/받는분', '거래처', 'description', 'memo', 'payee'],
  withdrawal: ['출금액', '출금금액', '찾으신금액', '지출', '지급액', '지급', 'withdrawal', 'out', 'expense'],
  deposit: ['입금액', '입금금액', '맡기신금액', '수입', '입금', 'deposit', 'in', 'income'],
  balance: ['잔액', '거래후잔액', '잔고', 'balance']
};

/**
 * Parse an Excel file arrayBuffer and extract bank transaction list
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<Array>} Standardized transactions list
 */
export function parseExcelTransactions(arrayBuffer) {
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
        if (currentMapping.date !== undefined && (currentMapping.description !== undefined || currentMapping.withdrawal !== undefined)) {
          headerRowIndex = i;
          mappingsFound = currentMapping;
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        // Fallback: If no headers match, try to use the first row that has 3+ populated columns
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i].filter(val => val !== '');
          if (row.length >= 4) {
            headerRowIndex = i;
            // Generate raw mapping based on indices
            mappingsFound = { date: 0, description: 1, withdrawal: 2, deposit: 3, balance: 4 };
            break;
          }
        }
      }
      
      if (headerRowIndex === -1) {
        throw new Error('올바른 계좌 내역 엑셀 포맷을 찾을 수 없습니다. 날짜, 거래내용, 출금액 등의 열이 필요합니다.');
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
        
        // Skip row if it has no financial value change
        if (withdrawalVal === 0 && depositVal === 0) continue;
        
        transactions.push({
          id: `tx-${i}-${Date.now()}`,
          date: dateVal,
          description: descVal,
          withdrawal: withdrawalVal,
          deposit: depositVal,
          balance: balanceVal,
          category: 'etc' // default, classified dynamically
        });
      }
      
      // Sort by date ascending (oldest first)
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      resolve(transactions);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Identify indices of columns matching bank mappings
 */
function findHeaderMapping(row) {
  const mapping = {};
  
  row.forEach((cell, index) => {
    if (!cell) return;
    const cellStr = String(cell).replace(/\s+/g, '').toLowerCase();
    
    for (const [key, aliases] of Object.entries(COLUMN_MAPPINGS)) {
      for (const alias of aliases) {
        if (cellStr.includes(alias)) {
          mapping[key] = index;
          break;
        }
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

/**
 * Export standardized data array back to Excel file
 * @param {Array} transactions 
 * @param {object} rules 
 * @returns {ArrayBuffer} 
 */
export function exportToExcel(transactions, rules) {
  const exportData = transactions.map((tx, idx) => ({
    '번호': idx + 1,
    '거래일시': tx.date,
    '거래처/적요': tx.description,
    '분류 카테고리': rules[tx.category]?.name || '미분류',
    '출금액(지출)': tx.withdrawal || 0,
    '입금액(수입)': tx.deposit || 0,
    '잔액': tx.balance || 0
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // Auto fit columns
  const colWidths = [
    { wch: 6 },  // 번호
    { wch: 20 }, // 거래일시
    { wch: 25 }, // 거래처/적요
    { wch: 15 }, // 분류 카테고리
    { wch: 15 }, // 출금액
    { wch: 15 }, // 입금액
    { wch: 15 }  // 잔액
  ];
  worksheet['!cols'] = colWidths;
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '정리된 거래 내역');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return excelBuffer;
}
