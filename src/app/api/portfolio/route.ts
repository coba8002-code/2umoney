import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const settings = await prisma.portfolioSetting.findFirst({ where: { id: 'default-settings' }});
    
    const positions = await prisma.portfolioPosition.findMany({ 
      include: { 
        currency: {
          include: {
            dailyRates: { orderBy: { date: 'desc' }, take: 1 },
            signalScores: { orderBy: { signalDate: 'desc' }, take: 1 }
          }
        } 
      }
    });

    const positionRules = await prisma.positionRule.findMany();

    let totalPositionsValue = 0;
    let totalCostBase = 0;
    
    // Calculate PnLs and Map Signals to action fields
    const enrichedPositions = positions.map(pos => {
      const currentRate = pos.currency.dailyRates[0]?.close || pos.averagePrice;
      const currentKrwValue = currentRate * pos.amount;
      const costKrwValue = pos.averagePrice * pos.amount;
      
      totalPositionsValue += currentKrwValue;
      totalCostBase += costKrwValue;

      const pnlKrw = currentKrwValue - costKrwValue;
      const pnlPct = costKrwValue > 0 ? (pnlKrw / costKrwValue) * 100 : 0;
      
      const latestScore = pos.currency.signalScores[0];
      const actionCode = latestScore?.actionCode || 'HOLD';
      
      return {
        currencyCode: pos.currencyCode,
        averagePrice: pos.averagePrice,
        amount: pos.amount,
        currentPhase: pos.currentPhase,
        stopLossRate: pos.stopLossRate,
        targetRate: pos.targetRate,
        currentRate,
        currentKrwValue,
        costKrwValue,
        pnlKrw,
        pnlPct,
        actionCode,
        canBuyAdd: actionCode === 'BUY_ADD' || (actionCode.includes('BUY') && pos.currentPhase < 3),
        recommendTakeProfit: actionCode.includes('SELL'),
        isStopLossTriggered: currentRate <= pos.stopLossRate,
        isTargetHit: currentRate >= pos.targetRate
      };
    });

    const totalAssets = (settings?.totalCapitalKrw || 0) + totalPositionsValue;
    
    // Group Exposure Calcs
    const groupExposure: Record<string, { currentKrw: number, currentWeight: number, maxWeight: number }> = {};
    positionRules.forEach(rule => {
       groupExposure[rule.group] = { currentKrw: 0, currentWeight: 0, maxWeight: rule.maxWeightPercent };
    });

    enrichedPositions.forEach(pos => {
       const grp = positions.find(p => p.currencyCode === pos.currencyCode)?.currency.strategyGroup;
       if (grp && groupExposure[grp]) {
          groupExposure[grp].currentKrw += pos.currentKrwValue;
       }
    });

    Object.values(groupExposure).forEach(g => {
      g.currentWeight = totalAssets > 0 ? g.currentKrw / totalAssets : 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalAssets,
        totalPositionsValue,
        totalCostBase,
        totalPnlKrw: totalPositionsValue - totalCostBase,
        totalPnlPct: totalCostBase > 0 ? ((totalPositionsValue - totalCostBase) / totalCostBase) * 100 : 0,
        groupExposure,
        positions: enrichedPositions
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
