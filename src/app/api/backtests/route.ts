import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Return mock data for Dashboard UI rendering
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalReturnPct: 18.4,
          winRate: 64.2,
          profitFactor: 1.85,
          expectedValueKrw: 35000,
          mdd: -12.4,
          avgHoldDays: 4.5,
          tradeCount: 245
        },
        equityCurve: [
          // Sending a minimal subset for API shape example
          { date: new Date().getTime() - 86400000 * 2, withNews: 11000000, withoutNews: 10500000 },
          { date: new Date().getTime() - 86400000 * 1, withNews: 11200000, withoutNews: 10600000 },
          { date: new Date().getTime(),                 withNews: 11840000, withoutNews: 10900000 }
        ],
        currencyPerformance: [
           { code: 'USD', return: 15.2, winRate: 68, count: 54 },
           { code: 'JPY', return: 8.5, winRate: 60, count: 42 }
        ],
        regimePerformance: [
           { regime: 'RISK_ON', return: 18.5, trades: 85 },
           { regime: 'RISK_OFF', return: -4.1, trades: 35 }
        ]
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
