import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Database service for options data
 */
export class OptionsDatabase {
  /**
   * Insert options data into the database
   */
  static async insertOptionsData(optionsData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const upsertQuery = `
        INSERT INTO options_data (
          symbol, expiration_date, strike, expiration_type, ask, bid, mid, close, 
          high, last, low, open, previous_close, option_type, option_symbol, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (option_symbol) 
        DO UPDATE SET
          ask = EXCLUDED.ask,
          bid = EXCLUDED.bid,
          mid = EXCLUDED.mid,
          close = EXCLUDED.close,
          high = EXCLUDED.high,
          last = EXCLUDED.last,
          low = EXCLUDED.low,
          open = EXCLUDED.open,
          previous_close = EXCLUDED.previous_close,
          option_symbol = EXCLUDED.option_symbol,
          timestamp = EXCLUDED.timestamp
        RETURNING id, (xmax = 0) AS inserted
      `;
      
      const results = [];
      let insertedCount = 0;
      let updatedCount = 0;
      
      for (const option of optionsData) {
        // Extract underlying symbol from option_symbol (e.g., "AAPL 250919P232.5" -> "AAPL")
        const underlyingSymbol = option.symbol ? option.symbol.split(' ')[0] : null;
        
        const values = [
          underlyingSymbol,  // symbol (underlying)
          option.expiration_date,
          parseFloat(option.strike),
          option.expiration_type,
          option.ask ? parseFloat(option.ask) : null,
          option.bid ? parseFloat(option.bid) : null,
          option.mid ? parseFloat(option.mid) : null,
          option.close ? parseFloat(option.close) : null,
          option.high ? parseFloat(option.high) : null,
          option.last ? parseFloat(option.last) : null,
          option.low ? parseFloat(option.low) : null,
          option.open ? parseFloat(option.open) : null,
          option.previous_close ? parseFloat(option.previous_close) : null,
          option.option_type,
          option.symbol,  // option_symbol (full option symbol)
          option.timestamp
        ];
        
        const result = await client.query(upsertQuery, values);
        const row = result.rows[0];
        
        results.push({
          id: row.id,
          action: row.inserted ? 'inserted' : 'updated'
        });
        
        if (row.inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ Upserted ${results.length} options records: ${insertedCount} inserted, ${updatedCount} updated`);
      return {
        success: true,
        totalProcessed: results.length,
        insertedCount: insertedCount,
        updatedCount: updatedCount,
        results: results
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Database insertion failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get options data by symbol and date range
   */
  static async getOptionsData(symbol, startDate, endDate) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT * FROM options_data 
        WHERE symbol = $1 
        AND expiration_date BETWEEN $2 AND $3
        ORDER BY expiration_date, strike, option_type
      `;
      
      const result = await client.query(query, [symbol, startDate, endDate]);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Database query failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get latest options data for a symbol
   */
  static async getLatestOptionsData(symbol, limit = 100) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT * FROM options_data 
        WHERE symbol = $1 
        ORDER BY timestamp DESC, expiration_date, strike
        LIMIT $2
      `;
      
      const result = await client.query(query, [symbol, limit]);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Database query failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Test database connection
   */
  static async testConnection() {
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT NOW()');
      console.log('✅ Database connection successful:', result.rows[0].now);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    } finally {
      client.release();
    }
  }
}

export default OptionsDatabase;
