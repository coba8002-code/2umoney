import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { LayoutDashboard, Wallet, Repeat, Settings, AreaChart, Smartphone, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '2UMoney - Personal FX Trading OS',
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
    <html lang="en" className="dark">
      <body className={cn(inter.className, "bg-background text-foreground flex")}>
        
        {/* Global Sidebar Navigation */}
        <aside className="w-64 border-r border-border min-h-screen bg-card flex flex-col fixed left-0 top-0 bottom-0 z-50">
          <div className="h-16 flex items-center px-6 border-b border-border font-bold text-xl text-primary space-x-2">
            <Activity className="w-6 h-6" />
            <span>2umoney</span>
          </div>
          <nav className="flex-1 py-6 px-4 space-y-1">
            {navigation.map((item) => (
              <Link 
                key={item.name} 
                href={item.href}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-border mt-auto">
             <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
               <div className="font-bold text-primary mb-1">System Status</div>
               <div className="flex justify-between mt-1 mb-1">Engines: <span className="text-green-500 font-bold">Online</span></div>
               <div className="flex justify-between">DB Sync: <span className="text-green-500 font-bold">Latest</span></div>
             </div>
          </div>
        </aside>

        {/* Main Content Area (offset by 64px = 16rem = w-64) */}
        <main className="flex-1 ml-64 min-h-screen h-full overflow-y-auto">
           {children}
        </main>
        
      </body>
    </html>
  );
}
