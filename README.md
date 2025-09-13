# Trade Matrix Options

A Node.js tool for streaming TradeStation options chain data and saving it to JSON files.

## Features

- 🔐 **Secure Authentication**: Uses TradeStation OAuth2 with automatic token refresh
- 📡 **Real-time Streaming**: Streams options chain data for configurable duration
- 💾 **JSON Output**: Saves streamed data to timestamped JSON files
- ⚙️ **Configurable**: Customizable symbol, duration, and output directory
- 🧪 **Connection Testing**: Built-in connection and authentication testing
- 📅 **Daily Options Job**: Automated SPX options expiration and strike data collection
- 🎯 **ATM Focus**: Calculates 5 at-the-money strikes around current SPX price
- 🗄️ **Database Integration**: Stores data in PostgreSQL for frontend access
- 🔄 **Backend Integration**: Follows same patterns as trade-matrix-backend workflow

## Quick Start

### 1. Setup

Run the automated setup script:

```bash
cd trade-matrix-options
npm run setup
```

This will:
- Install dependencies
- Create `.env` file from `env.example`
- Create output directory
- Set up the project structure

### 2. Configure Environment

Edit the `.env` file with your TradeStation API credentials:

```bash
# TradeStation API Configuration
TRADESTATION_REFRESH_TOKEN=your_refresh_token_here
TRADESTATION_CLIENT_ID=your_client_id_here
TRADESTATION_CLIENT_SECRET=your_client_secret_here

# Options Configuration
DEFAULT_SYMBOL=AAPL
STREAM_DURATION_SECONDS=10
OUTPUT_DIRECTORY=./output
```

### 3. Test Connection

Before streaming, test your API connection:

```bash
npm test
```

### 4. Test SPX Options Expirations

Test the SPX options expiration service:

```bash
npm run test-expirations
```

### 5. Run Daily Options Job

Execute the daily SPX options data collection:

```bash
npm run daily-options
```

### 6. Stream Options Data

Stream options chain data for the default symbol ($SPX.X) for 10 seconds:

```bash
npm start
```

Or run directly:

```bash
node stream-options.js
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRADESTATION_REFRESH_TOKEN` | Your TradeStation refresh token | Required |
| `TRADESTATION_CLIENT_ID` | Your TradeStation client ID | Required |
| `TRADESTATION_CLIENT_SECRET` | Your TradeStation client secret | Required |
| `DEFAULT_SYMBOL` | Symbol to stream options for | `AAPL` |
| `STREAM_DURATION_SECONDS` | How long to stream data | `10` |
| `OUTPUT_DIRECTORY` | Where to save JSON files | `./output` |

### Custom Symbol

To stream options for a different symbol, modify the `DEFAULT_SYMBOL` in your `.env` file:

```bash
DEFAULT_SYMBOL=SPY
```

## Output Format

The tool creates JSON files with the following structure:

```json
{
  "metadata": {
    "symbol": "AAPL",
    "streamDuration": 10,
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:30:10.000Z",
    "totalRecords": 150,
    "apiEndpoint": "https://api.tradestation.com/v3/marketdata/stream/options/chains/AAPL"
  },
  "data": [
    {
      "timestamp": "2024-01-15T10:30:00.123Z",
      "data": {
        // Raw options chain data from TradeStation API
      }
    }
    // ... more records
  ]
}
```

## API Endpoint

This tool streams data from the TradeStation Options Chain API:

```
https://api.tradestation.com/v3/marketdata/stream/options/chains/{SYMBOL}
```

## Workflow Patterns

This tool follows the same patterns as the `trade-matrix-backend` workflow:

### Authentication Flow
1. **Token Validation**: Uses `TokenManager.getInstance()` singleton pattern
2. **Automatic Refresh**: Tokens are automatically refreshed when expired
3. **Error Handling**: Comprehensive error handling for authentication failures
4. **Logging**: Consistent logging patterns matching the backend

### Execution Flow
1. **Token Validation**: `ensureValidToken()` before any API operation
2. **API Call**: Proper headers with `Authorization: Bearer {token}`
3. **Data Processing**: Stream processing with progress logging
4. **Error Handling**: Detailed error logging and graceful failure handling

### Data Management
- **Streaming**: Real-time data streaming with configurable duration
- **JSON Output**: Structured data with metadata and timestamps
- **File Management**: Automatic output directory creation and timestamped files

## Authentication

The tool uses TradeStation's OAuth2 authentication with:

- **Refresh Token**: Long-lived token for obtaining access tokens
- **Client Credentials**: Your TradeStation API client ID and secret
- **Automatic Refresh**: Tokens are automatically refreshed when expired
- **Error Handling**: Comprehensive error handling for authentication failures

## Troubleshooting

### Common Issues

1. **"No refresh token available"**
   - Ensure `TRADESTATION_REFRESH_TOKEN` is set in your `.env` file
   - Verify the refresh token is valid and not expired

2. **"Failed to obtain valid TradeStation token"**
   - Check your client ID and secret are correct
   - Verify the refresh token is still valid
   - Run `npm test` to diagnose authentication issues

3. **"Stream error"**
   - Check your internet connection
   - Verify the symbol is valid
   - Ensure you have proper API permissions

### Getting TradeStation API Credentials

1. Log into your TradeStation account
2. Go to API Management
3. Create a new API application
4. Note your Client ID and Client Secret
5. Generate a refresh token for your application

## Daily SPX Options Job

The daily options job collects SPX options data focusing on:

### **Expiration Types:**
- **Weekly**: 7-14 days to expiration
- **Monthly**: 15-45 days to expiration  
- **Quarterly**: 60-120 days to expiration

### **Strike Focus:**
- **5 At-The-Money Strikes**: Calculated around current SPX price
- **5-Point Intervals**: Standard SPX strike spacing
- **Current Price Based**: Automatically adjusts to market price

### **Database Storage:**
- **options_expirations**: Stores expiration dates and types
- **options_strikes**: Stores strike prices and ATM calculations
- **options_data_summary**: Quick access summary for frontend

### **Usage:**
```bash
# Test the job (no database save)
npm run test-options

# Run the full job (saves to database)
npm run daily-options

# Test expirations only
npm run test-expirations
```

## Backend Integration

To integrate with your existing `trade-matrix-backend`:

### **1. Add to Daily Cron Job:**
```javascript
// In your trade-matrix-backend/app/api/cron/daily/route.ts
import BackendIntegration from '../path/to/backend-integration.js';

const optionsIntegration = new BackendIntegration();
const optionsResult = await optionsIntegration.executeOptionsJob();
```

### **2. Create Frontend API Endpoint:**
```javascript
// In your trade-matrix-backend/app/api/options/latest/route.ts
import BackendIntegration from '../path/to/backend-integration.js';

export async function GET(request) {
  const optionsIntegration = new BackendIntegration();
  const result = await optionsIntegration.getLatestOptionsData();
  return NextResponse.json(result);
}
```

### **3. Database Setup:**
Run the SQL schema in your database:
```bash
psql $DATABASE_URL -f database/options-schema.sql
```

## Scripts

- `npm run setup` - Automated setup (install dependencies, create .env, setup directories)
- `npm start` - Stream options data for the configured symbol
- `npm test` - Test API connection and authentication
- `npm run test-expirations` - Test SPX options expiration service
- `npm run test-options` - Test daily options job (no database save)
- `npm run daily-options` - Run daily SPX options data collection
- `node stream-options.js` - Run the streaming script directly
- `node test-connection.js` - Test connection directly

## Dependencies

- **axios**: HTTP client for API requests
- **dotenv**: Environment variable management

## License

MIT
