import { PrismaClient } from '@prisma/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, PieChart, Wallet, ShieldAlert, Crosshair, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const prisma = new PrismaClient();

async function getPortfolioData() {
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
    
    // Engine recommendation logic parsing
    const canBuyAdd = actionCode === 'BUY_ADD' || (actionCode.includes('BUY') && pos.currentPhase < 3);
    const recommendTakeProfit = actionCode.includes('SELL');
    const isStopLossTriggered = currentRate <= pos.stopLossRate;
    const isTargetHit = currentRate >= pos.targetRate;

    return {
      ...pos,
      currentRate,
      currentKrwValue,
      costKrwValue,
      pnlKrw,
      pnlPct,
      latestScore,
      actionCode,
      canBuyAdd,
      recommendTakeProfit,
      isStopLossTriggered,
      isTargetHit
    };
  });

  // Calculate Group Weights against Max Limits
  const totalAssets = (settings?.totalCapitalKrw || 0) + totalPositionsValue;
  
  const groupExposure: Record<string, { currentKrw: number, currentWeight: number, maxWeight: number }> = {};
  
  positionRules.forEach(rule => {
     groupExposure[rule.strategyGroup] = { currentKrw: 0, currentWeight: 0, maxWeight: rule.maxWeightPct };
  });

  enrichedPositions.forEach(pos => {
     const grp = pos.currency.strategyGroup;
     if (groupExposure[grp]) {
        groupExposure[grp].currentKrw += pos.currentKrwValue;
     }
  });

  Object.values(groupExposure).forEach(g => {
    g.currentWeight = totalAssets > 0 ? g.currentKrw / totalAssets : 0;
  });

  return { settings, positions: enrichedPositions, totalPositionsValue, totalCostBase, totalAssets, groupExposure };
}

export default async function PortfolioPage() {
  const { settings, positions, totalPositionsValue, totalCostBase, totalAssets, groupExposure } = await getPortfolioData();

  const totalPnlKrw = totalPositionsValue - totalCostBase;
  const totalPnlPct = totalCostBase > 0 ? (totalPnlKrw / totalCostBase) * 100 : 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 mb-12">
      <div className="mb-6 flex space-x-4 items-center">
         <Link href="/" className="p-2 bg-muted/50 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
         </Link>
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolio Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time Holdings & Risk Exposures</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Total Assets Summary */}
        <div className="bg-card border border-border rounded-xl p-6 lg:col-span-1 flex flex-col justify-between">
           <div>
             <div className="flex items-center space-x-2 text-muted-foreground mb-4">
                <Wallet className="w-5 h-5"/>
                <h3 className="font-semibold">Total Account Equity</h3>
             </div>
             <div className="text-4xl font-bold mb-2">
               {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xl text-muted-foreground font-normal">KRW</span>
             </div>
             
             <div className="flex space-x-6 mt-6">
                <div>
                   <div className="text-sm text-muted-foreground mb-1">Total Return</div>
                   <div className={cn("text-xl font-bold", totalPnlPct >= 0 ? "text-green-500" : "text-red-500")}>
                     {totalPnlPct > 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                   </div>
                </div>
                <div>
                   <div className="text-sm text-muted-foreground mb-1">Unrealized P&L</div>
                   <div className={cn("text-xl font-bold", totalPnlKrw >= 0 ? "text-green-500" : "text-red-500")}>
                     {totalPnlKrw > 0 ? '+' : ''}{totalPnlKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                   </div>
                </div>
             </div>
           </div>
        </div>

        {/* Group Exposures */}
        <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
            <div className="flex items-center space-x-2 text-muted-foreground mb-4">
                <PieChart className="w-5 h-5"/>
                <h3 className="font-semibold">Strategy Group Exposures vs Limits</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {Object.entries(groupExposure).map(([group, data]) => {
                  const isNearingLimit = data.currentWeight >= data.maxWeight * 0.8;
                  const isOverLimit = data.currentWeight > data.maxWeight;
                  
                  return (
                    <div key={group} className="p-4 bg-muted/20 border border-border/50 rounded-lg">
                       <div className="flex justify-between items-center mb-2">
                         <span className="font-bold text-lg">Group {group}</span>
                         {isOverLimit ? <ShieldAlert className="w-4 h-4 text-destructive"/> : (isNearingLimit ? <ShieldAlert className="w-4 h-4 text-orange-500"/> : null)}
                       </div>
                       
                       <div className="flex items-end space-x-1 mb-2">
                         <span className={cn("text-2xl font-bold", isOverLimit ? "text-destructive" : "text-primary")}>
                           {(data.currentWeight * 100).toFixed(1)}%
                         </span>
                         <span className="text-sm text-muted-foreground mb-1">/ {(data.maxWeight * 100).toFixed(0)}% limit</span>
                       </div>
                       
                       <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                          <div 
                            className={cn("h-1.5 rounded-full", isOverLimit ? "bg-destructive" : (isNearingLimit ? "bg-orange-500" : "bg-primary"))} 
                            style={{ width: `${Math.min(100, (data.currentWeight / data.maxWeight) * 100)}%` }}
                          ></div>
                       </div>
                    </div>
                  );
               })}
            </div>
        </div>
      </div>

      {/* Held Positions Table */}
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <Crosshair className="w-5 h-5 mr-2 text-primary"/> Active Currency Positions
      </h2>
      
      {positions.length > 0 ? (
        <div className="w-full overflow-x-auto bg-card border border-border rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Currency</th>
                <th className="px-4 py-3 font-semibold text-center">Phase</th>
                <th className="px-4 py-3 font-semibold text-right">Avg Base</th>
                <th className="px-4 py-3 font-semibold text-right">Current Rate</th>
                <th className="px-4 py-3 font-semibold text-right">P&L (%)</th>
                <th className="px-4 py-3 font-semibold text-center">Stop Loss</th>
                <th className="px-4 py-3 font-semibold text-center">Target</th>
                <th className="px-4 py-3 font-semibold text-center">Add. Buy</th>
                <th className="px-4 py-3 font-semibold text-center">Take Profit</th>
                <th className="px-4 py-3 font-semibold text-center">Engine Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/currency/${pos.currencyCode}`} className="hover:text-primary transition-colors flex items-center">
                      <span className="font-bold text-lg">{pos.currencyCode}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs font-semibold">
                      {pos.currentPhase} / 3
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{pos.averagePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pos.currentRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className={cn("font-bold", pos.pnlPct >= 0 ? "text-green-500" : "text-red-500")}>
                      {pos.pnlPct > 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                    </div>
                    <div className={cn("text-xs", pos.pnlKrw >= 0 ? "text-green-500/80" : "text-red-500/80")}>
                      {pos.pnlKrw > 0 ? '+' : ''}{pos.pnlKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", pos.isStopLossTriggered ? "bg-destructive text-destructive-foreground animate-pulse" : "text-muted-foreground")}>
                      {pos.stopLossRate.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", pos.isTargetHit ? "bg-green-500 text-white animate-pulse" : "text-muted-foreground")}>
                      {pos.targetRate.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pos.canBuyAdd ? (
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">Possible</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pos.recommendTakeProfit ? (
                      <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">Recommended</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold",
                      pos.actionCode.includes('BUY') ? "bg-primary text-primary-foreground" : 
                      (pos.actionCode.includes('SELL') ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground")
                    )}>
                      {pos.actionCode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center flex flex-col items-center justify-center">
           <Wallet className="w-12 h-12 text-muted-foreground mb-4 opacity-50"/>
           <h3 className="text-xl font-bold mb-2">No Active Positions</h3>
           <p className="text-muted-foreground mb-6 max-w-md">Your portfolio is currently empty. Visit the dashboard to discover highly rated currency pairs to trade.</p>
           <Link href="/" className="bg-primary text-primary-foreground font-bold px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center">
             Go to Dashboard <ArrowRight className="w-4 h-4 ml-2"/>
           </Link>
        </div>
      )}
    </div>
  );
}
