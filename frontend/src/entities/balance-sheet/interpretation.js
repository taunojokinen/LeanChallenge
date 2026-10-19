import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { calculateAnnualConfirmedInventoryTurnover } from '../history/financialMetrics.js'
import { canFinanceInvestment } from '../investments/model.js'

const ROUNDS_PER_YEAR = 4
const formatNumber = (value) => value.toLocaleString('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const formatCurrency = (value) => `${value.toLocaleString('fi-FI', { maximumFractionDigits: 0 })} €`

function capitalAdequacy(equity, result) {
  const projection = equity + 12 * result
  const years = result < 0 ? Math.max(0, equity) / (ROUNDS_PER_YEAR * Math.abs(result)) : null
  const status = equity <= 0 || (years != null && years < 3)
    ? 'danger'
    : result > 0 ? 'success' : 'warning'
  let value
  let text
  if (equity <= 0) {
    value = result < 0
      ? `${formatNumber(years)} vuotta`
      : equity < 0 ? 'Oma pääoma on negatiivinen' : 'Oma pääoma on loppunut'
    text = result > 0
      ? 'Kausitulos on voitollinen, mutta oman pääoman puskuria ei vielä ole.'
      : equity < 0
        ? 'Oma pääoma on negatiivinen eikä puskuria ole. Kannattavuutta on parannettava.'
        : 'Oma pääoma on nolla eikä puskuria ole. Kannattavuutta on parannettava.'
  } else if (result < 0) {
    value = `${formatNumber(years)} vuotta`
    text = years < 3
      ? 'Nykyisellä tappiolla oma pääoma loppuisi alle kolmessa vuodessa.'
      : 'Oma pääoma riittää vähintään kolmeksi vuodeksi, mutta tappio heikentää puskuria.'
  } else if (result === 0) {
    value = 'Oma pääoma säilyy ennallaan'
    text = 'Nollatulos säilyttää puskurin, mutta ei vahvista sitä.'
  } else {
    value = 'Oma pääoma vahvistuu'
    text = 'Voitollinen kausitulos kasvattaa oman pääoman puskuria.'
  }
  return { status, value, text, years, projection, projectionText: formatCurrency(projection) }
}

export function buildBalanceInterpretation({ balanceSheet, confirmedEntry, factorySettings = DEFAULT_FACTORY_SETTINGS }) {
  const { equity, bankLoans, inventoryAmount, solvencyRatioValue } = balanceSheet.summary
  const result = confirmedEntry?.incomeStatement?.result
  if (![equity, bankLoans, inventoryAmount, result].every(Number.isFinite)) {
    throw new Error('Taseen tulkinta tarvitsee vahvistetut pääoma-, velka-, varasto- ja tulostiedot.')
  }
  const financing = canFinanceInvestment(0, {
    equity,
    bankLoanDebt: bankLoans,
    cashBalance: 0,
  }, { maxDebtToEquity: factorySettings.finance.maxDebtToEquity })
  const annualTurnover = calculateAnnualConfirmedInventoryTurnover(confirmedEntry)
  const solvencyStatus = !Number.isFinite(solvencyRatioValue)
    ? 'neutral'
    : solvencyRatioValue < 33 ? 'danger' : solvencyRatioValue <= 50 ? 'warning' : 'success'
  const inventoryStatus = annualTurnover == null
    ? 'neutral'
    : annualTurnover < 8 ? 'danger' : annualTurnover <= 16 ? 'warning' : 'success'

  return {
    round: balanceSheet.round,
    capital: capitalAdequacy(equity, result),
    solvency: {
      status: solvencyStatus,
      value: Number.isFinite(solvencyRatioValue) ? `${formatNumber(solvencyRatioValue)} %` : 'Ei laskettavissa',
      debtHeadroom: financing.debtHeadroom,
      debtHeadroomText: formatCurrency(financing.debtHeadroom),
      text: {
        danger: 'Oman pääoman osuus on pieni. Velat, myös ostovelat, kasvattavat rahoitusriskiä.',
        warning: 'Oman pääoman osuus on kohtalainen. Seuraa velkojen ja oman pääoman kehitystä.',
        success: 'Yli puolet varoista on rahoitettu omalla pääomalla.',
        neutral: 'Omavaraisuusastetta ei voida laskea, koska taseen loppusumma on nolla.',
      }[solvencyStatus],
    },
    inventory: {
      status: inventoryStatus,
      capitalText: formatCurrency(inventoryAmount),
      annualTurnover,
      value: annualTurnover == null ? 'Ei laskettavissa' : `${formatNumber(annualTurnover)} kertaa vuodessa`,
      text: {
        danger: 'Varaston kiertonopeus on heikko. Varastoon sitoutuu paljon pääomaa.',
        warning: 'Varaston kierto on kohtalainen. Varastoon sitoutunutta pääomaa kannattaa seurata.',
        success: 'Varasto kiertää tehokkaasti, mikä tehostaa siihen sitoutuneen pääoman käyttöä.',
        neutral: 'Kiertonopeutta ei voida laskea ilman positiivista loppuvarastoa ja vahvistettuja toimitustietoja.',
      }[inventoryStatus],
    },
  }
}
