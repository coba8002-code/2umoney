import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const currencies = await prisma.currency.findMany({
      include: {
        dailyRates: { orderBy: { date: 'desc' }, take: 1 },
        signalScores: { orderBy: { signalDate: 'desc' }, take: 1 }
      }
    });

    const plans = currencies.map(c => {
      const rate = c.dailyRates[0];
      const score = c.signalScores[0];
      
      if (!score || !rate) return null;

      const action = score.actionCode;
      const isActionable = action === 'BUY_1' || action === 'BUY_ADD' || action === 'AUTO_EXCHANGE_SETUP';
      
      const currentPrice = rate.close;
      const firstOrderRate = currentPrice * 0.998;
      const secondOrderRate = currentPrice * 0.990;
      const thirdOrderRate = currentPrice * 0.982;

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7);

      let memoText = `[${action}] ${c.strategyGroup} / 점수:${score.totalScore.toFixed(0)}`;
      if (action === 'BUY_ADD') memoText += ' (추가매수)';

      return {
        currencyCode: c.code,
        currentPrice,
        action,
        isActionable,
        recommendedMode: '3분할 점진적 매수',
        phases: [
           { phase: 1, rate: firstOrderRate, amount: score.firstEntryKrw || 0, weight: '40%' },
           { phase: 2, rate: secondOrderRate, amount: score.secondEntryKrw || 0, weight: '30%' },
           { phase: 3, rate: thirdOrderRate, amount: score.thirdEntryKrw || 0, weight: '30%' }
        ],
        validUntil,
        memoText
      };
    }).filter(Boolean);

    // Sort by actionable first
    plans.sort((a: any, b: any) => {
      if (a.isActionable && !b.isActionable) return -1;
      if (!a.isActionable && b.isActionable) return 1;
      return 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        actionableCount: plans.filter(p => (p as any).isActionable).length,
        plans
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
