# Options Collection Cron Jobs

This directory contains the GitHub Actions workflow and configuration for automated options data collection.

## 📁 Files

- `workflows/daily-options.yml` - GitHub Actions workflow for scheduled options collection
- `scripts/run-options-cron.js` - Node.js script that handles the API calls
- `config/options-config.json` - JSON configuration file with collection parameters

## ⚙️ Configuration

### JSON Configuration File

Edit `.github/config/options-config.json` to manage your collection parameters:

```json
{
  "configurations": [
    {
      "name": "SPX Monthly Options",
      "description": "Daily SPX monthly options collection",
      "enabled": true,
      "parameters": {
        "symbols": ["$SPX.X"],
        "topRecords": 2,
        "streamDuration": 1000,
        "expirationFilter": "Monthly",
        "saveToDatabase": true
      }
    }
  ]
}
```

### Configuration Properties

- `name`: Unique identifier for the configuration
- `description`: Human-readable description
- `enabled`: Boolean to enable/disable this configuration
- `parameters`: Collection parameters sent to the API

### Parameters

- `symbols`: Array of symbols to collect (e.g., `["$SPX.X", "$SPXW.X"]`)
- `topRecords`: Number of records to collect per symbol
- `streamDuration`: Duration in milliseconds for data streaming
- `expirationFilter`: Filter by expiration type ("Monthly", "Weekly", or null for all)
- `saveToDatabase`: Boolean to save data to database

## 🚀 Usage

### Automatic Execution

The workflow runs automatically every weekday at 9:00 AM EST (2:00 PM UTC) and processes all enabled configurations.

### Manual Execution

1. **Via GitHub Actions**: Go to Actions tab → "Daily SPX Options Collection" → "Run workflow"
2. **Via npm scripts**:
   ```bash
   npm run cron:daily                    # Run all enabled daily configurations
   npm run cron:daily "SPX Monthly"      # Run specific configuration
   npm run cron:config daily "SPX"       # Run configurations matching "SPX"
   ```

### Command Line Usage

```bash
# Run all enabled configurations for daily job
node .github/scripts/run-options-cron.js daily

# Run specific configuration by name
node .github/scripts/run-options-cron.js daily "SPX Monthly Options"

# Run configurations matching a pattern
node .github/scripts/run-options-cron.js daily "SPX"
```

## 🔧 Setup

### Required GitHub Secrets

Add these secrets to your repository settings:

- `OPTIONS_API_KEY`: API key for the options collection endpoint

### Environment Variables

The script automatically uses the deployed endpoint: `https://trade-matrix-options.vercel.app/api/collect-options`

## 📊 Output

The script outputs detailed information for each configuration:

```json
{
  "success": true,
  "timestamp": "2025-09-15T00:26:36.663Z",
  "duration_ms": 20794,
  "parameters": {
    "symbols": ["$SPX.X"],
    "topRecords": 2,
    "streamDuration": 1000,
    "expirationFilter": "Monthly"
  },
  "summary": {
    "total_records": 4,
    "symbols_processed": 1,
    "expirations_per_symbol": 2,
    "database_processed": 4,
    "database_inserted": 0,
    "database_updated": 4
  }
}
```

## 🎯 Benefits

- **Flexible Configuration**: Easy to add/modify collection parameters via JSON
- **Selective Execution**: Enable/disable specific configurations
- **Pattern Matching**: Run configurations by name pattern
- **Detailed Logging**: Comprehensive output for monitoring and debugging
- **Error Handling**: Continues processing other configurations if one fails
