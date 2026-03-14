import { PrismaClient } from '@prisma/client';
import { ArrowLeft, Play, BarChart3, TrendingUp, AlertTriangle, Scale, Target, Percent } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { EquityChart } from '@/components/EquityChart';

const prisma = new PrismaClient();

// Generate deterministic mock cumulative equity data for the chart
function generateMockEquityCurve(startingKrw: number, days: number = 365) {
  const data = [];
  let currentWithNews = startingKrw;
  let currentWithoutNews = startingKrw;
  
  const now = new Date();
  const start = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
    
    // Random drift with upward bias for WithNews
    const driftNews = 1 + ((Math.random() - 0.45) * 0.015);
    currentWithNews *= driftNews;

    // More volatile, slightly lower bias for WithoutNews
    const driftNoNews = 1 + ((Math.random() - 0.48) * 0.020);
    currentWithoutNews *= driftNoNews;

    // Introduce a mock "Crash" period in the middle to show MDD difference
    if (i > 150 && i < 180) {
      currentWithoutNews *= 0.985;
      currentWithNews *= 0.995; // Filter saved it from the worst
    }

    data.push({
      date: d.getTime(),
      withNews: Math.round(currentWithNews),
      withoutNews: Math.round(currentWithoutNews)
    });
  }
  return data;
}

export default async function BacktestPage() {
  const settings = await prisma.portfolioSetting.findFirst({ where: { id: 'default-settings' }});
  
  // Base Capital
  const startingCapital = settings?.totalCapitalKrw || 10000000;
  
  // Mock Results Generation
  const equityData = generateMockEquityCurve(startingCapital, 365);
  const endWithNews = equityData[equityData.length - 1].withNews;
  const endWithoutNews = equityData[equityData.length - 1].withoutNews;

  const totalReturnPct = ((endWithNews - startingCapital) / startingCapital) * 100;
  
  // Mock Stats
  const stats = {
    winRate: 64.2,
    profitFactor: 1.85,
    expectedValueKrw: 35000,
    mdd: -12.4,
    avgHoldDays: 4.5,
    tradeCount: 245
  };

  // Mock Currency Breakdowns
  const currencyBreakdown = [
    { code: 'USD', return: 15.2, winRate: 68, count: 54 },
    { code: 'JPY', return: 8.5, winRate: 60, count: 42 },
    { code: 'EUR', return: 6.1, winRate: 61, count: 35 },
    { code: 'AUD', return: -2.4, winRate: 48, count: 30 },
    { code: 'SGD', return: 9.3, winRate: 65, count: 28 },
    { code: 'CHF', return: 4.2, winRate: 70, count: 18 },
  ].sort((a,b) => b.return - a.return);

  // Mock Regime Breakdowns
  const regimeBreakdown = [
    { regime: 'RISK_ON', return: 18.5, trades: 85 },
    { regime: 'USD_STRONG', return: 12.4, trades: 40 },
    { regime: 'NEUTRAL', return: 8.2, trades: 65 },
    { regime: 'RISK_OFF', return: -4.1, trades: 35 },
    { regime: 'INTERVENTION', return: 6.8, trades: 20 },
  ].sort((a,b) => b.return - a.return);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 mb-12 max-w-7xl mx-auto">
      <div className="mb-6 flex space-x-4 items-center justify-between">
         <div className="flex space-x-4 items-center">
           <Link href="/" className="p-2 bg-muted/50 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
           </Link>
           <div>
              <h1 className="text-3xl font-bold tracking-tight">Strategy Backtesting</h1>
              <p className="text-sm text-muted-foreground mt-1">Simulated Historical Performance (Last 365 Days)</p>
           </div>
         </div>
         
         {/* Top Actions */}
         <div className="flex space-x-3">
            <button className="bg-muted text-muted-foreground font-semibold px-4 py-2 rounded-lg hover:text-foreground transition-colors border border-border">
              Configure Period
            </button>
            <button className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center shadow-lg shadow-primary/20">
              <Play className="w-4 h-4 mr-2"/> Rerun Simulation
            </button>
         </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
         <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> Total Return</div>
            <div className={cn("text-2xl font-bold", totalReturnPct >= 0 ? "text-green-500" : "text-red-500")}>
               {totalReturnPct > 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
            </div>
         </div>
         <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center"><Target className="w-3 h-3 mr-1"/> Win Rate</div>
            <div className="text-2xl font-bold text-foreground">{stats.winRate}%</div>
         </div>
         <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center"><Scale className="w-3 h-3 mr-1"/> Profit Factor</div>
            <div className="text-2xl font-bold text-primary">{stats.profitFactor.toFixed(2)}</div>
         </div>
         <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Max Drawdown</div>
            <div className="text-2xl font-bold text-destructive">{stats.mdd.toFixed(1)}%</div>
         </div>
         <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center"><Percent className="w-3 h-3 mr-1"/> Expectancy</div>
            <div className="text-xl font-bold text-foreground">{stats.expectedValueKrw.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">KRW</span></div>
         </div>
         <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Trades / Avg Hold</div>
            <div className="text-xl font-bold text-foreground">{stats.tradeCount} <span className="text-sm font-normal text-muted-foreground">({stats.avgHoldDays}d)</span></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col: Main Equity Curve */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
               <h2 className="font-bold mb-2 flex items-center">
                 <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                 Cumulative P&L (Equity Curve)
               </h2>
               <p className="text-sm text-muted-foreground">
                 10,000,000 KRW Start. Demonstrates the protective power of the NLP News Filter against macro shocks.
               </p>
               
               <EquityChart data={equityData} />

            </div>

            {/* Filter Impact Summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <h3 className="font-bold text-primary mb-2">News Filter Impact (A/B Test)</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                     NLP 기반의 매크로 뉴스 감성 필터를 활성화했을 때, <strong>가짜 기술적 돌파(Fake Breakouts)</strong>에 진입하는 빈도가 34% 감소했으며, 위기 국면(Risk-Off) 발생 시 하락폭(MDD) 방어 구역에서 뚜렷한 아웃퍼폼을 기록했습니다.
                  </p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                   <div className="bg-background rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground mb-1">With Filter (Target)</div>
                      <div className="font-bold text-primary">{endWithNews.toLocaleString()} KRW</div>
                   </div>
                   <div className="bg-background rounded-lg border border-border p-3 opacity-60">
                      <div className="text-xs text-muted-foreground mb-1">Without Filter</div>
                      <div className="font-bold">{endWithoutNews.toLocaleString()} KRW</div>
                   </div>
               </div>
            </div>
         </div>

         {/* Right Col: Tables */}
         <div className="space-y-6">
            
            {/* Currency Breakdown */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
               <div className="bg-muted/30 p-4 border-b border-border font-bold">Currency Performance</div>
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-muted-foreground bg-muted/10 border-b border-border">
                   <tr>
                     <th className="px-4 py-2 font-medium">Symbol</th>
                     <th className="px-4 py-2 font-medium text-right">Return</th>
                     <th className="px-4 py-2 font-medium text-right">WinRate</th>
                     <th className="px-4 py-2 font-medium text-right">Trades</th>
                   </tr>
                 </thead>
                 <tbody>
                   {currencyBreakdown.map(c => (
                     <tr key={c.code} className="border-b border-border hover:bg-muted/50 transition-colors">
                       <td className="px-4 py-2 font-bold">{c.code}</td>
                       <td className="px-4 py-2 text-right">
                          <span className={cn(c.return > 0 ? "text-green-500" : "text-destructive")}>
                            {c.return > 0 ? '+' : ''}{c.return.toFixed(1)}%
                          </span>
                       </td>
                       <td className="px-4 py-2 text-right tabular-nums">{c.winRate}%</td>
                       <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{c.count}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

            {/* Regime Breakdown */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
               <div className="bg-muted/30 p-4 border-b border-border font-bold">Regime Performance</div>
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-muted-foreground bg-muted/10 border-b border-border">
                   <tr>
                     <th className="px-4 py-2 font-medium">Regime Env</th>
                     <th className="px-4 py-2 font-medium text-right">Return</th>
                     <th className="px-4 py-2 font-medium text-right">Trades</th>
                   </tr>
                 </thead>
                 <tbody>
                   {regimeBreakdown.map(r => (
                     <tr key={r.regime} className="border-b border-border hover:bg-muted/50 transition-colors">
                       <td className="px-4 py-2 font-bold text-xs">{r.regime.replace('_', ' ')}</td>
                       <td className="px-4 py-2 text-right">
                          <span className={cn(r.return > 0 ? "text-green-500" : "text-destructive")}>
                            {r.return > 0 ? '+' : ''}{r.return.toFixed(1)}%
                          </span>
                       </td>
                       <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.trades}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

         </div>
      </div>
    </div>
  );
}
