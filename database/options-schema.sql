-- Options Data Schema for Trade Matrix Options Collector
-- This table stores options chain data collected from TradeStation API

CREATE TABLE IF NOT EXISTS options_data (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,  -- Underlying symbol (e.g., AAPL, $SPX.X)
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    strike DECIMAL(10,2) NOT NULL,
    expiration_type VARCHAR(20) NOT NULL CHECK (expiration_type IN ('Weekly', 'Monthly')),
    ask DECIMAL(10,2),
    bid DECIMAL(10,2),
    mid DECIMAL(10,2),
    close DECIMAL(10,2),
    high DECIMAL(10,2),
    last DECIMAL(10,2),
    low DECIMAL(10,2),
    open DECIMAL(10,2),
    previous_close DECIMAL(10,2),
    option_type VARCHAR(10) NOT NULL CHECK (option_type IN ('Put', 'Call')),
    option_symbol VARCHAR(100) NOT NULL,  -- Full option symbol (e.g., AAPL 250919P232.5)
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(option_symbol)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_options_data_expiration_date ON options_data(expiration_date);
CREATE INDEX IF NOT EXISTS idx_options_data_symbol ON options_data(symbol);
CREATE INDEX IF NOT EXISTS idx_options_data_strike ON options_data(strike);
CREATE INDEX IF NOT EXISTS idx_options_data_option_type ON options_data(option_type);
CREATE INDEX IF NOT EXISTS idx_options_data_expiration_type ON options_data(expiration_type);
CREATE INDEX IF NOT EXISTS idx_options_data_timestamp ON options_data(timestamp);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_options_data_symbol_expiration ON options_data(symbol, expiration_date);
CREATE INDEX IF NOT EXISTS idx_options_data_symbol_strike ON options_data(symbol, strike);