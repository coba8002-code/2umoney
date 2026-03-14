"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format } from 'date-fns';

interface EquityChartProps {
  data: any[];
}

export function EquityChart({ data }: EquityChartProps) {
  const minEquity = Math.min(...data.map(d => d.withNews), ...data.map(d => d.withoutNews));
  const maxEquity = Math.max(...data.map(d => d.withNews), ...data.map(d => d.withoutNews));
  
  const yMin = Math.floor(minEquity * 0.95);
  const yMax = Math.ceil(maxEquity * 1.05);

  return (
    <div className="h-80 w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorWithNews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorWithoutNews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis 
             dataKey="date" 
             tickFormatter={(val) => format(new Date(val), 'MMM yyyy')}
             stroke="hsl(var(--muted-foreground))"
             fontSize={12}
             tickMargin={10}
             minTickGap={40}
          />
          <YAxis 
             domain={[yMin, yMax]}
             tickFormatter={(val) => val.toLocaleString()}
             stroke="hsl(var(--muted-foreground))"
             fontSize={12}
             width={80}
             orientation="right"
             axisLine={false}
             tickLine={false}
          />
          <Tooltip 
             contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
             labelFormatter={(val) => format(new Date(val), 'yyyy-MM-dd')}
             formatter={(value: number) => [`${value.toLocaleString()} KRW`, 'Equity']}
          />
          <Legend verticalAlign="top" height={36}/>
          <Area 
             type="monotone" 
             name="With News Filter (Target)"
             dataKey="withNews" 
             stroke="hsl(var(--primary))" 
             fillOpacity={1} 
             fill="url(#colorWithNews)" 
             strokeWidth={3}
          />
          <Area 
             type="monotone" 
             name="Without News Filter (Baseline)"
             dataKey="withoutNews" 
             stroke="hsl(var(--muted-foreground))" 
             fillOpacity={1} 
             fill="url(#colorWithoutNews)" 
             strokeWidth={2}
             strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
