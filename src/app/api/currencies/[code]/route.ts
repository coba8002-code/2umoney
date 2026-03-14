import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();

  try {
    const currency = await prisma.currency.findUnique({
      where: { code },
      include: {
        dailyRates: { orderBy: { date: 'desc' }, take: 100 },
        signalScores: { orderBy: { signalDate: 'desc' }, take: 1 },
        regimeStates: { orderBy: { date: 'desc' }, take: 1 },
        newsSignals: { orderBy: { date: 'desc' }, take: 5 },
        patternFeatures: {
          orderBy: { featureDate: 'desc' },
          take: 1,
          include: { outcome: true }
        }
      }
    });

    if (!currency) {
      return NextResponse.json({ success: false, error: 'Currency not found' }, { status: 404 });
    }

    const latestScore = currency.signalScores[0];
    const latestRegime = currency.regimeStates[0];
    const latestNews = currency.newsSignals[0];
    const latestPattern = currency.patternFeatures[0]?.outcome;

    return NextResponse.json({
      success: true,
      data: {
        currency: {
          code: currency.code,
          name: currency.name,
          strategyGroup: currency.strategyGroup,
          liquidityScore: currency.liquidityScore
        },
        header: {
          currentPrice: currency.dailyRates[0]?.close || 0,
          action: latestScore?.actionCode || 'WAIT',
          score: latestScore?.totalScore || 0,
          expectedValue: latestScore?.expectedReturn10d || 0,
          regime: latestRegime?.regimeCategory || 'NEUTRAL'
        },
        rates: currency.dailyRates.reverse(), // For charts
        regimeAnalysis: {
          code: latestRegime?.regimeCategory || 'NEUTRAL',
          fitScore: latestRegime?.regimeFitScore || 0,
          volatility: latestRegime?.volatility || 0,
        },
        patternStats: {
          similarCount: latestPattern?.similarPatternCt || 0,
          winRate10d: latestPattern?.return10d && latestPattern.return10d > 0 ? 65 : 45, // mock heuristic
          expectedReturn10d: latestPattern?.return10d || 0,
          estimatedMaxDrawdown: latestPattern?.maxDrawdown || 0
        },
        newsRisk: {
          sentimentScore: latestNews?.sentimentScore || 0,
          policyRiskScore: latestNews?.policyRiskScore || 0,
          uncertaintyScore: latestNews?.eventIntensity || 0,
          summary: latestNews?.headline || 'No major recent news.'
        },
        executionGuide: {
          recommendedTotalKrw: latestScore?.recommendedTotalKrw || 0,
          entry1: latestScore?.firstEntryKrw || 0,
          entry2: latestScore?.secondEntryKrw || 0,
          entry3: latestScore?.thirdEntryKrw || 0,
          stopLoss: latestScore?.stopLossRate || 0,
          target1: latestScore?.targetRate1 || 0,
          target2: latestScore?.targetRate2 || 0
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
