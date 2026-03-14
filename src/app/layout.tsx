import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { LayoutDashboard, Wallet, Repeat, Settings, AreaChart, Smartphone, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: '2UMoney OS - AI Quant Dashboard',
  description: 'Advanced quantitative engine for FX Toss Trading',
};

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet },
  { name: 'Toss Execution', href: '/toss', icon: Smartphone },
  { name: 'Trade Logs', href: '/trades', icon: Repeat },
  { name: 'Backtest', href: '/backtest', icon: AreaChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={cn(inter.className, outfit.variable, "bg-background text-foreground flex antialiased selection:bg-primary/30")}>
        
        {/* Global Sidebar Navigation (Glassmorphism) */}
        <aside className="w-64 glassmorphism border-r min-h-screen flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-all">
          <div className="h-20 flex items-center px-6 border-b border-white/5 font-extrabold text-2xl tracking-tighter space-x-2">
            <div className="bg-primary/10 p-2 rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <span className="text-gradient">2umoney</span>
          </div>
          <nav className="flex-1 py-8 px-4 space-y-1.5 font-['Outfit']">
            {navigation.map((item) => (
              <Link 
                key={item.name} 
                href={item.href}
                className="group flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground hover:shadow-sm hover:border-white/10 border border-transparent transition-all duration-300 ease-in-out relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <item.icon className="w-5 h-5 shrink-0 group-hover:scale-110 group-hover:text-primary transition-transform duration-300 relative z-10" />
                <span className="relative z-10">{item.name}</span>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-white/5 mt-auto">
             <div className="glassmorphism rounded-xl p-4 text-xs text-muted-foreground relative overflow-hidden group hover:border-primary/30 transition-colors">
               <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="font-[Outfit] font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400 mb-2 relative z-10 tracking-widest uppercase text-[10px]">System Status</div>
               <div className="flex justify-between items-center mt-1 mb-1.5 relative z-10">
                 <span>Engines</span>
                 <div className="flex items-center space-x-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                   <span className="text-emerald-400 font-semibold tracking-wide">ONLINE</span>
                 </div>
               </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 ml-64 min-h-screen h-full overflow-y-auto bg-gradient-to-br from-background to-background/95">
           <div className="max-w-7xl mx-auto w-full animate-in fade-in duration-700 pb-12">
             {children}
           </div>
        </main>
        
      </body>
    </html>

  );
}
