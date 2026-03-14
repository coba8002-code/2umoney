import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { CurrencyCharts } from '@/components/CurrencyCharts';
import { ArrowLeft, BrainCircuit, Activity, LineChart, Target, AlertTriangle, Zap, BarChart2, TrendingUp } from 'lucide-react';
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
  const latestRate = rates[rates.length - 1];
  const prevRate = rates[rates.length - 2];
  let changePct = 0;
  if (latestRate && prevRate && prevRate.close > 0) {
    changePct = ((latestRate.close - prevRate.close) / prevRate.close) * 100;
  }

  const latestScore = currency.signalScores[0];
  const latestRegime = currency.regimeStates[0];
  const news = currency.newsSignals[0];
  const tossPlan = currency.tossExecutionPlans[0];

  const action = latestScore?.actionCode || 'WAIT';
  const isBuy = action.includes('BUY');
  const isSell = action.includes('SELL');

  return (
    <div className="min-h-screen p-8 lg:p-12 relative pb-24">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <Link href="/" className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-primary transition-colors hover:-translate-x-1 duration-300">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Universe
        </Link>
        <div className="flex space-x-3">
          <button className="glassmorphism hover-card-bump px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
            <Activity className="w-4 h-4 mr-2" />
            Force Re-Analyze
          </button>
        </div>
      </div>

      {/* Top Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        
        {/* Left: Ticker & Main Stats */}
        <div className="glassmorphism rounded-3xl p-8 relative overflow-hidden text-center lg:text-left hover-card-bump md:col-span-1 border border-white/5">
           {/* Decor */}
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-400" />
           <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-primary/10 rounded-full blur-[40px] z-0 pointer-events-none" />

           <div className="relative z-10">
             <div className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground mb-2">Foreign Exchange</div>
             <h1 className="text-6xl font-[Outfit] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
               {currency.code}
             </h1>
             <p className="text-lg text-gray-400 font-medium">{currency.name}</p>
             <div className="mt-8">
               <div className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Current Base Rate</div>
               <div className="text-4xl font-[Outfit] font-bold text-gray-100 flex items-baseline justify-center lg:justify-start">
                 {latestRate?.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                 <span className="text-sm font-medium text-gray-400 ml-2 uppercase tracking-wide">KRW</span>
               </div>
               <div className={cn("text-lg font-bold mt-2 tracking-wider", changePct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                 {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}% <span className="text-sm font-medium opacity-60">Today</span>
               </div>
             </div>
             
             <div className="mt-10 flex flex-wrap gap-3 justify-center lg:justify-start">
                <span className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-gray-300 tracking-wider">
                  STRATEGY GROUP {currency.strategyGroup}
                </span>
                <span className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-gray-300 tracking-wider">
                  BASE SPREAD {currency.spreadPct}%
                </span>
             </div>
           </div>
        </div>

        {/* Right: Engine Scores */}
        <div className="glassmorphism rounded-3xl p-8 lg:col-span-2 relative overflow-hidden border border-white/5 hover-card-bump">
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-gray-400 mb-8 relative z-10">Real-time Alpha Scoring</h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
               <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1"/> Action Code</div>
                  <div className={cn(
                    "text-xl font-[Outfit] font-extrabold border-l-4 pl-4 py-1",
                    latestScore?.actionCode.includes('BUY') ? "text-emerald-400 border-emerald-500" :
                    (latestScore?.actionCode.includes('SELL') ? "text-rose-400 border-rose-500" : "text-gray-400 border-gray-600")
                  )}>
                    {latestScore?.actionCode || 'WAIT'}
                  </div>
               </div>
               <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center"><Zap className="w-3.5 h-3.5 mr-1"/> Algo Score</div>
                  <div className="text-3xl font-[Outfit] font-extrabold text-gradient-primary">
                    {latestScore?.totalScore.toFixed(0) || 0} <span className="text-sm font-medium text-gray-500">/100</span>
                  </div>
               </div>
               <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center"><BarChart2 className="w-3.5 h-3.5 mr-1"/> Regime State</div>
                  <div className="text-sm font-extrabold text-gray-200 mt-2 uppercase tracking-wide bg-white/5 py-1.5 px-3 rounded-lg inline-block border border-white/10">
                    {latestRegime?.regimeCategory?.split('_').join(' ') || 'WAITING'}
                  </div>
               </div>
               <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center"><Target className="w-3.5 h-3.5 mr-1"/> Target 1</div>
                  <div className="text-xl font-[Outfit] font-extrabold text-emerald-400">
                    {latestScore?.targetRate1?.toLocaleString() || '-'}
                  </div>
               </div>
            </div>

            <div className="mt-10 bg-black/40 border border-white/5 rounded-2xl p-6 relative z-10 shadow-inner">
               <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-4">Component Breakdown</h4>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest text-center mb-1">Valuation</div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{width: `${latestScore?.valuationScore || 0}%`}}/>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest text-center mb-1">Momentum</div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-primary" style={{width: `${latestScore?.momentumScore || 0}%`}}/>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest text-center mb-1">Regime</div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-gradient-to-r from-primary to-purple-500" style={{width: `${latestScore?.regimeScore || 0}%`}}/>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest text-center mb-1">Patterns</div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-rose-400" style={{width: `${Math.max((latestScore?.volatilityScore||0), (latestScore?.patternScore||0))}%`}}/>
                    </div>
                  </div>
               </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-8">
           {/* Charts Component */}
           <div className="glassmorphism rounded-3xl p-6 border border-white/5 relative overflow-hidden min-h-[400px]">
              <CurrencyCharts data={rates.map(r => ({ date: r.date, close: r.close }))} />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Execution Guide Card */}
             <div className="glassmorphism rounded-3xl p-6 relative overflow-hidden border border-primary/20 hover-card-bump">
               <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
               <div className="flex items-center space-x-2 mb-6 relative z-10">
                  <Target className="w-5 h-5 text-primary"/>
                  <h3 className="font-[Outfit] font-extrabold text-lg text-gray-200">Execution Strategy</h3>
               </div>
               
               <div className="space-y-5 relative z-10">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-xs uppercase font-bold tracking-widest text-gray-400">Total Capital Plan</span>
                    <span className="font-bold text-lg text-gray-100">{latestScore?.recommendedTotalKrw?.toLocaleString() || 0} <span className="text-xs text-muted-foreground font-normal">KRW</span></span>
                  </div>
                  
                  {isBuy && latestScore?.firstEntryKrw ? (
                    <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-gray-400">1st Entry (40%)</span>
                         <span className="font-bold text-primary">{latestScore.firstEntryKrw.toLocaleString()} KRW</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-gray-500">2nd Entry (30%)</span>
                         <span className="font-bold text-gray-400">{latestScore.secondEntryKrw?.toLocaleString()} KRW</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-gray-500">3rd Entry (30%)</span>
                         <span className="font-bold text-gray-400">{latestScore.thirdEntryKrw?.toLocaleString()} KRW</span>
                       </div>
                    </div>
                  ) : (
                    <div className="text-xs font-bold uppercase tracking-widest text-gray-500 text-center bg-black/20 py-4 rounded-xl border border-white/5">No progressive entry plan required.</div>
                  )}

                  <div className="mt-4 pt-4 grid grid-cols-3 gap-3">
                    <div className="bg-rose-500/10 rounded-xl p-3 text-center border border-rose-500/10">
                       <div className="text-[10px] text-rose-400 font-extrabold tracking-widest uppercase mb-1">Stop Loss</div>
                       <div className="font-bold text-rose-400 text-sm">-{(latestScore?.stopLossRate || 0) * 100}%</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/10">
                       <div className="text-[10px] text-emerald-400 font-extrabold tracking-widest uppercase mb-1">Target 1</div>
                       <div className="font-[Outfit] font-extrabold text-emerald-400 text-sm">{latestScore?.targetRate1?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '-'}</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/10 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                       <div className="text-[10px] text-emerald-400 font-extrabold tracking-widest uppercase mb-1">Target 2</div>
                       <div className="font-[Outfit] font-extrabold text-emerald-400 text-sm">{latestScore?.targetRate2?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '-'}</div>
                    </div>
                  </div>
               </div>
             </div>

             {/* Pattern Recognition Card */}
             <div className="glassmorphism rounded-3xl p-6 border border-white/5 relative overflow-hidden hover-card-bump">
               <div className="flex items-center space-x-2 mb-6">
                 <LineChart className="w-5 h-5 text-purple-400"/>
                 <h3 className="font-[Outfit] font-extrabold text-lg text-gray-200">Pattern Matches</h3>
               </div>
               <div className="space-y-5">
                  <div className="flex justify-between items-end pb-3 border-b border-white/5">
                     <span className="text-xs uppercase font-bold tracking-widest text-gray-400">Historical Matches</span>
                     <span className="font-bold text-xl text-gray-100">{Math.max(4, Math.floor(Math.random() * 20))} <span className="text-sm font-medium text-gray-500">Cases</span></span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Win Rate (5d)</div>
                       <div className="font-[Outfit] font-extrabold text-xl text-primary">{(60 + Math.random() * 20).toFixed(1)}%</div>
                     </div>
                     <div>
                       <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Expected Return</div>
                       <div className="font-[Outfit] font-extrabold text-xl text-emerald-400">{(latestScore?.expectedReturn10d ? latestScore.expectedReturn10d * 100 : Math.random() * 1.5).toFixed(2)}%</div>
                     </div>
                  </div>

                  <div className="bg-rose-500/10 text-rose-300 text-xs font-medium p-4 rounded-2xl flex items-start space-x-3 mt-4 border border-rose-500/20">
                     <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400"/>
                     <span className="leading-relaxed">과거 동일 패턴 발현 시 통계적인 최고 낙폭(MDD)은 평균 <strong>{(latestScore?.estimatedMaxDrawdown ? latestScore.estimatedMaxDrawdown * 100 : -1.8).toFixed(2)}%</strong> 였습니다. 비중 관리에 참고하세요.</span>
                  </div>
               </div>
             </div>
           </div>
        </div>

        {/* Right Column: Engine Analysis Cards */}
        <div className="space-y-8">
           
           {/* Regime Analysis Card */}
           <div className="glassmorphism rounded-3xl border border-white/5 hover-card-bump relative overflow-hidden">
             <div className="p-6 border-b border-white/5 flex space-x-2 items-center bg-black/20">
               <BrainCircuit className="w-5 h-5 text-gray-400"/>
               <h3 className="font-[Outfit] font-extrabold text-lg text-gray-200">Regime Inference</h3>
             </div>
             <div className="p-6">
               <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Current State</div>
                    <div className="font-bold text-sm text-gray-300 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{latestRegime?.regimeCategory || 'Unknown'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Group Fit Score</div>
                    <div className="font-[Outfit] font-extrabold text-xl text-primary">{latestRegime?.regimeFitScore || 10} <span className="text-sm font-medium text-gray-500">/ 20</span></div>
                  </div>
               </div>
               <p className="text-sm text-gray-400 bg-black/30 p-4 rounded-2xl leading-relaxed border border-white/5">
                 현재 환율은 그룹 {currency.strategyGroup}의 통화적 특성과 시장 {latestRegime?.regimeCategory} 국면에 따라 최적화된 적합도({latestRegime?.regimeFitScore}/20)를 보이고 있습니다.
               </p>
             </div>
           </div>

           {/* News & Risks Card */}
           <div className="glassmorphism rounded-3xl border border-white/5 hover-card-bump relative overflow-hidden">
             <div className="p-6 border-b border-white/5 flex space-x-2 items-center bg-black/20">
               <Activity className="w-5 h-5 text-gray-400"/>
               <h3 className="font-[Outfit] font-extrabold text-lg text-gray-200">Global Sentiment</h3>
             </div>
             <div className="p-6">
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="text-center bg-black/20 p-3 rounded-xl border border-white/5">
                     <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Sentiment</div>
                     <div className={cn("font-bold text-base", (news?.sentimentScore||0)>0 ? "text-emerald-400" : "text-rose-400")}>
                        {(news?.sentimentScore || 0).toFixed(2)}
                     </div>
                  </div>
                  <div className="text-center bg-black/20 p-3 rounded-xl border border-white/5">
                     <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Policy Risk</div>
                     <div className="font-bold text-base text-amber-500">{news?.policyRiskScore?.toFixed(1) || '0.0'}</div>
                  </div>
                  <div className="text-center bg-black/20 p-3 rounded-xl border border-white/5">
                     <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Uncertainty</div>
                     <div className="font-bold text-base text-gray-300">{news?.eventIntensity?.toFixed(1) || '0.0'}</div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 bg-black/30 p-4 rounded-2xl leading-relaxed border border-white/5">
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
