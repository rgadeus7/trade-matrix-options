import { NextResponse } from 'next/server';
import { verifyApiKey, createUnauthorizedResponse } from '../../../lib/auth.js';
import { OptionsDatabase } from '../../../lib/database.js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Verify API key authentication
    if (!verifyApiKey(request)) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit')) || 100;

    if (!symbol) {
      return NextResponse.json({
        success: false,
        error: 'Symbol parameter is required'
      }, { status: 400 });
    }

    let data;
    if (startDate) {
      // Get aggregated data by date range (startDate only or startDate + endDate)
      const endDateParam = endDate || '9999-12-31'; // Use far future date if no endDate
      
      // Special case: if symbol is SPX, also query SPXW
      if (symbol.toUpperCase() === 'SPX') {
        const symbols = ['SPX', 'SPXW'];
        data = await OptionsDatabase.getAggregatedOptionsDataMultiSymbol(symbols, startDate, endDateParam);
      } else {
        data = await OptionsDatabase.getAggregatedOptionsData(symbol, startDate, endDateParam);
      }
    } else {
      // Get latest data
      data = await OptionsDatabase.getLatestOptionsData(symbol, limit);
    }

    // Determine which symbols were actually queried
    const queriedSymbols = symbol.toUpperCase() === 'SPX' && startDate ? ['SPX', 'SPXW'] : [symbol];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      parameters: {
        symbol,
        queried_symbols: queriedSymbols,
        startDate,
        endDate,
        limit
      },
      summary: {
        total_records: data.length,
        data_type: startDate ? 'aggregated_by_strike' : 'latest_options'
      },
      data: data
    });

  } catch (error) {
    console.error('❌ Database query failed:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
