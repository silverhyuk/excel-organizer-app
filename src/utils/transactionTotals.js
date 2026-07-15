export function getTransactionAmount(transaction) {
  if (transaction.deposit > 0 && !(transaction.withdrawal > 0)) return transaction.deposit;
  return transaction.withdrawal;
}

export function sumTransactionAmounts(transactions) {
  return transactions.reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);
}
