import { PrismaClient } from '@prisma/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, Smartphone, CheckCircle2, Info, Clock, Copy } from 'lucide-react';
import Link from 'next/link';

const prisma = new PrismaClient();

async function getTossExecutionPlans() {
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
    
    // Suggesting entry rates for auto-exchange
    // 1st order: Near current price (-0.2% drop)
    // 2nd order: -1.0% drop
    // 3rd order: -1.8% drop (near stop loss limit)
    const currentPrice = rate.close;
    const firstOrderRate = currentPrice * 0.998;
    const secondOrderRate = currentPrice * 0.990;
    const thirdOrderRate = currentPrice * 0.982;

    // valid until 1 week from now roughly
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    let memoText = `[${action}] ${c.strategyGroup}그룹 / 점수:${score.totalScore.toFixed(0)}`;
    if (action === 'BUY_ADD') memoText += ' (추가매수)';

    return {
      currency: c,
      currentPrice,
      action,
    // Detect V7 Margin Scalping Mode (if Stop Loss exists and > 0, and second entry is 0)
    const isScalpMode = !!(score.stopLossRate && score.stopLossRate > 0 && score.secondEntryKrw === 0);
    const recommendedMode = isScalpMode ? 'V7.0 마진 단타 스캘핑 (손절매매)' : '2분할 매수 (V6.0 Macro Swing)';

    return {
      currency: c,
      currentPrice,
      action,
      isActionable,
      recommendedMode,
      isScalpMode,
      stopLossRate: score.stopLossRate || 0,
      firstOrderKrw: score.firstEntryKrw || 0,
      firstOrderRate: score.targetRate1 || firstOrderRate,
      secondOrderKrw: score.secondEntryKrw || 0,
      secondOrderRate,
      thirdOrderKrw: score.thirdEntryKrw || 0,
      thirdOrderRate,
      validUntil,
      memoText
    };
  }).filter(Boolean) as any[];

  // Sort by actionable first, then by score
  return plans.sort((a, b) => {
    if (a.isActionable && !b.isActionable) return -1;
    if (!a.isActionable && b.isActionable) return 1;
    return b.currency.signalScores[0].totalScore - a.currency.signalScores[0].totalScore;
  });
}

export default async function TossPlanPage() {
  const plans = await getTossExecutionPlans();
  const actionablePlans = plans.filter(p => p.isActionable && p.firstOrderKrw > 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 mb-12">
      <div className="mb-6 flex space-x-4 items-center">
         <Link href="/" className="p-2 bg-muted/50 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
         </Link>
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Toss Execution Plans</h1>
            <p className="text-sm text-muted-foreground mt-1">Copy-paste values into Toss Auto-Exchange</p>
         </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-8 flex items-start space-x-4">
        <Smartphone className="w-6 h-6 text-blue-500 shrink-0 mt-1"/>
        <div className="text-sm text-blue-100 leading-relaxed">
           <h3 className="font-bold text-blue-400 text-lg mb-1">How to use this page</h3>
           <p>1. Open the <strong>Toss App</strong> &gt; Foreign Currency Account (외화통장) &gt; Exchange (환전하기) &gt; <strong>Auto Exchange (자동환전)</strong>.</p>
           <p>2. Select the target currency from the actionable lists below.</p>
           <p>3. Input the exact <strong>Target Rate (목표 환율)</strong> and <strong>Amount (금액)</strong> for each entry phase.</p>
           <p>4. This structured approach prevents emotional trading and strictly enforces the 2-tranche (50% each) portfolio sizing rule.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-4">
         <CheckCircle2 className="w-5 h-5 text-primary"/>
         <h2 className="text-xl font-bold">Today's Actionable Setups</h2>
      </div>
      
      {actionablePlans.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          No actionable auto-exchange plans recommended right now based on current engine scores.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
          {actionablePlans.map((plan) => (
            <div key={plan.currency.code} className="bg-card border-2 border-primary/40 rounded-xl overflow-hidden shadow-lg shadow-primary/5">
               <div className="bg-primary/10 border-b border-primary/20 p-4 flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-2">
                       <span className="text-2xl font-bold text-primary">{plan.currency.code}</span>
                       <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded font-bold">{plan.action}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Current: {plan.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase">Strategy</div>
                    <div className="font-bold text-sm bg-background px-2 py-0.5 rounded border border-border mt-1">{plan.recommendedMode}</div>
                  </div>
               </div>

               <div className="p-4 space-y-4">
                 {/* 1st Order */}
                 <div className="bg-muted/30 rounded-lg p-3 border border-border/50 relative group">
                    <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer"/>
                    </div>
                    <div className="text-xs text-muted-foreground font-semibold mb-2">1st Entry (50% Weight)</div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <div className="text-[10px] uppercase text-muted-foreground">Target Rate</div>
                         <div className="font-bold text-lg text-blue-400">{plan.firstOrderRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                       </div>
                       <div>
                         <div className="text-[10px] uppercase text-muted-foreground">Amount</div>
                         <div className="font-bold text-lg">{plan.firstOrderKrw.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">KRW</span></div>
                       </div>
                    </div>
                 </div>

                 {/* 2nd Order / Stop Loss display */}
                 {plan.isScalpMode && plan.stopLossRate > 0 ? (
                   <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30 relative group">
                      <div className="text-xs text-red-400 font-semibold mb-2">🚨 Strict Stop Loss (Cut-loss)</div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <div className="text-[10px] uppercase text-red-400/70">Warning Level</div>
                           <div className="font-bold text-lg text-red-500">{plan.stopLossRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                         </div>
                         <div>
                           <div className="text-[10px] uppercase text-muted-foreground">Action</div>
                           <div className="font-bold text-md text-red-400 pt-1">즉시 손절</div>
                         </div>
                      </div>
                   </div>
                 ) : plan.secondOrderKrw > 0 ? (
                   <div className="bg-muted/10 rounded-lg p-3 border border-border/50 relative group">
                      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer"/>
                      </div>
                      <div className="text-xs text-muted-foreground font-semibold mb-2">2nd Entry (2.0x ATR Drop, 50%)</div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <div className="text-[10px] uppercase text-muted-foreground">Target Rate (-2%)</div>
                           <div className="font-bold text-lg text-blue-400/80">{plan.secondOrderRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                         </div>
                         <div>
                           <div className="text-[10px] uppercase text-muted-foreground">Amount</div>
                           <div className="font-bold text-lg text-muted-foreground">{plan.secondOrderKrw.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">KRW</span></div>
                         </div>
                      </div>
                   </div>
                 ) : null}

                 {/* 3rd Order */}
                 {plan.thirdOrderKrw > 0 && (
                   <div className="bg-muted/10 rounded-lg p-3 border border-border/50 relative group">
                      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer"/>
                      </div>
                      <div className="text-xs text-muted-foreground font-semibold mb-2">3rd Entry (2.0x ATR Drop, 20%)</div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <div className="text-[10px] uppercase text-muted-foreground">Target Rate (-1.8%)</div>
                           <div className="font-bold text-lg text-blue-400/60">{plan.thirdOrderRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                         </div>
                         <div>
                           <div className="text-[10px] uppercase text-muted-foreground">Amount</div>
                           <div className="font-bold text-lg text-muted-foreground">{plan.thirdOrderKrw.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">KRW</span></div>
                         </div>
                      </div>
                   </div>
                 )}
                 
                 <div className="flex items-start space-x-2 bg-background p-3 rounded-lg border border-border mt-2">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5"/>
                    <div className="text-xs text-muted-foreground">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-foreground">Memo / Tag</span>
                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> Valid til {plan.validUntil.toLocaleDateString()}</span>
                      </div>
                      <div>{plan.memoText}</div>
                    </div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Other Currencies (Hold / Wait) */}
      <h2 className="text-xl font-bold mb-4 flex items-center text-muted-foreground">
         <Clock className="w-5 h-5 mr-2"/> Monitoring (Hold / Wait)
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 opacity-70">
         {plans.filter(p => !p.isActionable || p.firstOrderKrw === 0).map(plan => (
            <div key={plan.currency.code} className="bg-card border border-border rounded-lg p-4">
               <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">{plan.currency.code}</span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{plan.action}</span>
               </div>
               <div className="text-xs text-muted-foreground">Current: {plan.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
         ))}
      </div>

    </div>
  );
}
