#!/usr/bin/env node

/**
 * Standalone Options Data Cleanup Script
 * 
 * This script allows manual cleanup of old options data from the database.
 * It can clean up data for specific symbols or all symbols.
 * 
 * Usage:
 *   node cleanup-options-data.js [options]
 * 
 * Options:
 *   --symbols <symbol1,symbol2,...>  Clean up specific symbols (comma-separated)
 *   --keep-hours <hours>             Number of hours of recent data to keep (default: 0.5 = 30 minutes)
 *   --dry-run                        Show what would be deleted without actually deleting
 *   --all                            Clean up all symbols in the database
 *   --help                           Show this help message
 * 
 * Examples:
 *   node cleanup-options-data.js --symbols AAPL,TSLA --keep-hours 12
 *   node cleanup-options-data.js --all --dry-run
 *   node cleanup-options-data.js --symbols $SPX.X --keep-hours 48
 */

import { OptionsDatabase } from './lib/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    symbols: null,
    keepHours: 0.5,
    dryRun: false,
    all: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--symbols':
        if (i + 1 < args.length) {
          options.symbols = args[i + 1].split(',').map(s => s.trim());
          i++; // Skip next argument as it's the value
        } else {
          console.error('❌ --symbols requires a comma-separated list of symbols');
          process.exit(1);
        }
        break;
        
      case '--keep-hours':
        if (i + 1 < args.length) {
          const hours = parseInt(args[i + 1]);
          if (isNaN(hours) || hours < 1) {
            console.error('❌ --keep-hours must be a positive number');
            process.exit(1);
          }
          options.keepHours = hours;
          i++; // Skip next argument as it's the value
        } else {
          console.error('❌ --keep-hours requires a number');
          process.exit(1);
        }
        break;
        
      case '--dry-run':
        options.dryRun = true;
        break;
        
      case '--all':
        options.all = true;
        break;
        
      case '--help':
        options.help = true;
        break;
        
      default:
        console.error(`❌ Unknown argument: ${arg}`);
        console.error('Use --help for usage information');
        process.exit(1);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🧹 Options Data Cleanup Script

This script allows manual cleanup of old options data from the database.

Usage:
  node cleanup-options-data.js [options]

Options:
  --symbols <symbol1,symbol2,...>  Clean up specific symbols (comma-separated)
  --keep-hours <hours>             Number of hours of recent data to keep (default: 0.5 = 30 minutes)
  --dry-run                        Show what would be deleted without actually deleting
  --all                            Clean up all symbols in the database
  --help                           Show this help message

Examples:
  node cleanup-options-data.js --symbols AAPL,TSLA --keep-hours 0.5
  node cleanup-options-data.js --all --dry-run
  node cleanup-options-data.js --symbols $SPX.X --keep-hours 1

Notes:
  - The script uses the DATABASE_URL environment variable for connection
  - Dry run mode shows what would be deleted without making changes
  - All operations are logged with detailed information
  - The script maintains data integrity with database transactions
`);
}

async function main() {
  const options = parseArguments();
  
  if (options.help) {
    showHelp();
    return;
  }

  // Validate arguments
  if (!options.all && !options.symbols) {
    console.error('❌ You must specify either --symbols or --all');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  if (options.all && options.symbols) {
    console.error('❌ Cannot specify both --all and --symbols');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  console.log('🧹 Options Data Cleanup Script');
  console.log('================================');
  console.log(`📊 Mode: ${options.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be made)'}`);
  console.log(`⏰ Keep hours: ${options.keepHours}`);
  
  if (options.all) {
    console.log('🎯 Target: All symbols in database');
  } else {
    console.log(`🎯 Target symbols: ${options.symbols.join(', ')}`);
  }
  console.log('---');

  try {
    // Test database connection first
    console.log('🔌 Testing database connection...');
    const connectionTest = await OptionsDatabase.testConnection();
    if (!connectionTest) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }
    console.log('✅ Database connection successful');
    console.log('---');

    let result;
    
    if (options.all) {
      console.log('🧹 Starting cleanup for all symbols...');
      result = await OptionsDatabase.cleanupAllOldOptionsData(options.keepHours, options.dryRun);
    } else {
      console.log(`🧹 Starting cleanup for symbols: ${options.symbols.join(', ')}`);
      result = await OptionsDatabase.cleanupOldOptionsData(options.symbols, options.keepHours, options.dryRun);
    }

    // Display results
    console.log('---');
    console.log('📊 CLEANUP RESULTS');
    console.log('==================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`🔍 Dry Run: ${result.dryRun}`);
    console.log(`⏰ Cutoff Time: ${result.cutoffTime.toISOString()}`);
    console.log(`⏱️  Keep Hours: ${result.keepHours}`);
    console.log(`📈 Symbols Processed: ${result.symbolsProcessed}`);
    console.log(`🗑️  Total Deleted: ${result.totalDeleted}`);
    
    if (result.results && result.results.length > 0) {
      console.log('\n📋 Per-Symbol Results:');
      result.results.forEach(symbolResult => {
        const action = symbolResult.action === 'would_delete' ? 'WOULD DELETE' : 
                      symbolResult.action === 'deleted' ? 'DELETED' : 'NO ACTION';
        const records = symbolResult.deletedRecords || symbolResult.oldRecords || 0;
        console.log(`  ${symbolResult.symbol}: ${action} ${records} records (kept ${symbolResult.keptRecords})`);
      });
    }

    if (options.dryRun) {
      console.log('\n💡 This was a dry run. No data was actually deleted.');
      console.log('   Run without --dry-run to perform the actual cleanup.');
    } else {
      console.log('\n✅ Cleanup completed successfully!');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.error('❌ Error details:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
