import { PrismaClient, StrategyGroup } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding strategy groups and currencies...')

  // 1. Position Rules Set up
  const positionRules = [
    { group: StrategyGroup.A, maxWeightPercent: 18.0 },
    { group: StrategyGroup.B, maxWeightPercent: 15.0 },
    { group: StrategyGroup.C, maxWeightPercent: 12.0 },
    { group: StrategyGroup.D, maxWeightPercent: 8.0 },
  ]

  for (const rule of positionRules) {
    await prisma.positionRule.upsert({
      where: { group: rule.group },
      update: { maxWeightPercent: rule.maxWeightPercent },
      create: rule,
    })
  }

  // 2. Currencies Setup
  // Major and highly liquid pairs get higher liquidityScores (out of 100)
  const currencies = [
    // Group A (Highest liquidity & stability)
    { code: 'USD', name: 'US Dollar', strategyGroup: StrategyGroup.A, liquidityScore: 100 },
    { code: 'EUR', name: 'Euro', strategyGroup: StrategyGroup.A, liquidityScore: 95 },
    { code: 'JPY', name: 'Japanese Yen', strategyGroup: StrategyGroup.A, liquidityScore: 90 },
    { code: 'GBP', name: 'British Pound', strategyGroup: StrategyGroup.A, liquidityScore: 85 },
    { code: 'CHF', name: 'Swiss Franc', strategyGroup: StrategyGroup.A, liquidityScore: 80 },

    // Group B (Commodity/growth linked majors)
    { code: 'AUD', name: 'Australian Dollar', strategyGroup: StrategyGroup.B, liquidityScore: 75 },
    { code: 'CAD', name: 'Canadian Dollar', strategyGroup: StrategyGroup.B, liquidityScore: 75 },
    { code: 'NZD', name: 'New Zealand Dollar', strategyGroup: StrategyGroup.B, liquidityScore: 70 },
    { code: 'SGD', name: 'Singapore Dollar', strategyGroup: StrategyGroup.B, liquidityScore: 65 },

    // Group C (Asia heavyweights)
    { code: 'CNY', name: 'Chinese Yuan', strategyGroup: StrategyGroup.C, liquidityScore: 60 },
    { code: 'HKD', name: 'Hong Kong Dollar', strategyGroup: StrategyGroup.C, liquidityScore: 55 },
    { code: 'TWD', name: 'Taiwan New Dollar', strategyGroup: StrategyGroup.C, liquidityScore: 50 },

    // Group D (Emerging markets / lower liquidity)
    { code: 'THB', name: 'Thai Baht', strategyGroup: StrategyGroup.D, liquidityScore: 45 },
    { code: 'MYR', name: 'Malaysian Ringgit', strategyGroup: StrategyGroup.D, liquidityScore: 40 },
    { code: 'PHP', name: 'Philippine Peso', strategyGroup: StrategyGroup.D, liquidityScore: 35 },
    { code: 'IDR', name: 'Indonesian Rupiah', strategyGroup: StrategyGroup.D, liquidityScore: 30 },
    { code: 'VND', name: 'Vietnamese Dong', strategyGroup: StrategyGroup.D, liquidityScore: 25 },
  ]

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { 
        name: currency.name, 
        strategyGroup: currency.strategyGroup,
        liquidityScore: currency.liquidityScore
      },
      create: currency,
    })
  }

  // 3. Initial Portfolio Settings
  await prisma.portfolioSetting.upsert({
    where: { id: 'default-settings' },
    update: {
      totalCapitalKrw: 10000000,
      accountRiskPct: 0.007,
      defaultStopLossPct: 0.018,
      defaultTakeProfitPct: 0.03,
    },
    create: {
      id: 'default-settings',
      totalCapitalKrw: 10000000, // 10M KRW
      accountRiskPct: 0.007,     // 0.7% risk per trade
      defaultStopLossPct: 0.018, // 1.8% Default SL
      defaultTakeProfitPct: 0.03,// 3.0% Default TP
    },
  })

  console.log('Seeding completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
