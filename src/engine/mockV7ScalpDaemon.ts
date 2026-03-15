import { PrismaClient } from '@prisma/client';
import { analyzePatterns, PatternFeatureVector } from './patternEngine';
import { calcFinalDecision, TechIndicatorsInput } from './scoring';
import { calcPositionSizing, PositionConfig } from './positionEngine';

const prisma = new PrismaClient();

// Simulated tick generator
function generateMockMarketTick(): PatternFeatureVector {
  // Simulating slightly random intraday metrics 
  // [Ret1h, Dist5MA, RSI5, VolDelta, ATR1h, ZScore1h]
  const ret1h = (Math.random() - 0.5) * 0.02; // -1% to +1%
  const rsi5 = Math.random() * 100;
  const zScore = (Math.random() - 0.5) * 6; // -3 to +3
  
  return {
    vector: [ret1h, 0.001, rsi5, 0.05, 0.002, zScore]
  };
}

async function runScalpDaemonTick() {
  console.log(`\n[${new Date().toISOString()}] 🕒 Fetching live market tick...`);
  
  const currencyCode = 'USD/KRW';
  const currentPrice = 1350.00 + (Math.random() - 0.5) * 5; // Simulating price fluctuation
  
  // 1. Feature Generation
  const features = generateMockMarketTick();
  
  // 2. AI Inference (V7 Profile)
  const patternResult = analyzePatterns(features, [], 0.9, 20, 'V7_MARGIN_SCALP');
  
  // 3. Scoring & Thresholds (V7 Profile)
  const techInput: TechIndicatorsInput = {
    rsi: features.vector[2],
    zScore: features.vector[5],
    atr: 0.002 * currentPrice, // mock true ATR value
    tradingProfile: 'V7_MARGIN_SCALP' 
  };
  
  const finalDecision = calcFinalDecision(80, patternResult, techInput); // Mock structure score of 80
  
  console.log(`📊 AI Score: ${finalDecision.totalScore.toFixed(1)} | Action: ${finalDecision.actionCode} | Target: ${finalDecision.targetRate1?.toFixed(2)} | Stop: ${finalDecision.stopLossRate?.toFixed(2)}`);
  
  // 4. Trade Execution Logic
  if (finalDecision.actionCode === 'BUY_1' && finalDecision.bettingGrade) {
    console.log(`🚀 [EXECUTE] Generating V7 Margin Trade Entry!`);
    
    // Calculate Leveraged Position
    const positionConfig: PositionConfig = {
      totalCapital: 10_000_000,
      baseRiskPercent: 0.05,
      grade: finalDecision.bettingGrade,
      tradingProfile: 'V7_MARGIN_SCALP',
      leverageRatio: 10
    };
    
    const { firstEntrySize } = calcPositionSizing(positionConfig);
    
    try {
      // Begin Database Transaction mimicking real portfolio logic
      await prisma.$transaction(async (tx) => {
        // 1. Log Trade
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
        
        // 2. Upsert Position
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
            dcaLevel: 1 // N/A for V7 but required by DB
          }
        });
        
        console.log(`✅ [DB COMMIT] Position stored successfully. Allocated Krw: ${firstEntrySize.toLocaleString()}`);
      });
    } catch (e) {
      console.error(`❌ [DB ERROR] Failed to record trade:`, e);
    }
    
  } else {
    console.log(`⏳ Conditions not met. Waiting for next tick.`);
  }
}

// Daemon Loop Runner
async function startDaemon() {
  console.log("==========================================");
  console.log("   🚀 V7.0 MARGIN SCALP DAEMON STARTING   ");
  console.log("==========================================");
  
  // Run 10 ticks for demonstration
  for (let i = 0; i < 5; i++) {
    await runScalpDaemonTick();
    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
  }
  
  console.log("\n🛑 Daemon stopped.");
  await prisma.$disconnect();
}

startDaemon();
