import { PrismaClient } from '@prisma/client';
import { cn } from '@/lib/utils';
import { Activity, DollarSign, TrendingUp, TrendingDown, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const prisma = new PrismaClient();

async function getDashboardData() {
  const settings = await prisma.portfolioSetting.findFirst({ where: { id: 'default-settings' }});
  
  const positions = await prisma.portfolioPosition.findMany({ include: { currency: true }});
  
  const currencies = await prisma.currency.findMany({
    include: {
      dailyRates: { orderBy: { date: 'desc' }, take: 2 },
      signalScores: { orderBy: { signalDate: 'desc' }, take: 1 },
      regimeStates: { orderBy: { date: 'desc' }, take: 1 },
      tossExecutionPlans: { where: { status: 'PENDING' }, orderBy: { planDate: 'desc' }, take: 1 }
    }
  });

  const todayData = currencies.map(c => {
    const latestScore = c.signalScores[0];
    const latestRate = c.dailyRates[0];
    const prevRate = c.dailyRates[1];
    const latestRegime = c.regimeStates[0];
    const latestTossPlan = c.tossExecutionPlans[0];
    
    const changePct = prevRate && latestRate ? (latestRate.close - prevRate.close) / prevRate.close * 100 : 0;

    return {
      currency: c,
      rate: latestRate,
      changePct,
      score: latestScore,
      regime: latestRegime,
      tossPlan: latestTossPlan
    }
  }).filter(d => d.score);

  // Sort top picks
  const topPicks = [...todayData].sort((a, b) => b.score!.totalScore - a.score!.totalScore).slice(0, 3);
  
  const buyCandidates = todayData.filter(d => d.score?.actionCode?.includes('BUY')).length;
  const sellCandidates = todayData.filter(d => d.score?.actionCode?.includes('SELL')).length;

  return { settings, positions, todayData, topPicks, buyCandidates, sellCandidates };
}

export default async function DashboardPage() {
  const { settings, positions, todayData, topPicks, buyCandidates, sellCandidates } = await getDashboardData();

  const totalPositionsValue = positions.reduce((acc, p) => acc + p.currentValueKrw, 0);
  const totalAssets = (settings?.totalCapitalKrw || 0) + totalPositionsValue;

  return (
    <div className="min-h-screen p-8 lg:p-12 relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] -z-10 pointer-events-none" />

      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight font-[Outfit] text-gradient">Dashboard OS</h1>
          <p className="text-muted-foreground mt-2 font-medium">Quantitative FX Decision Dashboard</p>
        </div>
        <div className="glassmorphism rounded-2xl p-4 flex items-center space-x-6">
           <div className="text-right">
             <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Total Assets</div>
             <div className="text-2xl font-[Outfit] font-bold text-gradient-primary">
               {totalAssets.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">KRW</span>
             </div>
           </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="glassmorphism rounded-2xl p-6 flex flex-col justify-between hover-card-bump group">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Open Positions</span>
              <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">
                <Activity className="w-4 h-4 text-gray-300"/>
              </div>
            </div>
            <div className="text-4xl font-[Outfit] font-light mt-4">{positions.length}</div>
        </div>
        <div className="glassmorphism rounded-2xl p-6 flex flex-col justify-between hover-card-bump group relative overflow-hidden text-emerald-400">
            <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-sm font-bold uppercase tracking-widest">Buy Candidates</span>
              <div className="bg-emerald-500/10 p-2 rounded-lg">
                 <TrendingUp className="w-4 h-4"/>
              </div>
            </div>
            <div className="text-4xl font-[Outfit] font-light mt-4 relative z-10">{buyCandidates}</div>
        </div>
        <div className="glassmorphism rounded-2xl p-6 flex flex-col justify-between hover-card-bump group relative overflow-hidden text-rose-400">
            <div className="absolute inset-0 bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-sm font-bold uppercase tracking-widest">Sell Candidates</span>
              <div className="bg-rose-500/10 p-2 rounded-lg">
                 <TrendingDown className="w-4 h-4"/>
              </div>
            </div>
            <div className="text-4xl font-[Outfit] font-light mt-4 relative z-10">{sellCandidates}</div>
        </div>
        <div className="glassmorphism rounded-2xl p-6 flex flex-col justify-between hover-card-bump group relative overflow-hidden text-amber-500">
            <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-sm font-bold uppercase tracking-widest">Event Warnings</span>
              <div className="bg-amber-500/10 p-2 rounded-lg">
                 <AlertCircle className="w-4 h-4"/>
              </div>
            </div>
            <div className="text-4xl font-[Outfit] font-light mt-4 relative z-10">0</div>
        </div>
      </div>

      {/* TOP Picks */}
      <h2 className="text-2xl font-[Outfit] font-bold mb-6 text-gray-100">Top 3 Alpha Signals</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {topPicks.map((pick, i) => (
          <div key={pick.currency.code} className="glassmorphism rounded-3xl p-6 relative overflow-hidden group hover-card-bump">
             <div className="absolute top-0 right-0 bg-primary/80 backdrop-blur-md text-primary-foreground px-4 py-1.5 rounded-bl-2xl text-xs font-bold tracking-wider z-20">
               RANK {i+1}
             </div>
             
             {/* Diagonal Header Decoration */}
             <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-[40px] z-0 pointer-events-none" />

             <div className="flex items-center justify-between mb-4 mt-2 relative z-10">
                <div>
                   <span className="text-3xl font-[Outfit] font-bold text-white">{pick.currency.code}</span>
                   <span className="ml-3 text-xs font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5 uppercase tracking-wider">Group {pick.currency.strategyGroup}</span>
                </div>
                <div className="text-right">
                   <div className="text-xl font-medium tracking-tight text-gray-200">{pick.rate?.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                   <div className={cn("text-sm font-bold tracking-wider", pick.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                     {pick.changePct > 0 ? '+' : ''}{pick.changePct.toFixed(2)}%
                   </div>
                </div>
             </div>
             
             <div className="mt-8 flex justify-between items-end relative z-10">
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Algorithmic Score</div>
                  <div className="text-2xl font-bold text-gradient-primary">{pick.score?.totalScore.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">/ 100</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Action Code</div>
                  <div className="inline-block bg-primary/20 border border-primary/30 text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-extrabold tracking-widest">
                    {pick.score?.actionCode}
                  </div>
                </div>
             </div>
             <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center relative z-10">
                <span className="text-sm font-medium text-gray-400 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                   🎯 {pick.score?.recommendedTotalKrw?.toLocaleString() || 0} <span className="text-xs opacity-70">KRW</span>
                </span>
                <Link href={`/currency/${pick.currency.code}`} className="text-sm font-bold text-primary flex items-center hover:text-emerald-300 transition-colors hover:translate-x-1">
                  Deep Dive <ArrowRight className="w-4 h-4 ml-1.5"/>
                </Link>
             </div>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <h2 className="text-2xl font-[Outfit] font-bold mb-6 text-gray-100">Global Currency Universe</h2>
      <div className="w-full overflow-x-auto glassmorphism rounded-3xl p-1 border border-white/5">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-gray-400 uppercase tracking-widest border-b border-white/5">
            <tr>
              <th className="px-6 py-5 font-bold">Symbol</th>
              <th className="px-6 py-5 font-bold">Tier</th>
              <th className="px-6 py-5 font-bold text-right">Quote</th>
              <th className="px-6 py-5 font-bold text-center">Regime</th>
              <th className="px-6 py-5 font-bold text-center">Score</th>
              <th className="px-6 py-5 font-bold text-center">Engine Step</th>
              <th className="px-6 py-5 font-bold text-right">추천 투입금(KRW)</th>
              <th className="px-6 py-5 font-bold text-right">익절 🎯 / 물타기 📥</th>
              <th className="px-6 py-5 font-bold text-center">Toss 실행 버튼</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {todayData.map((row) => {
              const action = row.score?.actionCode || 'WAIT';
              const isBuy = action.includes('BUY');
              const isSell = action.includes('SELL');
              
              return (
                <tr key={row.currency.code} className="hover:bg-white/5 transition-colors duration-200 group">
                  <td className="px-6 py-4 font-medium">
                    <Link href={`/currency/${row.currency.code}`} className="flex items-center group-hover:translate-x-1 transition-transform">
                      <span className="font-bold text-lg text-gray-200 block">{row.currency.code}</span>
                      <span className="ml-3 text-xs text-muted-foreground hidden sm:block">{row.currency.name}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                     <span className="bg-white/5 px-2 py-1 rounded text-xs font-bold text-gray-400 border border-white/5">G{row.currency.strategyGroup}</span>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    <div className="font-medium text-gray-200 text-[15px]">{row.rate?.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className={cn("text-xs font-bold tracking-wide mt-1", row.changePct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-black/30 border border-white/5 text-gray-400 px-3 py-1.5 rounded-full">
                      {row.regime?.regimeCategory?.split('_').join(' ') || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "font-[Outfit] font-extrabold text-lg",
                      row.score!.totalScore >= 80 ? "text-gradient-primary" : (row.score!.totalScore >= 50 ? "text-gray-300" : "text-rose-400")
                    )}>
                      {row.score?.totalScore.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase border",
                      isBuy ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]" : 
                      (isSell ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-white/5 text-gray-400 border-white/10")
                    )}>
                      {action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.score?.recommendedTotalKrw ? (
                      <div>
                        <div className="font-bold text-gray-100 text-base">{row.score.recommendedTotalKrw.toLocaleString()} 원</div>
                        {action === 'BUY_ADD' && (
                          <div className="text-[10px] font-bold text-emerald-400/80 mt-1 uppercase tracking-wider">1차 분할 투입권장</div>
                        )}
                        {action === 'BUY_1' && (
                          <div className="text-[10px] font-bold text-emerald-400/80 mt-1 uppercase tracking-wider">전액 투입권장</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-sm">
                    {row.score?.targetRate1 || row.score?.dcaTargetRate ? (
                      <div className="flex flex-col gap-1 items-end">
                        <div className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20" title="Take Profit Level (+2.5x ATR)">
                          🎯 {row.score?.targetRate1?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '-'}
                        </div>
                        {row.score?.dcaTargetRate ? (
                          <div className="text-blue-400 font-bold bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20 mt-1" title="Next DCA Level (-1.5x ATR)">
                            📥 {row.score?.dcaTargetRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <div className="text-gray-500 font-bold bg-gray-500/10 px-2 py-0.5 rounded-md border border-gray-500/20 mt-1 line-through" title="V3.0 Grid Strategy is active">
                            🚨 무손절
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600 font-medium">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {(() => {
                      if (action === 'BUY_1') return <span className="inline-flex items-center text-white bg-blue-600 px-3 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-500 transition-colors shadow-blue-500/20 w-full justify-center">전액 매수하기</span>;
                      if (action === 'BUY_ADD') return <span className="inline-flex items-center text-white bg-blue-500/80 px-3 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-400 transition-colors w-full justify-center">50% 분할 매수</span>;
                      if (action === 'SELL_ALL') return <span className="inline-flex items-center text-white bg-rose-600 px-3 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-rose-500 transition-colors shadow-rose-500/20 w-full justify-center">전량 매도하기</span>;
                      if (action === 'SELL_SPLIT') return <span className="inline-flex items-center text-white bg-rose-500/80 px-3 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-rose-400 transition-colors w-full justify-center">50% 분할 매도</span>;
                      if (action === 'HOLD') return <span className="text-gray-400 font-bold text-sm bg-white/5 py-2 px-3 rounded-lg w-full inline-block">보유 / 관망</span>;
                      return <span className="text-gray-600 font-bold text-sm bg-black/20 py-2 px-3 rounded-lg border border-white/5 w-full inline-block">대기</span>;
                    })()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
