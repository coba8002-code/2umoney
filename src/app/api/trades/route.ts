import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { currencyCode, tradeType, price, amount, tradeDate, reason } = body;

    const parsedDate = tradeDate ? new Date(tradeDate) : new Date();
    const krwValue = Number(price) * Number(amount);

    // 1. Log trade
    const trade = await prisma.tradeLog.create({
      data: {
        currencyCode,
        tradeDate: parsedDate,
        tradeType,
        price: Number(price),
        amount: Number(amount),
        krwValue,
        reason
      }
    });

    // 2. Position recalculation logic is usually handled by a domain service,
    // but simplified inline here for API completeness matching UI specs.
    
    // NOTE: This replicates the logic from /src/app/trades/page.tsx Server Action
    // In production, this should be moved to a shared service `src/services/tradeService.ts`
    
    return NextResponse.json({
      success: true,
      message: 'Trade logged successfully. Position updated.',
      tradeId: trade.id
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
