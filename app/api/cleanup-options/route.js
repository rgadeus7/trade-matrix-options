import { NextResponse } from 'next/server';
import { verifyApiKey, createUnauthorizedResponse } from '../../../lib/auth.js';
import { OptionsDatabase } from '../../../lib/database.js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Verify API key authentication
    if (!verifyApiKey(request)) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    console.log('🧹 Options cleanup request received:', body);
    
    const {
      symbols = null, // Array of symbols to clean up, or null for all symbols
      keepHours = 0.5, // Number of hours of recent data to keep (default: 0.5 = 30 minutes)
      dryRun = false // If true, only show what would be deleted
    } = body;

    // Validate parameters
    if (keepHours <= 0) {
      return NextResponse.json({
        success: false,
        error: 'keepHours must be a positive number',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const startTime = Date.now();
    let result;

    if (symbols && Array.isArray(symbols) && symbols.length > 0) {
      // Clean up specific symbols
      console.log(`🧹 Cleaning up symbols: ${symbols.join(', ')} (keeping last ${keepHours} hours)`);
      result = await OptionsDatabase.cleanupOldOptionsData(symbols, keepHours, dryRun);
    } else {
      // Clean up all symbols
      console.log(`🧹 Cleaning up all symbols (keeping last ${keepHours} hours)`);
      result = await OptionsDatabase.cleanupAllOldOptionsData(keepHours, dryRun);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Prepare response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      parameters: {
        symbols: symbols,
        keepHours: keepHours,
        dryRun: dryRun
      },
      result: result
    };

    console.log(`✅ Cleanup completed in ${duration}ms: ${result.totalDeleted} records ${dryRun ? 'would be deleted' : 'deleted'}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    // Verify API key authentication
    if (!verifyApiKey(request)) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const keepHours = parseFloat(searchParams.get('keepHours')) || 0.5;
    const dryRun = searchParams.get('dryRun') === 'true';
    const symbolsParam = searchParams.get('symbols');
    
    const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim()) : null;

    // Validate parameters
    if (keepHours <= 0) {
      return NextResponse.json({
        success: false,
        error: 'keepHours must be a positive number',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const startTime = Date.now();
    let result;

    if (symbols && symbols.length > 0) {
      // Clean up specific symbols
      console.log(`🧹 GET: Cleaning up symbols: ${symbols.join(', ')} (keeping last ${keepHours} hours)`);
      result = await OptionsDatabase.cleanupOldOptionsData(symbols, keepHours, dryRun);
    } else {
      // Clean up all symbols
      console.log(`🧹 GET: Cleaning up all symbols (keeping last ${keepHours} hours)`);
      result = await OptionsDatabase.cleanupAllOldOptionsData(keepHours, dryRun);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Prepare response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      parameters: {
        symbols: symbols,
        keepHours: keepHours,
        dryRun: dryRun
      },
      result: result
    };

    console.log(`✅ GET Cleanup completed in ${duration}ms: ${result.totalDeleted} records ${dryRun ? 'would be deleted' : 'deleted'}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ GET Cleanup failed:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
