import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { analyzePatterns, PatternFeatureVector } from '@/engine/patternEngine';
import { calcFinalDecision, TechIndicatorsInput } from '@/engine/scoring';
import { calcPositionSizing, PositionConfig } from '@/engine/positionEngine';

const prisma = new PrismaClient();

// Simulated tick generator
function generateMockMarketTick(): PatternFeatureVector {
  const ret1h = (Math.random() - 0.5) * 0.02; // -1% to +1%
  const rsi5 = Math.random() * 100;
  const zScore = (Math.random() - 0.5) * 6; // -3 to +3
  
  return {
    vector: [ret1h, 0.001, rsi5, 0.05, 0.002, zScore]
  };
}

async function runScalpDaemonTick() {
  const logs: string[] = [];
  logs.push(`\n[${new Date().toISOString()}] 🕒 Fetching live market tick...`);
  
  const currencyCode = 'USD/KRW';
  const currentPrice = 1350.00 + (Math.random() - 0.5) * 5; 
  
  const features = generateMockMarketTick();
  const patternResult = analyzePatterns(features, [], 0.9, 20, 'V7_MARGIN_SCALP');
  
  const techInput: TechIndicatorsInput = {
    rsi: features.vector[2],
    zScore: features.vector[5],
    atr: 0.002 * currentPrice, 
    tradingProfile: 'V7_MARGIN_SCALP' 
  };
  
  const finalDecision = calcFinalDecision(80, patternResult, techInput); 
  
  logs.push(`📊 AI Score: ${finalDecision.totalScore.toFixed(1)} | Action: ${finalDecision.actionCode} | Target: ${finalDecision.targetRate1?.toFixed(2)} | Stop: ${finalDecision.stopLossRate?.toFixed(2)}`);
  
  if (finalDecision.actionCode === 'BUY_1' && finalDecision.bettingGrade) {
    logs.push(`🚀 [EXECUTE] Generating V7 Margin Trade Entry!`);
    
    const positionConfig: PositionConfig = {
      totalCapital: 10_000_000,
      baseRiskPercent: 0.05,
      grade: finalDecision.bettingGrade,
      tradingProfile: 'V7_MARGIN_SCALP',
      leverageRatio: 10
    };
    
    const { firstEntrySize } = calcPositionSizing(positionConfig);
    
    try {
      await prisma.$transaction(async (tx) => {
        await tx.tradeLog.create({
          data: {
            currencyCode,
            tradeDate: new Date(),
            tradeType: 'BUY',
            price: currentPrice,
            amount: firstEntrySize / currentPrice,
            krwValue: firstEntrySize,
            reason: `AI Signal V7 Margin (Score: ${finalDecision.totalScore.toFixed(1)})`
          }
        });
        
        await tx.portfolioPosition.upsert({
          where: { currencyCode },
          update: {
            averagePrice: currentPrice,
            amount: { increment: firstEntrySize / currentPrice },
            currentValueKrw: { increment: firstEntrySize },
            stopLossRate: finalDecision.stopLossRate || 0,
            targetRate: finalDecision.targetRate1 || 0,
            updatedAt: new Date()
          },
          create: {
            currencyCode,
            averagePrice: currentPrice,
            amount: firstEntrySize / currentPrice,
            currentValueKrw: firstEntrySize,
            stopLossRate: finalDecision.stopLossRate || 0,
            targetRate: finalDecision.targetRate1 || 0,
            currentPhase: 1,
            dcaLevel: 1
          }
        });
        
        logs.push(`✅ [DB COMMIT] Position stored successfully. Allocated Krw: ${firstEntrySize.toLocaleString()}`);
      });
    } catch (e: any) {
      logs.push(`❌ [DB ERROR] Failed to record trade: ${e.message}`);
    }
    
  } else {
    logs.push(`⏳ Conditions not met. Waiting for next tick.`);
  }
  
  return logs;
}

export async function GET() {
  try {
    const allLogs: string[] = [];
    allLogs.push("==========================================");
    allLogs.push("   🚀 V7.0 MARGIN SCALP DAEMON STARTING   ");
    allLogs.push("==========================================");
    
    for (let i = 0; i < 5; i++) {
      const tickLogs = await runScalpDaemonTick();
      allLogs.push(...tickLogs);
      // artificial wait not needed for API but spacing execution 
      // await new Promise(r => setTimeout(r, 500)); 
    }
    
    allLogs.push("\n🛑 Daemon cycle completed.");
    
    return NextResponse.json({ success: true, logs: allLogs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
