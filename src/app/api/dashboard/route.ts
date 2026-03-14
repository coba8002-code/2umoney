import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    // 1. Fetch Summary Stats
    const settings = await prisma.portfolioSetting.findFirst({ where: { id: 'default-settings' }});
    const positions = await prisma.portfolioPosition.findMany();
    
    const totalAssets = (settings?.totalCapitalKrw || 10000000) + positions.reduce((acc, pos) => acc + pos.currentValueKrw, 0);
    const openPositionsCount = positions.length;

    // 2. Fetch Currencies with their latest scores
    const currencies = await prisma.currency.findMany({
      include: {
        dailyRates: { orderBy: { date: 'desc' }, take: 1 },
        signalScores: { orderBy: { signalDate: 'desc' }, take: 1 },
        regimeStates: { orderBy: { date: 'desc' }, take: 1 }
      }
    });

    const enrichedCurrencies = currencies.map(c => {
      const rate = c.dailyRates[0]?.close || 0;
      const score = c.signalScores[0];
      const regime = c.regimeStates[0]?.regimeCategory || 'NEUTRAL';
      
      return {
        code: c.code,
        name: c.name,
        group: c.strategyGroup,
        price: rate,
        regime,
        score: score?.totalScore || 0,
        expectedReturn: score?.expectedReturn10d || 0,
        action: score?.actionCode || 'WAIT',
        recommendedAmount: score?.recommendedTotalKrw || 0,
        stopLoss: score?.stopLossRate || 0,
        target: score?.targetRate1 || 0,
        tossSetupRecommended: score?.actionCode === 'AUTO_EXCHANGE_SETUP' || score?.actionCode === 'BUY_1'
      };
    });

    // 3. Compute top picks & warnings
    const buyInitialCount = enrichedCurrencies.filter(c => c.action === 'BUY_1').length;
    const sellCount = enrichedCurrencies.filter(c => c.action.includes('SELL')).length;
    const topPicks = [...enrichedCurrencies].sort((a,b) => b.score - a.score).slice(0, 3);
    const warningCount = enrichedCurrencies.filter(c => c.action === 'RECHECK_AFTER_EVENT').length;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
           totalAssets,
           openPositionsCount,
           todayBuyCandidates: buyInitialCount + enrichedCurrencies.filter(c => c.action === 'BUY_ADD').length,
           todaySellCandidates: sellCount,
           eventWarnings: warningCount
        },
        topPicks,
        allCurrencies: enrichedCurrencies
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
