"use client";

import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChartProps {
  data: any[];
}

export function CurrencyCharts({ data }: ChartProps) {
  const [timeframe, setTimeframe] = useState<'1Y'|'6M'|'1M'|'1W'>('6M');

  // Filter data based on timeframe selection 
  // (Assuming data comes sorted chronologically from oldest to newest)
  const filteredData = data.filter(d => {
    const date = new Date(d.date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (timeframe === '1W') return diffDays <= 7;
    if (timeframe === '1M') return diffDays <= 30;
    if (timeframe === '6M') return diffDays <= 180;
    return true; // 1Y
  });

  // Calculate min/max for Y axis to give the chart some padding
  const prices = filteredData.map(d => d.close);
  const minPrice = prices.length ? Math.min(...prices) * 0.99 : 0;
  const maxPrice = prices.length ? Math.max(...prices) * 1.01 : 100;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Historical Price Charts</h3>
        <div className="flex bg-muted/50 p-1 rounded-lg">
          {['1W', '1M', '6M', '1Y'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf as any)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
                timeframe === tf ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
               dataKey="date" 
               tickFormatter={(val) => format(new Date(val), 'MMM dd')}
               stroke="hsl(var(--muted-foreground))"
               fontSize={12}
               tickMargin={10}
               minTickGap={30}
            />
            <YAxis 
               domain={[minPrice, maxPrice]}
               tickFormatter={(val) => val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
               stroke="hsl(var(--muted-foreground))"
               fontSize={12}
               width={60}
               orientation="right"
               tickMargin={10}
               axisLine={false}
               tickLine={false}
            />
            <Tooltip 
               contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
               labelFormatter={(val) => format(new Date(val), 'yyyy-MM-dd')}
            />
            <Area 
               type="monotone" 
               dataKey="close" 
               stroke="hsl(var(--primary))" 
               fillOpacity={1} 
               fill="url(#colorClose)" 
               strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
