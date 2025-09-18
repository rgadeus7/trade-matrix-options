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
   * Get aggregated options data by symbol and date range - grouped by expiration_date and strike
   * Returns separate put and call mid prices for each strike
   */
  static async getAggregatedOptionsData(symbol, startDate, endDate) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          expiration_date,
          strike,
          SUM(CASE WHEN option_type = 'Call' THEN mid ELSE 0 END) as call_mid_price,
          SUM(CASE WHEN option_type = 'Put' THEN mid ELSE 0 END) as put_mid_price,
          SUM(mid) as total_mid_price,
          COUNT(*) as option_count,
          COUNT(CASE WHEN option_type = 'Call' THEN 1 END) as call_count,
          COUNT(CASE WHEN option_type = 'Put' THEN 1 END) as put_count
        FROM options_data 
        WHERE symbol = $1 
        AND expiration_date BETWEEN $2 AND $3
        AND mid IS NOT NULL
        GROUP BY expiration_date, strike
        ORDER BY expiration_date, strike
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
   * Get aggregated options data by multiple symbols and date range - grouped by expiration_date and strike
   * Returns separate put and call mid prices for each strike across multiple symbols
   */
  static async getAggregatedOptionsDataMultiSymbol(symbols, startDate, endDate) {
    const client = await pool.connect();
    
    try {
      // Create placeholders for the IN clause
      const placeholders = symbols.map((_, index) => `$${index + 1}`).join(',');
      
      const query = `
        SELECT 
          expiration_date,
          strike,
          SUM(CASE WHEN option_type = 'Call' THEN mid ELSE 0 END) as call_mid_price,
          SUM(CASE WHEN option_type = 'Put' THEN mid ELSE 0 END) as put_mid_price,
          SUM(mid) as total_mid_price,
          COUNT(*) as option_count,
          COUNT(CASE WHEN option_type = 'Call' THEN 1 END) as call_count,
          COUNT(CASE WHEN option_type = 'Put' THEN 1 END) as put_count,
          STRING_AGG(DISTINCT symbol, ', ') as symbols
        FROM options_data 
        WHERE symbol IN (${placeholders})
        AND expiration_date BETWEEN $${symbols.length + 1} AND $${symbols.length + 2}
        AND mid IS NOT NULL
        GROUP BY expiration_date, strike
        ORDER BY expiration_date, strike
      `;
      
      const params = [...symbols, startDate, endDate];
      const result = await client.query(query, params);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Database query failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get all unique symbols in the database
   */
  static async getAllSymbols() {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT DISTINCT symbol, COUNT(*) as record_count
        FROM options_data 
        GROUP BY symbol
        ORDER BY symbol
      `;
      
      const result = await client.query(query);
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
   * Clean up old options records for specific symbols
   * Keeps only the most recent records for each symbol based on timestamp
   * 
   * @param {string[]} symbols - Array of symbols to clean up
   * @param {number} keepHours - Number of hours of recent data to keep (default: 0.5 = 30 minutes)
   * @param {boolean} dryRun - If true, only count records that would be deleted (default: false)
   */
  static async cleanupOldOptionsData(symbols, keepHours = 0.5, dryRun = false) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create placeholders for the IN clause
      const placeholders = symbols.map((_, index) => `$${index + 1}`).join(',');
      
      // Calculate cutoff timestamp
      const cutoffTime = new Date(Date.now() - (keepHours * 60 * 60 * 1000));
      
      // First, count how many records would be affected
      const countQuery = `
        SELECT 
          symbol,
          COUNT(*) as total_records,
          COUNT(CASE WHEN timestamp < $${symbols.length + 1} THEN 1 END) as old_records,
          MIN(timestamp) as oldest_timestamp,
          MAX(timestamp) as newest_timestamp
        FROM options_data 
        WHERE symbol IN (${placeholders})
        GROUP BY symbol
        ORDER BY symbol
      `;
      
      const countResult = await client.query(countQuery, [...symbols, cutoffTime]);
      
      let totalDeleted = 0;
      const cleanupResults = [];
      
      for (const row of countResult.rows) {
        if (row.old_records > 0) {
          if (dryRun) {
            console.log(`🔍 [DRY RUN] Would delete ${row.old_records} old records for ${row.symbol} (keeping ${row.total_records - row.old_records} recent records)`);
            cleanupResults.push({
              symbol: row.symbol,
              totalRecords: parseInt(row.total_records),
              oldRecords: parseInt(row.old_records),
              keptRecords: parseInt(row.total_records) - parseInt(row.old_records),
              oldestTimestamp: row.oldest_timestamp,
              newestTimestamp: row.newest_timestamp,
              action: 'would_delete'
            });
          } else {
            // Delete old records for this symbol
            const deleteQuery = `
              DELETE FROM options_data 
              WHERE symbol = $1 
              AND timestamp < $2
            `;
            
            const deleteResult = await client.query(deleteQuery, [row.symbol, cutoffTime]);
            const deletedCount = deleteResult.rowCount;
            totalDeleted += deletedCount;
            
            console.log(`🗑️  Deleted ${deletedCount} old records for ${row.symbol} (kept ${row.total_records - deletedCount} recent records)`);
            cleanupResults.push({
              symbol: row.symbol,
              totalRecords: parseInt(row.total_records),
              deletedRecords: deletedCount,
              keptRecords: parseInt(row.total_records) - deletedCount,
              oldestTimestamp: row.oldest_timestamp,
              newestTimestamp: row.newest_timestamp,
              action: 'deleted'
            });
          }
        } else {
          console.log(`✅ No old records to clean up for ${row.symbol} (${row.total_records} total records)`);
          cleanupResults.push({
            symbol: row.symbol,
            totalRecords: parseInt(row.total_records),
            deletedRecords: 0,
            keptRecords: parseInt(row.total_records),
            oldestTimestamp: row.oldest_timestamp,
            newestTimestamp: row.newest_timestamp,
            action: 'no_action'
          });
        }
      }
      
      if (!dryRun) {
        await client.query('COMMIT');
        console.log(`✅ Cleanup completed: ${totalDeleted} total records deleted across ${symbols.length} symbols`);
      } else {
        await client.query('ROLLBACK');
        const wouldDeleteTotal = cleanupResults.reduce((sum, result) => sum + (result.oldRecords || 0), 0);
        console.log(`🔍 [DRY RUN] Would delete ${wouldDeleteTotal} total records across ${symbols.length} symbols`);
      }
      
      return {
        success: true,
        dryRun: dryRun,
        cutoffTime: cutoffTime,
        keepHours: keepHours,
        symbolsProcessed: symbols.length,
        totalDeleted: totalDeleted,
        results: cleanupResults
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Cleanup failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up old options records for all symbols in the database
   * 
   * @param {number} keepHours - Number of hours of recent data to keep (default: 0.5 = 30 minutes)
   * @param {boolean} dryRun - If true, only count records that would be deleted (default: false)
   */
  static async cleanupAllOldOptionsData(keepHours = 0.5, dryRun = false) {
    const client = await pool.connect();
    
    try {
      // Get all unique symbols
      const symbolsResult = await client.query('SELECT DISTINCT symbol FROM options_data ORDER BY symbol');
      const symbols = symbolsResult.rows.map(row => row.symbol);
      
      if (symbols.length === 0) {
        console.log('ℹ️  No symbols found in database');
        return {
          success: true,
          dryRun: dryRun,
          symbolsProcessed: 0,
          totalDeleted: 0,
          results: []
        };
      }
      
      console.log(`🧹 Starting cleanup for ${symbols.length} symbols: ${symbols.join(', ')}`);
      return await this.cleanupOldOptionsData(symbols, keepHours, dryRun);
      
    } catch (error) {
      console.error('❌ Cleanup all failed:', error.message);
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
