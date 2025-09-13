import axios from 'axios';
import dotenv from 'dotenv';
import TokenManager from './tokenManager.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

class SimpleOptionsCollector {
  constructor() {
    this.tokenManager = TokenManager.getInstance();
    this.symbols = process.env.SYMBOLS ? process.env.SYMBOLS.split(',').map(s => s.trim()) : ['$SPX.X', '$SPXW.X'];
    this.topRecords = 3; // Focus on 3 contracts for weekly and 3 for monthly
    this.streamDuration = 2000; // 2 seconds
    this.expirationFilter = null; // null = all, 'Weekly' = weekly only, 'Monthly' = monthly only
  }

  /**
   * Get top 5 expirations for each symbol
   */
  async getExpirations() {
    try {
      // console.log('🚀 Getting expirations for symbols:', this.symbols);
      
      const isValidToken = await this.tokenManager.ensureValidToken();
      if (!isValidToken) {
        throw new Error('Authentication failed');
      }
      
      const token = this.tokenManager.getAccessToken();
      const expirations = {};
      
      for (const symbol of this.symbols) {
        // console.log(`📊 Getting expirations for ${symbol}...`);
        
        const response = await axios.get(
          `https://api.tradestation.com/v3/marketdata/options/expirations/${symbol}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        // Filter by expiration type first, then get top records
        let filteredExpirations = response.data.Expirations;
        if (this.expirationFilter) {
          filteredExpirations = response.data.Expirations.filter(exp => exp.Type === this.expirationFilter);
        }
        
        // Get top N records from filtered list
        const topExpirations = filteredExpirations.slice(0, this.topRecords);
        expirations[symbol] = topExpirations;
        
        // console.log(`✅ ${symbol}: Got ${topExpirations.length} expirations`);
        topExpirations.forEach((exp, index) => {
          // console.log(`   ${index + 1}. ${exp.Date} (${exp.Type})`);
        });
      }
      
      return expirations;
      
    } catch (error) {
      console.error('❌ Failed to get expirations:', error.message);
      throw error;
    }
  }


  /**
   * Clean and extract only essential options data fields
   */
  cleanOptionsData(rawData, expiration) {
    try {
      const cleanedOptions = [];
      
      // Extract data from each leg in the options chain
      if (rawData.Legs && Array.isArray(rawData.Legs)) {
        for (const leg of rawData.Legs) {
          const cleanedData = {
            expiration_date: expiration.Date,
            strike: leg.StrikePrice || null,
            expiration_type: expiration.Type || null,
            ask: rawData.Ask || null,
            bid: rawData.Bid || null,
            mid: rawData.Mid || null,
            close: rawData.Close || null,
            high: rawData.High || null,
            last: rawData.Last || null,
            low: rawData.Low || null,
            open: rawData.Open || null,
            previous_close: rawData.PreviousClose || null,
            option_type: leg.OptionType || null, // Put or Call
            symbol: leg.Symbol || null,
            timestamp: new Date().toISOString()
          };
          
          cleanedOptions.push(cleanedData);
        }
      }
      
      return cleanedOptions;
    } catch (error) {
      console.warn(`⚠️  Failed to clean options data:`, error.message);
      return [];
    }
  }

  /**
   * Stream options chain data for 2 seconds with a single expiration
   */
  async streamOptionsChainForExpiration(symbol, expiration) {
    try {
      // console.log(`📡 Streaming options chain for ${symbol} - ${expiration.Date} (${this.streamDuration/1000} seconds)...`);
      
      const token = this.tokenManager.getAccessToken();
      const url = `https://api.tradestation.com/v3/marketdata/stream/options/chains/${symbol}`;
      
      // Build query parameters
      const params = {
        enableGreeks: false,  // Set to false as requested
        strikeProximity: 1,
        expiration: expiration.Date
      };
      
      // console.log(`🔗 URL: ${url}`);
      // console.log(`📋 Params:`, params);
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        params: params,
        timeout: this.streamDuration + 5000, // Add 5 seconds buffer
        responseType: 'stream'
      });

      // console.log(`✅ Connected to stream for ${symbol} - ${expiration.Date}`);
      
      let dataReceived = 0;
      let chunks = [];
      let records = 0;

      // Set up timeout to stop streaming
      const timeoutId = setTimeout(() => {
        // console.log(`⏰ ${this.streamDuration/1000}-second timeout reached, closing stream for ${symbol} - ${expiration.Date}...`);
        response.data.destroy();
      }, this.streamDuration);

      // Handle streaming data
      response.data.on('data', (chunk) => {
        dataReceived += chunk.length;
        chunks.push(chunk.toString());
        
        // Count records (assuming each line is a JSON record)
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        records += lines.length;
        
        // console.log(`📊 ${symbol} (${expiration.Date}): Received ${dataReceived} bytes, ${records} records...`);
      });

      response.data.on('end', () => {
        clearTimeout(timeoutId);
        // console.log(`🔚 Stream ended for ${symbol} - ${expiration.Date}`);
        // console.log(`📊 ${symbol} (${expiration.Date}): Total data received: ${dataReceived} bytes, ${records} records`);
      });

      response.data.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`❌ Stream error for ${symbol} - ${expiration.Date}:`, error.message);
      });

      // Wait for the timeout or stream end
      await new Promise((resolve) => {
        setTimeout(resolve, this.streamDuration + 1000);
      });

      // Combine all chunks and parse JSON lines
      const fullData = chunks.join('');
      
      // Parse JSON lines into proper JSON array and clean up data
      let parsedData = [];
      try {
        const lines = fullData.split('\n').filter(line => line.trim());
        const allOptions = [];
        
        lines.forEach(line => {
          try {
            const rawData = JSON.parse(line.trim());
            const cleanedOptions = this.cleanOptionsData(rawData, expiration);
            if (cleanedOptions && cleanedOptions.length > 0) {
              allOptions.push(...cleanedOptions);
            }
          } catch (parseError) {
            console.warn(`⚠️  Failed to parse line: ${line.substring(0, 100)}...`);
          }
        });
        
        parsedData = allOptions;
        // console.log(`✅ ${symbol} (${expiration.Date}): Parsed ${parsedData.length} valid options records`);
      } catch (error) {
        console.error(`❌ Failed to parse JSON data for ${symbol} - ${expiration.Date}:`, error.message);
        parsedData = [];
      }
      
      return {
        symbol: symbol,
        expiration: expiration,
        dataReceived: dataReceived,
        records: records,
        rawData: fullData,
        parsedData: parsedData,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Failed to stream options chain for ${symbol} - ${expiration.Date}:`, error.message);
      if (error.response) {
        console.error(`📡 Response status: ${error.response.status}`);
        console.error(`📡 Response data:`, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Stream options chain data for all expirations of a symbol
   */
  async streamOptionsChain(symbol, expirations) {
    try {
      // console.log(`📡 Streaming options chain for ${symbol} with ${expirations.length} expirations...`);
      
      const results = [];
      
      for (const expiration of expirations) {
        try {
          const result = await this.streamOptionsChainForExpiration(symbol, expiration);
          results.push(result);
          
          // Small delay between expirations
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Failed to stream ${symbol} - ${expiration.Date}:`, error.message);
          results.push({
            symbol: symbol,
            expiration: expiration,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      return {
        symbol: symbol,
        expirations: expirations,
        results: results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Failed to stream options chain for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Stream options chains for all symbols with their expirations
   */
  async streamAllOptionsChains(expirations) {
    try {
      // console.log('📡 Starting options chain streaming for all symbols...');
      
      const results = {};
      
      for (const symbol of this.symbols) {
        try {
          const symbolExpirations = expirations[symbol] || [];
          const result = await this.streamOptionsChain(symbol, symbolExpirations);
          results[symbol] = result;
          
          // Small delay between symbols
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Failed to stream ${symbol}:`, error.message);
          results[symbol] = {
            symbol: symbol,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Failed to stream options chains:', error.message);
      throw error;
    }
  }

  /**
   * Save data to JSON file
   */
  async saveToFile(data, filename = null) {
    try {
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `options_data_${timestamp}.json`;
      }
      
      const outputDir = './output';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      // console.log(`💾 Data saved to: ${filePath}`);
      return filePath;
      
    } catch (error) {
      console.error('❌ Failed to save data:', error.message);
      throw error;
    }
  }

  /**
   * Main method - get expirations and stream options chains
   */
  async collect() {
    try {
      // console.log('🎯 Starting Simple Options Collection');
      // console.log('=====================================');
      // console.log(`📋 Symbols: ${this.symbols.join(', ')}`);
      // console.log(`📋 Top Records: ${this.topRecords}`);
      // console.log(`📋 Stream Duration: ${this.streamDuration/1000} seconds`);
      
      // 1. Get expirations
      // console.log('\n📅 Step 1: Getting expirations...');
      const expirations = await this.getExpirations();
      
      // 2. Stream options chains
      // console.log('\n📡 Step 2: Streaming options chains...');
      const streamResults = await this.streamAllOptionsChains(expirations);
      
      // 3. Flatten all options data into single array
      const allOptionsData = [];
      
      Object.values(streamResults).forEach(symbolResult => {
        if (symbolResult.results && Array.isArray(symbolResult.results)) {
          symbolResult.results.forEach(expirationResult => {
            if (expirationResult.parsedData && Array.isArray(expirationResult.parsedData)) {
              allOptionsData.push(...expirationResult.parsedData);
            }
          });
        }
      });
      
      const finalData = allOptionsData;
      
      // console.log('\n✅ Simple Options Collection Completed!');
      // console.log(`📊 Summary: ${allOptionsData.length} total options records collected`);
      
      return finalData;
      
    } catch (error) {
      console.error('❌ Collection failed:', error.message);
      throw error;
    }
  }
}

// Main execution
if (process.argv[1] && process.argv[1].endsWith('simpleOptionsCollector.js')) {
  const collector = new SimpleOptionsCollector();
  
  collector.collect().then(result => {
    // console.log('🎉 Collection completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Collection failed:', error.message);
    process.exit(1);
  });
}

export default SimpleOptionsCollector;
