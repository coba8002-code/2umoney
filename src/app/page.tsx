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
    <div className="min-h-screen bg-background text-foreground p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">2UMONEY OS</h1>
        <p className="text-muted-foreground mt-1">Quantitative FX Decision Dashboard</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Assets</span>
              <DollarSign className="w-4 h-4 text-muted-foreground"/>
            </div>
            <div className="text-2xl font-bold mt-2">{totalAssets.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">KRW</span></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Open Positions</span>
              <Activity className="w-4 h-4 text-muted-foreground"/>
            </div>
            <div className="text-2xl font-bold mt-2">{positions.length}</div>
        </div>
        <div className="bg-primary/20 border border-primary/30 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary">Buy Candidates</span>
              <TrendingUp className="w-4 h-4 text-primary"/>
            </div>
            <div className="text-2xl font-bold text-primary mt-2">{buyCandidates}</div>
        </div>
        <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-destructive">Sell Candidates</span>
              <TrendingDown className="w-4 h-4 text-destructive"/>
            </div>
            <div className="text-2xl font-bold text-destructive mt-2">{sellCandidates}</div>
        </div>
        <div className="bg-accent/20 border border-accent/30 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-accent-foreground">Event Warnings</span>
              <AlertCircle className="w-4 h-4 text-accent-foreground"/>
            </div>
            <div className="text-2xl font-bold text-accent-foreground mt-2">0</div>
        </div>
      </div>

      {/* TOP Picks */}
      <h2 className="text-xl font-bold mb-4">Today's Top Picks</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {topPicks.map((pick, i) => (
          <div key={pick.currency.code} className="bg-card border border-primary/50 relative overflow-hidden rounded-xl p-5">
             <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-lg text-xs font-bold">
               TOP {i+1}
             </div>
             <div className="flex items-center justify-between mb-2 mt-2">
                <div>
                   <span className="text-2xl font-bold">{pick.currency.code}</span>
                   <span className="ml-2 text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">Group {pick.currency.strategyGroup}</span>
                </div>
                <div className="text-right">
                   <div className="text-lg font-semibold">{pick.rate?.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                   <div className={cn("text-xs font-semibold", pick.changePct >= 0 ? 'text-green-500' : 'text-red-500')}>
                     {pick.changePct > 0 ? '+' : ''}{pick.changePct.toFixed(2)}%
                   </div>
                </div>
             </div>
             
             <div className="mt-4 flex justify-between items-end">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Score</div>
                  <div className="text-xl font-bold text-primary">{pick.score?.totalScore.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">/ 100</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Action</div>
                  <div className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-bold">
                    {pick.score?.actionCode}
                  </div>
                </div>
             </div>
             <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Rec. Entry: {pick.score?.recommendedTotalKrw?.toLocaleString() || 0} KRW</span>
                <Link href={`/currency/${pick.currency.code}`} className="text-xs font-medium text-primary flex items-center hover:underline">
                  Analyze <ArrowRight className="w-3 h-3 ml-1"/>
                </Link>
             </div>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <h2 className="text-xl font-bold mb-4">All Currencies & Signals</h2>
      <div className="w-full overflow-x-auto bg-card border border-border rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold">Currency</th>
              <th className="px-4 py-3 font-semibold">Group</th>
              <th className="px-4 py-3 font-semibold text-right">Price</th>
              <th className="px-4 py-3 font-semibold text-center">Regime</th>
              <th className="px-4 py-3 font-semibold text-center">Score</th>
              <th className="px-4 py-3 font-semibold text-center">Action</th>
              <th className="px-4 py-3 font-semibold text-right">Rec. KRW</th>
              <th className="px-4 py-3 font-semibold text-right">Target 1 🎯</th>
              <th className="px-4 py-3 font-semibold text-center">Toss Auto</th>
            </tr>
          </thead>
          <tbody>
            {todayData.map((row) => {
              const action = row.score?.actionCode || 'WAIT';
              const isBuy = action.includes('BUY');
              const isSell = action.includes('SELL');
              
              return (
                <tr key={row.currency.code} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/currency/${row.currency.code}`} className="hover:text-primary transition-colors flex items-center">
                      <span className="font-bold">{row.currency.code}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{row.currency.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">Group {row.currency.strategyGroup}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div>{row.rate?.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className={cn("text-xs font-medium", row.changePct >= 0 ? "text-green-500" : "text-red-500")}>
                      {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                      {row.regime?.regimeCategory?.split('_').join(' ') || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "font-bold",
                      row.score!.totalScore >= 80 ? "text-primary" : (row.score!.totalScore >= 50 ? "text-foreground" : "text-destructive")
                    )}>
                      {row.score?.totalScore.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold",
                      isBuy ? "bg-primary text-primary-foreground" : 
                      (isSell ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground")
                    )}>
                      {action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <div>{row.score?.recommendedTotalKrw?.toLocaleString() || '-'}</div>
                    {isBuy && row.score?.firstEntryKrw && (
                      <div className="text-xs text-primary">1차: {row.score.firstEntryKrw.toLocaleString()}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {row.score?.targetRate1?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.tossPlan ? (
                      <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded border border-blue-500/30">PENDING</span>
                    ) : (
                       action.includes('AUTO') ? <span className="text-xs text-primary font-medium">조언됨</span> : <span className="text-xs text-muted-foreground">-</span>
                    )}
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
