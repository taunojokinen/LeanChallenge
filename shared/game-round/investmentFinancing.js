export function calculateDebtLimit(equity, maxDebtToEquity = 2) {
  return Math.max(0, Number(equity) || 0) * Math.max(0, Number(maxDebtToEquity) || 0)
}

export function canFinanceInvestment(totalCost, financialState, options = {}) {
  const financeOptions =
    typeof options === 'number'
      ? { targetCash: 0, maxDebtToEquity: options }
      : options
  const cashBalance = Number(financialState.cashBalance) || 0
  const bankLoanDebt = Math.max(0, Number(financialState.bankLoanDebt) || 0)
  const equity = Math.max(0, Number(financialState.equity) || 0)
  const targetCash = Math.max(0, Number(financeOptions.targetCash) || 0)
  const maxDebtToEquity = Math.max(0, Number(financeOptions.maxDebtToEquity ?? 2) || 0)

  const availableCash = Math.max(0, cashBalance - targetCash)
  const openingDebt = bankLoanDebt
  const debtLimit = calculateDebtLimit(equity, maxDebtToEquity)
  const debtHeadroom = Math.max(0, debtLimit - openingDebt)
  const financingCapacity = availableCash + debtHeadroom

  const normalizedCost = Math.max(0, Number(totalCost) || 0)
  const cashUsed = Math.min(availableCash, normalizedCost)
  const newDebt = Math.max(0, normalizedCost - cashUsed)
  const debtAfter = openingDebt + newDebt
  const remainingDebtHeadroom = Math.max(0, debtLimit - debtAfter)
  const remainingFinancingCapacity = Math.max(0, financingCapacity - normalizedCost)
  const canFinance = normalizedCost <= financingCapacity

  return {
    canFinance,
    targetCash,
    availableCash,
    openingDebt,
    maxDebt: debtLimit,
    debtHeadroom,
    financingCapacity,
    cashUsed,
    newDebt,
    financingNeed: newDebt,
    debtAfter,
    remainingDebtHeadroom,
    remainingFinancingCapacity,
    cashAfter: cashBalance - cashUsed,
    debtLimit,
    debtCapacity: debtHeadroom,
    reason: canFinance ? null : 'debt-limit-exceeded',
  }
}
