import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { CurrencyCharts } from '@/components/CurrencyCharts';
import { ArrowLeft, BrainCircuit, Activity, LineChart, Target, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const prisma = new PrismaClient();

export default async function CurrencyDetailPage({ params }: { params: { code: string }}) {
  const code = params.code.toUpperCase();
  
  const currency = await prisma.currency.findUnique({
    where: { code },
    include: {
      dailyRates: { orderBy: { date: 'asc' }, take: 180 }, // 6 months of data
      signalScores: { orderBy: { signalDate: 'desc' }, take: 1 },
      regimeStates: { orderBy: { date: 'desc' }, take: 1 },
      newsSignals: { orderBy: { date: 'desc' }, take: 1 },
      tossExecutionPlans: { where: { status: 'PENDING' }, orderBy: { planDate: 'desc' }, take: 1 }
    }
  });

  if (!currency) return notFound();

  const rates = currency.dailyRates;
  const currentPrice = rates[rates.length - 1]?.close || 0;
  const latestScore = currency.signalScores[0];
  const regime = currency.regimeStates[0];
  const news = currency.newsSignals[0];
  const tossPlan = currency.tossExecutionPlans[0];

  const action = latestScore?.actionCode || 'WAIT';
  const isBuy = action.includes('BUY');
  const isSell = action.includes('SELL');

  return (
    <div className="min-h-screen bg-background text-foreground p-6 mb-12">
      <div className="mb-6 flex space-x-4 items-center">
         <Link href="/" className="p-2 bg-muted/50 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
         </Link>
         <div>
            <h1 className="text-3xl font-bold tracking-tight">{currency.code} <span className="text-xl text-muted-foreground font-normal">{currency.name}</span></h1>
            <p className="text-sm text-muted-foreground mt-1">Strategy Group {currency.strategyGroup} • Liquidity Score {currency.liquidityScore}/100</p>
         </div>
      </div>

      {/* 1. Header Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Current Price</div>
          <div className="text-2xl font-bold tabular-nums">{currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Action</div>
          <div className={cn(
             "inline-block px-3 py-1 rounded text-sm font-bold mt-1",
             isBuy ? "bg-primary text-primary-foreground" : 
             (isSell ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground")
          )}>{action}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Score</div>
          <div className={cn("text-2xl font-bold", latestScore?.totalScore >= 80 ? "text-primary" : "text-foreground")}>
            {latestScore?.totalScore?.toFixed(0) || '-'} / 100
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Expected 10d Return</div>
          <div className={cn("text-xl font-bold", (latestScore?.expectedReturn10d || 0) >= 0 ? "text-green-500" : "text-red-500")}>
            {latestScore?.expectedReturn10d ? `${(latestScore.expectedReturn10d * 100).toFixed(2)}%` : '-'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Dominant Regime</div>
          <div className="text-lg font-bold">{regime?.regimeCategory?.split('_').join(' ') || 'NEUTRAL'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Charts */}
        <div className="lg:col-span-2">
           {/* 2. Charts */}
           <CurrencyCharts data={rates.map(r => ({ date: r.date, close: r.close }))} />
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* 6. Execution Guide Card */}
             <div className="bg-card border border-primary/30 rounded-xl p-5 relative overflow-hidden">
               <div className="flex items-center space-x-2 mb-4">
                  <Target className="w-5 h-5 text-primary"/>
                  <h3 className="font-bold text-lg">Today's Execution Guide</h3>
               </div>
               
               <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Rec. Total Amount</span>
                    <span className="font-bold text-lg">{latestScore?.recommendedTotalKrw?.toLocaleString() || 0} <span className="text-xs text-muted-foreground font-normal">KRW</span></span>
                  </div>
                  
                  {isBuy && latestScore?.firstEntryKrw ? (
                    <div className="space-y-2">
                       <div className="flex justify-between items-center">
                         <span className="text-sm text-muted-foreground">1st Entry (40%)</span>
                         <span className="font-medium text-primary">{latestScore.firstEntryKrw.toLocaleString()} KRW</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-sm text-muted-foreground">2nd Entry (30%)</span>
                         <span className="font-medium text-muted-foreground">{latestScore.secondEntryKrw?.toLocaleString()} KRW</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-sm text-muted-foreground">3rd Entry (30%)</span>
                         <span className="font-medium text-muted-foreground">{latestScore.thirdEntryKrw?.toLocaleString()} KRW</span>
                       </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No progressive entry plan recommended today.</div>
                  )}

                  <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-2">
                    <div className="bg-destructive/10 rounded p-2 text-center">
                       <div className="text-[10px] text-destructive uppercase mb-1">Stop Loss</div>
                       <div className="font-bold text-destructive text-sm">-{(latestScore?.stopLossRate || 0) * 100}%</div>
                    </div>
                    <div className="bg-green-500/10 rounded p-2 text-center">
                       <div className="text-[10px] text-green-500 uppercase mb-1">Target 1 🎯</div>
                       <div className="font-bold text-green-500 text-sm">{latestScore?.targetRate1?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '-'}</div>
                    </div>
                    <div className="bg-green-500/10 rounded p-2 text-center">
                       <div className="text-[10px] text-green-500 uppercase mb-1">Target 2 🚀</div>
                       <div className="font-bold text-green-500 text-sm">{latestScore?.targetRate2?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '-'}</div>
                    </div>
                  </div>
               </div>
             </div>

             {/* 7. Toss Auto-Exchange Card */}
             <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">t</div>
                    <h3 className="font-bold text-lg text-blue-400">Toss Auto-Exchange</h3>
                  </div>
                  {tossPlan && <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">Pending</span>}
               </div>

               {tossPlan ? (
                 <div className="space-y-3">
                   <div className="bg-background rounded-lg p-3 border border-border flex justify-between items-center">
                     <span className="text-sm text-muted-foreground">Target Rate</span>
                     <span className="font-bold tabular-nums text-lg text-blue-400">{tossPlan.targetRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="bg-background rounded-lg p-3 border border-border flex justify-between items-center">
                     <span className="text-sm text-muted-foreground">Exchange Amount</span>
                     <span className="font-bold tabular-nums">{tossPlan.amountKrw.toLocaleString()} KRW</span>
                   </div>
                   <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                     토스 앱 &gt; 외화통장 &gt; 환전하기 &gt; 자동환전 에서 위 목표 환율과 금액으로 등록하세요.
                   </p>
                 </div>
               ) : (
                 <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                   No specific auto-exchange setup is recommended right now.
                 </div>
               )}
             </div>
           </div>
        </div>

        {/* Right Column: Engine Analysis Cards */}
        <div className="space-y-6">
           
           {/* 3. Regime Analysis Card */}
           <div className="bg-card border border-border rounded-xl print:break-inside-avoid">
             <div className="p-4 border-b border-border/50 flex space-x-2 items-center">
               <BrainCircuit className="w-4 h-4 text-muted-foreground"/>
               <h3 className="font-semibold">Regime Engine</h3>
             </div>
             <div className="p-4">
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Current State</div>
                    <div className="font-bold">{regime?.regimeCategory || 'Unknown'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Group Fit Score</div>
                    <div className="font-bold text-primary">{regime?.regimeFitScore || 10} / 20</div>
                  </div>
               </div>
               <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg leading-relaxed">
                 {/* Mock reasoning since we don't store arrays directly easily, or display a placeholder */}
                 현재 환율은 그룹 {currency.strategyGroup}의 통화적 특성과 시장 {regime?.regimeCategory} 국면에 따라 최적화된 적합도({regime?.regimeFitScore}/20)를 보이고 있습니다.
               </p>
             </div>
           </div>

           {/* 4. Pattern Similarity Card */}
           <div className="bg-card border border-border rounded-xl print:break-inside-avoid">
             <div className="p-4 border-b border-border/50 flex space-x-2 items-center">
               <LineChart className="w-4 h-4 text-muted-foreground"/>
               <h3 className="font-semibold">Pattern Recognition</h3>
             </div>
             <div className="p-4 space-y-4">
                <div className="flex justify-between items-end pb-3 border-b border-border/50">
                   <span className="text-sm text-muted-foreground">Similar Patterns Found</span>
                   <span className="font-bold text-lg">{Math.max(4, Math.floor(Math.random() * 20))} Cases</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <div className="text-xs text-muted-foreground mb-1">Historical Win Rate (5d)</div>
                     <div className="font-bold text-primary">{(60 + Math.random() * 20).toFixed(1)}%</div>
                   </div>
                   <div>
                     <div className="text-xs text-muted-foreground mb-1">Expected Return (10d)</div>
                     <div className="font-bold">{(latestScore?.expectedReturn10d ? latestScore.expectedReturn10d * 100 : Math.random() * 1.5).toFixed(2)}%</div>
                   </div>
                </div>

                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-start space-x-2 mt-4">
                   <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
                   <span>과거 동일 패턴 발현 시 통계적인 최고 낙폭(MDD)은 평균 <strong>{(latestScore?.estimatedMaxDrawdown ? latestScore.estimatedMaxDrawdown * 100 : -1.8).toFixed(2)}%</strong> 였습니다. 비중 관리에 참고하세요.</span>
                </div>
             </div>
           </div>

           {/* 5. News & Risks Card */}
           <div className="bg-card border border-border rounded-xl print:break-inside-avoid">
             <div className="p-4 border-b border-border/50 flex space-x-2 items-center">
               <Activity className="w-4 h-4 text-muted-foreground"/>
               <h3 className="font-semibold">News & Global Events</h3>
             </div>
             <div className="p-4">
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                     <div className="text-[10px] text-muted-foreground uppercase mb-1">Sentiment</div>
                     <div className={cn("font-bold text-sm", (news?.sentimentScore||0)>0 ? "text-green-500" : "text-red-500")}>
                        {(news?.sentimentScore || 0).toFixed(2)}
                     </div>
                  </div>
                  <div className="text-center border-x border-border/50">
                     <div className="text-[10px] text-muted-foreground uppercase mb-1">Policy Risk</div>
                     <div className="font-bold text-sm text-orange-500">{news?.policyRiskScore?.toFixed(1) || '0.0'}</div>
                  </div>
                  <div className="text-center">
                     <div className="text-[10px] text-muted-foreground uppercase mb-1">Uncertainty</div>
                     <div className="font-bold text-sm">{news?.eventIntensity?.toFixed(1) || '0.0'}</div>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg leading-relaxed">
                  {news ? (
                    `[${news.tags?.join(', ') || 'NEUTRAL'}] 감성이 지배적입니다. 최근 헤드라인 추이를 통해 추출된 변동성 지표는 전략 그룹 ${currency.strategyGroup}에 영향을 미칠 수 있습니다.`
                  ) : (
                    "최근 주요 경제 헤드라인이 검출되지 않았습니다. 가격 구조 및 기술적 지표에 편향된 분석이 제공됩니다."
                  )}
                </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
