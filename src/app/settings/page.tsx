import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { ArrowLeft, Save, RefreshCcw, Settings, ShieldAlert, Newspaper } from 'lucide-react';
import Link from 'next/link';

const prisma = new PrismaClient();

export default async function SettingsPage() {
  let settings = await prisma.portfolioSetting.findFirst({ where: { id: 'default-settings' }});
  
  if (!settings) {
    settings = await prisma.portfolioSetting.create({
      data: {
        id: 'default-settings',
        totalCapitalKrw: 10000000,
        accountRiskPct: 0.007,
        defaultStopLossPct: 0.018,
        defaultTakeProfitPct: 0.03,
        newsFilterEnabled: true,
        eventAvoidanceLevel: 5
      }
    });
  }

  const rules = await prisma.positionRule.findMany({ orderBy: { group: 'asc' }});

  async function saveSettings(formData: FormData) {
    "use server"
    await prisma.portfolioSetting.update({
      where: { id: 'default-settings' },
      data: {
        totalCapitalKrw: Number(formData.get('totalCapitalKrw')),
        accountRiskPct: Number(formData.get('accountRiskPct')) / 100,
        defaultStopLossPct: Number(formData.get('defaultStopLossPct')) / 100,
        defaultTakeProfitPct: Number(formData.get('defaultTakeProfitPct')) / 100,
        newsFilterEnabled: formData.get('newsFilterEnabled') === 'on',
        eventAvoidanceLevel: Number(formData.get('eventAvoidanceLevel'))
      }
    });

    for (const group of ['A', 'B', 'C', 'D']) {
      const w = Number(formData.get(`weight_${group}`)) / 100;
      if (!isNaN(w) && w > 0) {
        await prisma.positionRule.update({
          where: { group: group as any },
          data: { maxWeightPercent: w }
        }).catch(e => console.log('Rule not found', e));
      }
    }
    
    revalidatePath('/settings');
    revalidatePath('/');
    revalidatePath('/portfolio');
  }

  async function resetSettings() {
    "use server"
    await prisma.portfolioSetting.update({
      where: { id: 'default-settings' },
      data: {
        totalCapitalKrw: 10000000,
        accountRiskPct: 0.007,
        defaultStopLossPct: 0.018,
        defaultTakeProfitPct: 0.03,
        newsFilterEnabled: true,
        eventAvoidanceLevel: 5
      }
    });
    // Hardcoded default rules mock reset
    const defaults: Record<string, number> = { A: 0.18, B: 0.15, C: 0.12, D: 0.08 };
    for (const [g, w] of Object.entries(defaults)) {
      await prisma.positionRule.update({
          where: { group: g as any },
          data: { maxWeightPercent: w }
      }).catch(e => null);
    }
    revalidatePath('/settings');
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 mb-12 max-w-4xl mx-auto">
      <div className="mb-6 flex space-x-4 items-center">
         <Link href="/" className="p-2 bg-muted/50 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
         </Link>
         <div>
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure Quantitative Engine Parameters</p>
         </div>
      </div>

      <div className="flex justify-end mb-4">
         <form action={resetSettings}>
             <button type="submit" className="text-sm flex items-center text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
               <RefreshCcw className="w-4 h-4 mr-2"/> Reset to Defaults
             </button>
         </form>
      </div>

      <form action={saveSettings} className="space-y-6">
         {/* 1. Core Capital Settings */}
         <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center space-x-2 text-primary mb-4 pb-4 border-b border-border/50">
               <Settings className="w-5 h-5"/>
               <h2 className="font-bold text-lg">Core Capital Framework</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Capital (KRW)</label>
                 <input 
                   name="totalCapitalKrw" 
                   type="number" 
                   defaultValue={settings.totalCapitalKrw} 
                   className="w-full bg-muted/50 border border-border rounded-lg p-3 text-lg font-bold outline-none focus:border-primary"
                 />
                 <p className="text-xs text-muted-foreground">총 투자 운용 자금</p>
               </div>
               
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account Risk % per Trade</label>
                 <div className="relative">
                   <input 
                     name="accountRiskPct" 
                     type="number" 
                     step="0.01"
                     defaultValue={settings.accountRiskPct * 100} 
                     className="w-full bg-muted/50 border border-border rounded-lg p-3 text-lg font-bold outline-none focus:border-primary pr-8"
                   />
                   <span className="absolute right-4 top-3.5 text-muted-foreground">%</span>
                 </div>
                 <p className="text-xs text-muted-foreground">건당 감내할 최대 손실 (기본 0.7%)</p>
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Default Stop Loss %</label>
                 <div className="relative">
                   <input 
                     name="defaultStopLossPct" 
                     type="number" 
                     step="0.01"
                     defaultValue={settings.defaultStopLossPct * 100} 
                     className="w-full bg-muted/50 border border-border rounded-lg p-3 text-lg font-bold outline-none focus:border-primary pr-8"
                   />
                   <span className="absolute right-4 top-3.5 text-muted-foreground">%</span>
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Default Take Profit %</label>
                 <div className="relative">
                   <input 
                     name="defaultTakeProfitPct" 
                     type="number" 
                     step="0.01"
                     defaultValue={settings.defaultTakeProfitPct * 100} 
                     className="w-full bg-muted/50 border border-border rounded-lg p-3 text-lg font-bold outline-none focus:border-primary pr-8"
                   />
                   <span className="absolute right-4 top-3.5 text-muted-foreground">%</span>
                 </div>
               </div>
            </div>
         </div>

         {/* 2. Strategy Engine Params */}
         <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center space-x-2 text-primary mb-4 pb-4 border-b border-border/50">
               <Newspaper className="w-5 h-5"/>
               <h2 className="font-bold text-lg">Engine Modifiers</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                   <span>Enable NLP News Risk Filter</span>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="newsFilterEnabled" defaultChecked={settings.newsFilterEnabled} className="sr-only peer" />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                   </label>
                 </label>
                 <p className="text-xs text-muted-foreground mt-2">비활성화 시 뉴스/센티먼트 스코어를 무시하고 가격 패턴만 분석합니다.</p>
               </div>
               
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Avoidance Strength</label>
                 <input 
                   name="eventAvoidanceLevel" 
                   type="range" 
                   min="1" max="10"
                   defaultValue={settings.eventAvoidanceLevel} 
                   className="w-full accent-primary"
                 />
                 <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 (Ignore)</span>
                    <span>10 (Avoid All)</span>
                 </div>
               </div>
            </div>
         </div>

         {/* 3. Group Limits */}
         <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center space-x-2 text-primary mb-4 pb-4 border-b border-border/50">
               <ShieldAlert className="w-5 h-5"/>
               <h2 className="font-bold text-lg">Group Exposure Limits</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {['A', 'B', 'C', 'D'].map((grp) => {
                  const rule = rules.find(r => r.group === grp as any);
                  const defaultW = {"A": 18, "B": 15, "C": 12, "D": 8}[grp] || 10;
                  const currentW = rule ? rule.maxWeightPercent * 100 : defaultW;

                  return (
                    <div key={grp} className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Group {grp}</label>
                      <div className="relative">
                        <input 
                          name={`weight_${grp}`}
                          type="number" 
                          step="0.1"
                          defaultValue={currentW} 
                          className="w-full bg-muted/50 border border-border rounded-lg p-2 text-center font-bold outline-none focus:border-primary pr-6"
                        />
                        <span className="absolute right-4 top-2.5 text-muted-foreground text-sm">%</span>
                      </div>
                    </div>
                  );
               })}
            </div>
         </div>

         <button type="submit" className="w-full bg-primary text-primary-foreground font-bold text-lg p-4 rounded-xl hover:bg-primary/90 transition-colors flex justify-center items-center shadow-lg shadow-primary/20">
            <Save className="w-5 h-5 mr-2"/> Apply & Recalculate Engines
         </button>
      </form>

    </div>
  );
}
