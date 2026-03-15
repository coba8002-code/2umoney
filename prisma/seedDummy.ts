import { PrismaClient, StrategyGroup, Timeframe, ActionCode } from '@prisma/client'

const prisma = new PrismaClient()

// Utility to generate random numbers from a normal distribution
function randomNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0) return randomNormal(mean, stdDev); // resample between 0 and 1
  return (num - 0.5) * 10 * stdDev + mean; // scale
}

// Simple RSI Calculator over a series of prices
function calculateRSI(prices: number[], period = 14) {
  if (prices.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i-1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

async function main() {
  console.log('Generating realistic dummy data...')
  
  const rules = await prisma.positionRule.findMany()
  const ruleMap: Record<string, number> = {}
  rules.forEach((r: { group: string; maxWeightPercent: number }) => { ruleMap[r.group] = r.maxWeightPercent / 100 })
  console.log('Loaded strategy position rules:', ruleMap)

  const totalCapitalKrw = 10000000; // 10M KRW base for dummy calc
  
  const currencies = await prisma.currency.findMany()
  if (currencies.length === 0) {
    console.error('No currencies found. Run the base seed first.')
    return
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  
  const daysToGenerate = 180

  for (const currency of currencies) {
    console.log(`Generating data for ${currency.code}...`)
    
    // Set base prices roughly matching reality
    let currentPrice = 1000;
    if (currency.code === 'USD') currentPrice = 1350;
    else if (currency.code === 'EUR') currentPrice = 1450;
    else if (currency.code === 'JPY') currentPrice = 900; // 100 JPY
    else if (currency.code === 'GBP') currentPrice = 1700;
    else if (currency.code === 'CNY') currentPrice = 190;
    
    let drift = 0;
    let vol = 0.005; // 0.5% daily volatility
    let meanReversion = false;
    let jumpProb = 0;

    // Adjust characteristics by strategy group
    if (currency.strategyGroup === StrategyGroup.A) {
      // Trending
      drift = randomNormal(0.0001, 0.0002); // Slight uptrend or downtrend
      vol = 0.004;
    } else if (currency.strategyGroup === StrategyGroup.B) {
      // Commodity / Moderate
      drift = randomNormal(-0.0001, 0.0001);
      vol = 0.006;
    } else if (currency.strategyGroup === StrategyGroup.C) {
      // Ranging / Band
      meanReversion = true;
      vol = 0.003;
    } else if (currency.strategyGroup === StrategyGroup.D) {
      // Volatile / Low liquidity
      vol = 0.01;
      jumpProb = 0.05; // 5% chance of a large jump
    }

    const dailyRates = []
    const basePriceHistory = []
    const startObj = new Date(today)
    startObj.setDate(startObj.getDate() - daysToGenerate)
    const baseVal = currentPrice;

    // Generate timeseries forward from 180 days ago
    for (let i = 0; i <= daysToGenerate; i++) {
       const date = new Date(startObj)
       date.setDate(date.getDate() + i)

       // Skip weekends randomly or exactly
       if (date.getDay() === 0 || date.getDay() === 6) continue;

       let changePct = randomNormal(drift, vol);

       if (meanReversion) {
         // Pull back to baseVal
         changePct += (baseVal - currentPrice) / baseVal * 0.01;
       }

       if (Math.random() < jumpProb) {
         // Jump!
         changePct += randomNormal(0, vol * 3);
       }

       const open = currentPrice;
       const close = currentPrice * (1 + changePct);
       const high = Math.max(open, close) * (1 + Math.abs(randomNormal(0, vol/2)));
       const low = Math.min(open, close) * (1 - Math.abs(randomNormal(0, vol/2)));
       
       currentPrice = close;
       basePriceHistory.push(close);

       dailyRates.push({
         currencyCode: currency.code,
         date: date,
         open, high, low, close,
         volume: 1000000 * Math.random() * currency.liquidityScore!
       })
    }

    // Insert Exchange_Rate_Daily
    await prisma.exchangeRateDaily.createMany({
      data: dailyRates,
      skipDuplicates: true
    })

    // Generate Technical Indicators & Scores for the last 30 days
    const recentRates = dailyRates.slice(-30);
    const techIndData = [];
    const signalData = [];
    const tossPlans = [];
    
    const actions = Object.values(ActionCode);

    for (let i = 0; i < recentRates.length; i++) {
       const rate = recentRates[i];
       const rsi = Math.random() * 60 + 20; // Dump random for now
       const zScore = randomNormal(0, 1.5);
       
       techIndData.push({
         currencyCode: currency.code,
         date: rate.date,
         timeframe: Timeframe.DAILY,
         ma: rate.close * 0.99,
         rsi: rsi,
         atr: rate.close * 0.01,
         upperBand: rate.close * 1.02,
         lowerBand: rate.close * 0.98,
         zScore: zScore,
         structure: rsi < 30 ? '일간과매도' : (rsi > 70 ? '일간과열' : '횡보'),
       });

       const totalScore = Math.floor(Math.random() * 100);
       let action = ActionCode.WAIT;
       if (totalScore >= 80) action = ActionCode.BUY_1;
       else if (totalScore >= 65) action = ActionCode.BUY_ADD;
       else if (totalScore >= 50) action = ActionCode.HOLD;
       else if (totalScore < 30) action = ActionCode.SELL_SPLIT;
       else if (totalScore < 20) action = ActionCode.SELL_ALL;

       // Dynamic Portfolio Allocation Logic
       let recommendedKrw = 0;
       const maxWeight = ruleMap[currency.strategyGroup] || 0.1;
       const maxAlloc = totalCapitalKrw * maxWeight;

       if (action === ActionCode.BUY_1) {
         recommendedKrw = maxAlloc; // Full weight for strong conviction
       } else if (action === ActionCode.BUY_ADD) {
         recommendedKrw = maxAlloc * 0.5; // Half weight for moderate conviction
       }

       signalData.push({
         currencyCode: currency.code,
         signalDate: rate.date,
         structureScore: Math.random() * 20,
         patternScore: Math.random() * 20,
         timingScore: Math.random() * 15,
         newsScore: Math.random() * 10,
         regimeScore: Math.random() * 20,
         expectedValueScore: Math.random() * 15,
         totalScore: totalScore,
         actionCode: action,
         recommendedTotalKrw: recommendedKrw,
         firstEntryKrw: recommendedKrw > 0 ? recommendedKrw * 0.5 : null, // Split entry visually
         expectedReturn5d: randomNormal(0.01, 0.02),
         estimatedMaxDrawdown: -Math.abs(randomNormal(0.02, 0.01)),
         targetRate1: rate.close * (1 + 0.025), // 2.5x ATR Dummy for V3.0
         dcaTargetRate: rate.close * (1 - 0.015), // Next DCA Level Drop in V3.0
         stopLossRate: null // No Stop Loss
       });

       // Correcting direction for targets based on Action
       if (action.includes('SELL')) {
         signalData[signalData.length - 1].targetRate1 = rate.close * (1 - 0.025);
         signalData[signalData.length - 1].dcaTargetRate = rate.close * (1 + 0.015);
       }

       // Toss execution plan logic
       if (action === ActionCode.BUY_1 || action === ActionCode.SELL_SPLIT) {
         tossPlans.push({
            currencyCode: currency.code,
            planDate: rate.date,
            targetRate: rate.close * (action.includes('BUY') ? 0.99 : 1.01),
            amountKrw: recommendedKrw > 0 ? recommendedKrw : 200000,
            status: 'PENDING'
         })
       }
    }

    await prisma.technicalIndicator.createMany({ data: techIndData, skipDuplicates: true });
    await prisma.signalScore.createMany({ data: signalData, skipDuplicates: true });
    if (tossPlans.length > 0) {
      await prisma.tossExecutionPlan.createMany({ data: tossPlans, skipDuplicates: true });
    }
  }

  console.log('Dummy data generation complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
