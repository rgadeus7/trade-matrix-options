import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Trade Matrix Options Collector (Next.js)'
  });
}
