import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { ArrowLeft, PlusCircle, History, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const prisma = new PrismaClient();

export default async function TradesPage() {
  const currencies = await prisma.currency.findMany({ orderBy: { code: 'asc' }});
  
  const recentTrades = await prisma.tradeLog.findMany({
    orderBy: { tradeDate: 'desc' },
    take: 50
  });

  const positions = await prisma.portfolioPosition.findMany({ include: { currency: true }});

  async function addTrade(formData: FormData) {
    "use server"
    
    const currencyCode = formData.get('currencyCode') as string;
    const tradeType = formData.get('tradeType') as string;
    const price = Number(formData.get('price'));
    const amount = Number(formData.get('amount'));
    const tradeDateInput = formData.get('tradeDate') as string;
    const reason = formData.get('reason') as string;

    const tradeDate = tradeDateInput ? new Date(tradeDateInput) : new Date();
    const krwValue = price * amount;

    // 1. Log the trade
    await prisma.tradeLog.create({
      data: {
        currencyCode,
        tradeDate,
        tradeType,
        price,
        amount,
        krwValue,
        reason
      }
    });

    // 2. Update Portfolio Positions (Averaging Down, Taking Profit)
    const currentPos = await prisma.portfolioPosition.findUnique({ where: { currencyCode }});
    
    if (tradeType === 'BUY') {
      if (currentPos) {
        // Recalculate Average Price
        const totalAmount = currentPos.amount + amount;
        const oldCostBasis = currentPos.averagePrice * currentPos.amount;
        const newAvgPrice = (oldCostBasis + krwValue) / totalAmount;
        
        await prisma.portfolioPosition.update({
           where: { currencyCode },
           data: {
             amount: totalAmount,
             averagePrice: newAvgPrice,
             currentValueKrw: newAvgPrice * totalAmount, // Value placeholder until next live rate tick
             currentPhase: Math.min(3, currentPos.currentPhase + 1)
           }
        });
      } else {
        // Open entirely new position
        const settings = await prisma.portfolioSetting.findFirst({ where: { id: 'default-settings' }});
        const stopLossDrop = settings?.defaultStopLossPct || 0.018;
        const takeProfitRise = settings?.defaultTakeProfitPct || 0.03;

        await prisma.portfolioPosition.create({
           data: {
             currencyCode,
             averagePrice: price,
             amount: amount,
             currentValueKrw: krwValue,
             currentPhase: 1,
             stopLossRate: price * (1 - stopLossDrop), 
             targetRate: price * (1 + takeProfitRise)
           }
        });
      }
    } else if (tradeType === 'SELL') {
       if (currentPos) {
          const newAmount = currentPos.amount - amount;
          if (newAmount <= 0) {
             // Closed out completely
             await prisma.portfolioPosition.delete({ where: { currencyCode }});
          } else {
             // Partial take profit
             await prisma.portfolioPosition.update({
               where: { currencyCode },
               data: {
                 amount: newAmount,
                 currentValueKrw: currentPos.averagePrice * newAmount
               }
             });
          }
       }
    }

    revalidatePath('/trades');
    revalidatePath('/portfolio');
    revalidatePath('/');
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 mb-12">
       <div className="mb-6 flex space-x-4 items-center">
         <Link href="/" className="p-2 bg-muted/50 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
         </Link>
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Trade Ledger</h1>
            <p className="text-sm text-muted-foreground mt-1">Manual Input & Auto Position Recalculation</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left col: Add Trade Form */}
         <div className="bg-card border border-border rounded-xl p-6 lg:col-span-1 h-fit">
            <div className="flex items-center space-x-2 text-primary mb-6 border-b border-border/50 pb-4">
               <PlusCircle className="w-5 h-5"/>
               <h2 className="font-bold text-lg">Record Execution</h2>
            </div>
            
            <form action={addTrade} className="space-y-4">
               <div className="space-y-2">
                 <label className="text-xs font-semibold text-muted-foreground uppercase">Trade Type</label>
                 <div className="grid grid-cols-2 gap-2">
                    <label className="relative flex whitespace-nowrap text-center cursor-pointer">
                      <input type="radio" name="tradeType" value="BUY" defaultChecked className="peer sr-only" />
                      <div className="w-full text-foreground bg-muted border border-border peer-checked:bg-primary/20 peer-checked:text-primary peer-checked:border-primary p-3 rounded-lg font-bold transition-all flex justify-center items-center">
                         <TrendingUp className="w-4 h-4 mr-2"/> BUY
                      </div>
                    </label>
                    <label className="relative flex whitespace-nowrap text-center cursor-pointer">
                      <input type="radio" name="tradeType" value="SELL" className="peer sr-only" />
                      <div className="w-full text-foreground bg-muted border border-border peer-checked:bg-destructive/20 peer-checked:text-destructive peer-checked:border-destructive p-3 rounded-lg font-bold transition-all flex justify-center items-center">
                         <TrendingDown className="w-4 h-4 mr-2"/> SELL
                      </div>
                    </label>
                 </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Currency Code</label>
                  <select name="currencyCode" required className="w-full bg-muted/50 border border-border rounded-lg p-3 font-semibold text-foreground outline-none focus:border-primary appearance-none">
                     {currencies.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                     ))}
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Execution Price</label>
                    <input type="number" step="any" name="price" required className="w-full bg-muted/50 border border-border rounded-lg p-3 font-medium text-foreground outline-none focus:border-primary" placeholder="e.g. 1350.5" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Foreign Amount</label>
                    <input type="number" step="any" name="amount" required className="w-full bg-muted/50 border border-border rounded-lg p-3 font-medium text-foreground outline-none focus:border-primary" placeholder="e.g. 1000" />
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Execution Date</label>
                  <input type="datetime-local" name="tradeDate" className="w-full bg-muted/50 border border-border rounded-lg p-3 font-medium text-foreground outline-none focus:border-primary" />
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Memo / Reason</label>
                  <input type="text" name="reason" className="w-full bg-muted/50 border border-border rounded-lg p-3 font-medium text-foreground outline-none focus:border-primary placeholder:text-muted" placeholder="(Optional) Toss 1st target hit" />
               </div>

               <button type="submit" className="w-full !mt-6 bg-primary text-primary-foreground font-bold p-4 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Save & Update Portfolio
               </button>
            </form>
         </div>

         {/* Right col: History list */}
         <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
            <div className="flex items-center space-x-2 text-muted-foreground mb-6 border-b border-border/50 pb-4">
               <History className="w-5 h-5"/>
               <h2 className="font-bold text-lg text-foreground">Recent History</h2>
            </div>
            
            {recentTrades.length === 0 ? (
               <div className="h-64 flex flex-col justify-center items-center text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-50"/>
                  <p>No trades logged yet.</p>
               </div>
            ) : (
               <div className="w-full flex-col space-y-3">
                  {recentTrades.map((log) => {
                     const isBuy = log.tradeType === 'BUY';
                     return (
                        <div key={log.id} className="flex justify-between items-center p-4 bg-muted/20 border border-border/50 rounded-lg hover:bg-muted/40 transition-colors">
                           <div className="flex items-center space-x-4">
                              <div className={cn(
                                 "w-10 h-10 rounded-full flex justify-center items-center font-bold",
                                 isBuy ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                              )}>
                                {isBuy ? <TrendingUp className="w-5 h-5"/> : <TrendingDown className="w-5 h-5"/>}
                              </div>
                              <div>
                                 <div className="font-bold flex items-center space-x-2">
                                    <span className="text-lg">{log.currencyCode}</span>
                                    <span className={cn("text-xs px-2 py-0.5 rounded", isBuy ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground")}>{log.tradeType}</span>
                                 </div>
                                 <div className="text-xs text-muted-foreground mt-0.5">{log.tradeDate.toLocaleString()}</div>
                                 {log.reason && <div className="text-xs text-muted-foreground mt-1 bg-background px-2 py-1 rounded inline-block">&ldquo;{log.reason}&rdquo;</div>}
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="font-bold tabular-nums">@{log.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                              <div className="text-sm text-foreground/80 tabular-nums font-semibold mt-0.5">{log.amount.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground tabular-nums mt-0.5">{Math.round(log.krwValue).toLocaleString()} KRW</div>
                           </div>
                        </div>
                     )
                  })}
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
