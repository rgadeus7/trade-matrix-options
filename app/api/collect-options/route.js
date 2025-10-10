import { NextResponse } from 'next/server';
import SimpleOptionsCollector from '../../../simpleOptionsCollector.js';
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
    // console.log('🚀 Options collection request received:', body);
    
    const {
      symbols = ['$SPX.X', '$SPXW.X'],
      topRecords = 3,
      streamDuration = 2000,
      expirationFilter = null, // null = all, 'Weekly' = weekly only, 'Monthly' = monthly only
      saveToDatabase = false, // Whether to save data to database
      cleanupOldData = true, // Whether to clean up old data before inserting new data
      keepHours = 0.5 // Number of hours of recent data to keep (default: 0.5 = 30 minutes)
    } = body;

    // Create collector instance with custom parameters
    const collector = new SimpleOptionsCollector();
    
    // Override default settings if provided
    if (symbols) collector.symbols = Array.isArray(symbols) ? symbols : symbols.split(',').map(s => s.trim());
    if (topRecords) collector.topRecords = parseInt(topRecords);
    if (streamDuration) collector.streamDuration = parseInt(streamDuration);
    if (expirationFilter) collector.expirationFilter = expirationFilter;

    // console.log(`📋 Collection parameters:`, {
    //   symbols: collector.symbols,
    //   topRecords: collector.topRecords,
    //   streamDuration: collector.streamDuration,
    //   expirationFilter: collector.expirationFilter
    // });

    // Start collection
    const startTime = Date.now();
    const result = await collector.collect();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Clean up old data if requested
    let cleanupResult = null;
    if (saveToDatabase && cleanupOldData) {
      // Normalize symbols for cleanup (remove $ and .X suffix to match database storage)
      const normalizedSymbols = collector.symbols.map(symbol => {
        return symbol.replace(/^\$/, '').replace(/\.X$/, '');
      });
      
      console.log(`🧹 Cleaning up old data for symbols: ${collector.symbols.join(', ')} (normalized: ${normalizedSymbols.join(', ')}) (keeping last ${keepHours} hours)...`);
      try {
        cleanupResult = await OptionsDatabase.cleanupOldOptionsData(normalizedSymbols, keepHours, false);
        console.log(`✅ Cleanup completed: ${cleanupResult.totalDeleted} old records deleted`);
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
        console.error('❌ Cleanup error details:', cleanupError);
        // Continue with data insertion even if cleanup fails
      }
    }

    // Save to database if requested
    let databaseResult = null;
    if (saveToDatabase && result.length > 0) {
      console.log(`💾 Saving ${result.length} records to database...`);
      try {
        databaseResult = await OptionsDatabase.insertOptionsData(result);
        console.log(`✅ Database save completed: ${databaseResult.totalProcessed} records processed (${databaseResult.insertedCount} inserted, ${databaseResult.updatedCount} updated)`);
      } catch (dbError) {
        console.error('❌ Database save failed:', dbError.message);
        console.error('❌ Database error details:', dbError);
        // Continue with response even if database save fails
      }
    } else if (saveToDatabase && result.length === 0) {
      console.log('⚠️  No data to save to database (result array is empty)');
    }

    // Prepare response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      parameters: {
        symbols: collector.symbols,
        topRecords: collector.topRecords,
        streamDuration: collector.streamDuration,
        expirationFilter: collector.expirationFilter,
        cleanupOldData: cleanupOldData,
        keepHours: keepHours
      },
      summary: {
        total_records: result.length,
        symbols_processed: collector.symbols.length,
        expirations_per_symbol: collector.topRecords,
        database_processed: databaseResult ? databaseResult.totalProcessed : 0,
        database_inserted: databaseResult ? databaseResult.insertedCount : 0,
        database_updated: databaseResult ? databaseResult.updatedCount : 0,
        cleanup_deleted: cleanupResult ? cleanupResult.totalDeleted : 0
      },
      data: result,
      database: databaseResult,
      cleanup: cleanupResult
    };

    // console.log(`✅ Collection completed in ${duration}ms with ${result.length} records`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Collection failed:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
