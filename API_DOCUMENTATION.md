# Trade Matrix Options Collector API

A clean, efficient API for collecting TradeStation options chain data.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy `env.example` to `.env` and configure your TradeStation API credentials.

3. **Start the API server:**
   ```bash
   npm start
   ```

4. **Test with Postman:**
   - **Health Check:** `GET http://localhost:8002/health`
   - **Collect Options:** `POST http://localhost:8002/api/collect-options`

## API Endpoints

### 1. Health Check
```
GET /api/health
```
Returns server status and timestamp. **No authentication required.**

### Authentication
All API endpoints (except health check) require authentication via `X-API-Key` header:

```bash
curl -H "X-API-Key: your_api_key_here" \
  -X POST https://your-domain.vercel.app/api/collect-options
```

### 2. Collect Options Data
```
POST /api/collect-options
```
**Requires authentication via X-API-Key header.**

**Request Body (JSON):**
```json
{
  "symbols": ["$SPX.X", "$SPXW.X"],
  "topRecords": 3,
  "streamDuration": 2000,
  "expirationFilter": "Monthly",
  "saveToDatabase": true
}
```

**Parameters:**
- `symbols` (optional): Array of symbols to collect. Default: `["$SPX.X", "$SPXW.X"]`
- `topRecords` (optional): Number of expirations per symbol. Default: `3`
- `streamDuration` (optional): Stream duration in milliseconds. Default: `2000` (2 seconds)
- `expirationFilter` (optional): Filter by expiration type. Options: `null` (all), `"Weekly"`, `"Monthly"`. Default: `null`
- `saveToDatabase` (optional): Whether to save data to PostgreSQL database. Default: `false`

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-09-13T16:15:00.000Z",
  "duration_ms": 15000,
  "parameters": {
    "symbols": ["$SPX.X", "$SPXW.X"],
    "topRecords": 3,
    "streamDuration": 2000
  },
  "summary": {
    "total_records": 24,
    "symbols_processed": 2,
    "expirations_per_symbol": 3
  },
  "data": [
    {
      "expiration_date": "2025-09-19T00:00:00Z",
      "strike": "6585",
      "expiration_type": "Monthly",
      "ask": "38.2",
      "bid": "37.8",
      "mid": "38.0",
      "close": "38.5",
      "high": "40.1",
      "last": "38.2",
      "low": "36.5",
      "open": "37.9",
      "previous_close": "38.0",
      "option_type": "Call",
      "symbol": "SPX 250919C6585",
      "timestamp": "2025-09-13T16:15:00.000Z"
    }
  ]
}
```

### 3. Collection Status
```
GET /api/collection-status
```
**Requires authentication via X-API-Key header.**
Returns information about previous collections and saved files.

### 4. Query Options Data
```
GET /api/options-data?symbol=AAPL&limit=100
```
**Requires authentication via X-API-Key header.**
Query options data from the database.

**Query Parameters:**
- `symbol` (required): Symbol to query (e.g., AAPL, $SPX.X)
- `startDate` (optional): Start date for date range query (ISO format). When provided, returns aggregated data grouped by expiration_date and strike
- `endDate` (optional): End date for date range query (ISO format)
- `limit` (optional): Maximum number of records to return. Default: 100

**Behavior:**
- **Without startDate**: Returns latest individual options data
- **With startDate**: Returns aggregated data grouped by expiration_date and strike, summing mid prices of call and put options for each strike
- **Special SPX handling**: When symbol is "SPX" and startDate is provided, automatically queries both SPX and SPXW symbols and combines the results

**Examples:**
- `GET /api/options-data?symbol=AAPL&limit=50` - Latest individual options
- `GET /api/options-data?symbol=AAPL&startDate=2025-09-01&endDate=2025-09-30` - Aggregated by strike
- `GET /api/options-data?symbol=TSLA&startDate=2025-09-20` - Aggregated TSLA data from 2025-09-20 onwards
- `GET /api/options-data?symbol=SPX&startDate=2025-09-20` - Aggregated SPX + SPXW data from 2025-09-20 onwards

**Aggregated Response Format (when startDate is provided):**

**Regular Symbol Example (TSLA):**
```json
{
  "success": true,
  "timestamp": "2025-09-13T16:15:00.000Z",
  "parameters": {
    "symbol": "TSLA",
    "queried_symbols": ["TSLA"],
    "startDate": "2025-09-20",
    "endDate": null,
    "limit": 100
  },
  "summary": {
    "total_records": 15,
    "data_type": "aggregated_by_strike"
  },
  "data": [
    {
      "expiration_date": "2025-09-26T00:00:00Z",
      "strike": "250.00",
      "total_mid_price": "12.50",
      "option_count": 2
    }
  ]
}
```

**SPX Symbol Example (automatically includes SPXW):**
```json
{
  "success": true,
  "timestamp": "2025-09-13T16:15:00.000Z",
  "parameters": {
    "symbol": "SPX",
    "queried_symbols": ["SPX", "SPXW"],
    "startDate": "2025-09-20",
    "endDate": null,
    "limit": 100
  },
  "summary": {
    "total_records": 25,
    "data_type": "aggregated_by_strike"
  },
  "data": [
    {
      "expiration_date": "2025-09-26T00:00:00Z",
      "strike": "6500.00",
      "total_mid_price": "45.75",
      "option_count": 4,
      "symbols": "SPX, SPXW"
    }
  ]
}
```

## Postman Examples

### Basic Collection
```json
POST http://localhost:8002/api/collect-options
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "symbols": ["$SPX.X", "$SPXW.X"],
  "topRecords": 3,
  "streamDuration": 2000
}
```

### Custom Collection
```json
POST http://localhost:8002/api/collect-options
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "symbols": ["$SPX.X"],
  "topRecords": 5,
  "streamDuration": 5000,
  "expirationFilter": "Weekly"
}
```

### Monthly Options Only
```json
POST http://localhost:8002/api/collect-options
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "symbols": ["$SPX.X", "$SPXW.X"],
  "expirationFilter": "Monthly"
}
```

### Weekly Options Only
```json
POST http://localhost:8002/api/collect-options
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "symbols": ["$SPX.X", "$SPXW.X"],
  "expirationFilter": "Weekly"
}
```

## Data Model

Each options record contains:
- `expiration_date`: Expiration date
- `strike`: Strike price
- `expiration_type`: Weekly or Monthly
- `ask`, `bid`, `mid`, `close`, `high`, `last`, `low`, `open`, `previous_close`: Price data
- `option_type`: Put or Call
- `symbol`: Option symbol
- `timestamp`: Collection timestamp

## File Structure

```
trade-matrix-options/
├── server.js                    # API server
├── simpleOptionsCollector.js    # Main collection logic
├── tokenManager.js             # TradeStation token management
├── database/
│   └── options-schema.sql      # Database schema
├── output/                     # Generated data files
├── package.json
├── env.example
└── API_DOCUMENTATION.md
```

## Environment Variables

Required in `.env` file:
```
TRADESTATION_CLIENT_ID=your_client_id
TRADESTATION_CLIENT_SECRET=your_client_secret
TRADESTATION_REFRESH_TOKEN=your_refresh_token
SYMBOLS=$SPX.X,$SPXW.X

# API Authentication (server-side only for security)
API_KEY=your_secure_api_key_here
```

## 🔐 Authentication

- **Variable:** `API_KEY`
- **Security:** High - not exposed to client
- **Use case:** Backend-to-backend communication
- **Method:** X-API-Key header authentication
