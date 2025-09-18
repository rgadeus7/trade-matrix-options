# Options Data Cleanup System

This document describes the options data cleanup system that automatically removes old records to maintain only recent point-in-time data.

## 🎯 Overview

The cleanup system ensures that your options database contains only the most recent data for each symbol, preventing the database from growing indefinitely with outdated records. This is particularly important for options data since it changes frequently throughout the trading day.

## 🔧 How It Works

### Automatic Cleanup
- **Triggered**: Every time new options data is collected via the `/api/collect-options` endpoint
- **Process**: Before inserting new data, old records are deleted based on the configured retention period
- **Configurable**: Each configuration can specify different retention periods

### Manual Cleanup
- **Standalone Script**: `cleanup-options-data.js` for manual cleanup operations
- **API Endpoint**: `/api/cleanup-options` for programmatic cleanup
- **Flexible**: Can clean specific symbols or all symbols

## ⚙️ Configuration

### Configuration File (`options-config.json`)

Each configuration now includes cleanup parameters:

```json
{
  "id": "index-monthly",
  "name": "All Index Options Monthly Options",
  "parameters": {
    "symbols": ["$SPX.X", "$VIX.X", "GLD", "TLT"],
    "topRecords": 4,
    "streamDuration": 1000,
    "expirationFilter": "Monthly",
    "saveToDatabase": true,
    "cleanupOldData": true,
    "keepHours": 24
  }
}
```

#### Cleanup Parameters:
- `cleanupOldData`: Boolean - Whether to clean up old data (default: true)
- `keepHours`: Number - Hours of recent data to keep (default: 0.5 = 30 minutes)

### Different Retention Periods by Symbol Type:
- **All Options**: 30 minutes (options prices change frequently throughout trading day)
- **Customizable**: Each configuration can override the default retention period

## 🚀 Usage

### 1. Automatic Cleanup (Recommended)

The cleanup happens automatically when collecting options data. No additional action required.

```bash
# This will automatically clean up old data before inserting new data
npm run cron:index
npm run cron:stock
npm run cron:weekly
```

### 2. Manual Cleanup Script

#### Dry Run (See what would be deleted)
```bash
# See what would be deleted for all symbols
npm run cleanup:dry

# See what would be deleted for specific symbols
node cleanup-options-data.js --symbols AAPL,TSLA --keep-hours 12 --dry-run
```

#### Actual Cleanup
```bash
# Clean up all symbols (keep last 30 minutes)
npm run cleanup:all

# Clean up specific symbols (keep last 30 minutes)
node cleanup-options-data.js --symbols $SPX.X,$SPXW.X --keep-hours 0.5

# Clean up all symbols (keep last 1 hour)
node cleanup-options-data.js --all --keep-hours 1
```

#### Script Options:
- `--symbols <symbol1,symbol2,...>`: Clean specific symbols (comma-separated)
- `--keep-hours <hours>`: Number of hours of recent data to keep
- `--dry-run`: Show what would be deleted without actually deleting
- `--all`: Clean up all symbols in the database
- `--help`: Show help message

### 3. API Endpoint

#### POST `/api/cleanup-options`
```bash
curl -X POST https://trade-matrix-options.vercel.app/api/cleanup-options \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "TSLA"],
    "keepHours": 0.5,
    "dryRun": false
  }'
```

#### GET `/api/cleanup-options`
```bash
# Clean up all symbols
curl "https://trade-matrix-options.vercel.app/api/cleanup-options?keepHours=0.5&dryRun=false" \
  -H "x-api-key: YOUR_API_KEY"

# Clean up specific symbols
curl "https://trade-matrix-options.vercel.app/api/cleanup-options?symbols=AAPL,TSLA&keepHours=0.5&dryRun=true" \
  -H "x-api-key: YOUR_API_KEY"
```

## 📊 Monitoring

### Response Format

All cleanup operations return detailed information:

```json
{
  "success": true,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "duration_ms": 1250,
  "parameters": {
    "symbols": ["AAPL", "TSLA"],
    "keepHours": 0.5,
    "dryRun": false
  },
  "result": {
    "success": true,
    "dryRun": false,
    "cutoffTime": "2025-01-14T10:30:00.000Z",
    "keepHours": 0.5,
    "symbolsProcessed": 2,
    "totalDeleted": 150,
    "results": [
      {
        "symbol": "AAPL",
        "totalRecords": 200,
        "deletedRecords": 75,
        "keptRecords": 125,
        "action": "deleted"
      },
      {
        "symbol": "TSLA",
        "totalRecords": 180,
        "deletedRecords": 75,
        "keptRecords": 105,
        "action": "deleted"
      }
    ]
  }
}
```

### Logging

The system provides detailed console logging:
- 🧹 Cleanup start
- 🗑️ Records deleted per symbol
- ✅ Cleanup completion
- ❌ Error handling

## 🔒 Safety Features

### Dry Run Mode
Always test cleanup operations with `--dry-run` first:
```bash
node cleanup-options-data.js --all --dry-run
```

### Database Transactions
- All cleanup operations use database transactions
- If any part fails, all changes are rolled back
- No partial cleanup states

### Validation
- Parameter validation (positive numbers, valid symbols)
- Database connection testing before operations
- Detailed error messages

## 📈 Performance Considerations

### Indexing
The cleanup operations are optimized with proper database indexes:
- `idx_options_data_timestamp`: For efficient timestamp-based queries
- `idx_options_data_symbol`: For symbol-based filtering
- `idx_options_data_symbol_timestamp`: Composite index for combined queries

### Batch Operations
- Cleanup happens per symbol to minimize lock time
- Uses efficient SQL DELETE statements
- Minimal memory usage

## 🛠️ Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```
   ❌ Database connection failed
   ```
   - Check `DATABASE_URL` environment variable
   - Verify database server is accessible

2. **No Symbols Found**
   ```
   ℹ️ No symbols found in database
   ```
   - Database is empty or symbols don't exist
   - Check symbol names are correct

3. **Permission Denied**
   ```
   ❌ Cleanup failed: permission denied
   ```
   - Check database user permissions
   - Verify API key for endpoint access

### Debug Mode
Enable detailed logging by setting environment variable:
```bash
export DEBUG=options-cleanup
```

## 🔄 Integration with Existing Workflows

The cleanup system integrates seamlessly with existing GitHub Actions workflows:

- **Index Options**: Runs every 30 minutes, keeps 30 minutes of data
- **Stock Options**: Runs every 2 hours, keeps 30 minutes of data  
- **Weekly Options**: Runs every 2 hours, keeps 30 minutes of data

No changes needed to existing workflows - cleanup happens automatically.

## 📝 Best Practices

1. **Start with Dry Runs**: Always test with `--dry-run` first
2. **Monitor Logs**: Check cleanup logs in GitHub Actions
3. **Adjust Retention**: Tune `keepHours` based on your needs
4. **Regular Monitoring**: Check database size and cleanup effectiveness
5. **Backup Strategy**: Consider backing up data before major cleanup operations

## 🎛️ Customization

### Custom Retention Periods
Modify `options-config.json` to set different retention periods:

```json
{
  "parameters": {
    "keepHours": 1  // Keep 1 hour of data
  }
}
```

### Disable Cleanup
To disable automatic cleanup for a configuration:

```json
{
  "parameters": {
    "cleanupOldData": false
  }
}
```

### Custom Cleanup Schedule
Create a separate GitHub Action for cleanup-only operations:

```yaml
name: Options Data Cleanup
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
```

This system ensures your options database remains efficient and contains only relevant, recent data while providing flexibility for different use cases and retention requirements.
