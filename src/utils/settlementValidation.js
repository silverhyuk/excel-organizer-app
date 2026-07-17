import { calculateReportCategoryView } from './excelParser.js';

function transactionIds(transactions) {
  return transactions.map(transaction => transaction.id).filter(Boolean);
}

function duplicateKey(transaction) {
  return [
    transaction.date || '',
    String(transaction.description || '').replace(/\s+/g, '').toLowerCase(),
    Number(transaction.withdrawal) || 0,
    Number(transaction.deposit) || 0
  ].join('|');
}

function findDuplicateTransactions(transactions) {
  const groups = new Map();
  transactions.forEach(transaction => {
    const key = duplicateKey(transaction);
    const group = groups.get(key) || [];
    group.push(transaction);
    groups.set(key, group);
  });
  return [...groups.values()].filter(group => group.length > 1);
}

function hasBalance(transaction) {
  return transaction.hasBalance === true && Number.isFinite(transaction.balance);
}

function findAmbiguousSequenceDates(transactions) {
  const dateCounts = new Map();
  for (const transaction of transactions) {
    const date = String(transaction.date || '').trim();
    if (!date) continue;
    dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  }
  return new Set([...dateCounts].filter(([, count]) => count > 1).map(([date]) => date));
}

function findBalanceAnomalies(transactions) {
  const anomalies = [];
  const ambiguousSequenceDates = findAmbiguousSequenceDates(transactions);
  let previous = null;

  for (const transaction of transactions) {
    const date = String(transaction.date || '').trim();
    if (!hasBalance(transaction) || ambiguousSequenceDates.has(date)) {
      previous = null;
      continue;
    }
    if (previous) {
      const expected = previous.balance + (Number(transaction.deposit) || 0) - (Number(transaction.withdrawal) || 0);
      if (Math.abs(expected - transaction.balance) > 0.1) {
        anomalies.push({ previous, transaction, expected });
      }
    }
    previous = transaction;
  }

  return anomalies;
}

export function createSettlementValidationReport(transactions, reportCategories) {
  const reportView = calculateReportCategoryView(transactions, reportCategories);
  const dashboardDeposit = transactions.reduce((sum, transaction) => sum + (Number(transaction.deposit) || 0), 0);
  const dashboardWithdrawal = transactions.reduce((sum, transaction) => sum + (Number(transaction.withdrawal) || 0), 0);
  const reportDeposit = reportView.incomeTotal;
  const reportWithdrawal = reportView.categories.reduce((sum, category) => sum + category.total, 0);
  const errors = [];
  const warnings = [];

  if (dashboardDeposit !== reportDeposit || dashboardWithdrawal !== reportWithdrawal) {
    errors.push({
      id: 'totals-mismatch',
      title: '대시보드와 보고서 합계가 일치하지 않습니다.',
      description: `수입 ₩${dashboardDeposit.toLocaleString()} / ₩${reportDeposit.toLocaleString()} · 지출 ₩${dashboardWithdrawal.toLocaleString()} / ₩${reportWithdrawal.toLocaleString()} (대시보드 / 보고서)`,
      transactionIds: []
    });
  }

  const unclassified = reportView.unclassifiedIndexes.map(index => transactions[index]);
  if (unclassified.length > 0) {
    const amount = unclassified.reduce((sum, transaction) => sum + transaction.withdrawal, 0);
    const miscLabel = reportView.categories.find(category => category.id === 'misc')?.label || '기타잡비';
    warnings.push({
      id: 'unclassified',
      title: `미분류 거래 ${unclassified.length}건`,
      description: `총 ₩${amount.toLocaleString()}이 ${miscLabel}의 미분류 지출로 반영됩니다.`,
      transactionIds: transactionIds(unclassified)
    });
  }

  const duplicateGroups = findDuplicateTransactions(transactions);
  if (duplicateGroups.length > 0) {
    const duplicates = duplicateGroups.flat();
    warnings.push({
      id: 'duplicates',
      title: `중복 의심 거래 ${duplicateGroups.length}개 그룹`,
      description: `거래일시·거래처·금액이 같은 거래 ${duplicates.length}건을 확인하세요.`,
      transactionIds: transactionIds(duplicates)
    });
  }

  const balanceAnomalies = findBalanceAnomalies(transactions);
  if (balanceAnomalies.length > 0) {
    const related = balanceAnomalies.flatMap(anomaly => [anomaly.previous, anomaly.transaction]);
    warnings.push({
      id: 'balance-flow',
      title: `비정상 잔액 흐름 ${balanceAnomalies.length}건`,
      description: '직전 잔액과 입출금액으로 계산한 잔액이 파일의 잔액과 다릅니다.',
      transactionIds: [...new Set(transactionIds(related))]
    });
  }

  return {
    errors,
    warnings,
    canExport: errors.length === 0,
    totals: { dashboardDeposit, dashboardWithdrawal, reportDeposit, reportWithdrawal }
  };
}
