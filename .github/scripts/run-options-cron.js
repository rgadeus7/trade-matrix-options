#!/usr/bin/env node

/**
 * Options Collection Script
 * Processes JSON configurations and calls the options API for each symbol
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env file if it exists (for local development)
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('📁 Loaded environment variables from .env file');
} else {
  console.log('🔧 Using environment variables from system/secrets');
}

// Parse command line arguments
const args = process.argv.slice(2);
const configId = args[0]; // Optional: specific config ID to run

// Load configuration from JSON file
function loadConfigurations() {
  // Try multiple possible paths for different environments
  const possiblePaths = [
    path.join(__dirname, '..', 'config', 'options-config.json'), // Local development
    path.join(__dirname, '..', '..', '.github', 'config', 'options-config.json'), // GitHub Actions
    path.join(process.cwd(), '.github', 'config', 'options-config.json') // Fallback from current working directory
  ];
  
  for (const configPath of possiblePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        console.log(`📁 Loaded configuration from: ${configPath}`);
        return JSON.parse(configData);
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  console.error(`❌ Failed to load configuration file from any of these locations:`);
  possiblePaths.forEach(p => console.error(`  - ${p}`));
  process.exit(1);
}

// Environment variables
const OPTIONS_API_URL = 'https://trade-matrix-options.vercel.app';
const API_KEY = process.env.OPTIONS_API_KEY;

if (!API_KEY) {
  console.error('❌ Missing required environment variable: OPTIONS_API_KEY');
  process.exit(1);
}

console.log('OPTIONS_API_URL:', OPTIONS_API_URL);

// Function to make HTTP request
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Main execution function
async function runOptionsCollection() {
  console.log('🚀 Starting Options Collection...');
  console.log(`📋 Config Filter: ${configId || 'ALL enabled configurations'}`);
  console.log('---');

  // Load configurations from JSON file
  const configData = loadConfigurations();
  let configurations = configData.configurations;

  // Filter configurations by ID
  if (configId) {
    configurations = configurations.filter(config => 
      config.id === configId || config.id.includes(configId)
    );
    if (configurations.length === 0) {
      console.error(`❌ No configuration found with ID: ${configId}`);
      console.log('Available configurations:');
      configData.configurations.forEach(config => {
        console.log(`  - ID: ${config.id} | Name: ${config.name} (${config.enabled ? 'enabled' : 'disabled'})`);
      });
      process.exit(1);
    }
  }

  // Filter only enabled configurations
  configurations = configurations.filter(config => config.enabled);
  
  if (configurations.length === 0) {
    console.log('⚠️ No enabled configurations found');
    if (configId) {
      console.log(`Configuration with ID "${configId}" is disabled or not found`);
    } else {
      console.log('All configurations are disabled');
    }
    process.exit(0);
  }

  console.log(`📋 Found ${configurations.length} enabled configuration(s):`);
  configurations.forEach(config => {
    console.log(`  - ID: ${config.id} | ${config.name}: ${config.description}`);
  });
  console.log('---');

  let totalSuccessCount = 0;
  let totalFailureCount = 0;
  let totalSymbolsProcessed = 0;

  // Process each configuration
  for (const config of configurations) {
    console.log(`🔧 Processing Configuration: "${config.name}"`);
    console.log(`📝 Description: ${config.description}`);
    console.log(`📊 Symbols: ${config.parameters.symbols.join(', ')}`);
      console.log(`⚙️ Parameters:`, {
        topRecords: config.parameters.topRecords,
        streamDuration: config.parameters.streamDuration,
        expirationFilter: config.parameters.expirationFilter
      });
    console.log('---');

    let configSuccessCount = 0;
    let configFailureCount = 0;

    // Process each symbol in the configuration
    for (const symbol of config.parameters.symbols) {
      try {
        console.log(`📈 Processing Symbol: ${symbol}`);
        
        const url = `${OPTIONS_API_URL}/api/collect-options`;
        const options = {
          method: 'POST',
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json'
          }
        };
        
        const data = {
          symbols: [symbol],
          topRecords: config.parameters.topRecords,
          streamDuration: config.parameters.streamDuration,
          expirationFilter: config.parameters.expirationFilter,
          saveToDatabase: config.parameters.saveToDatabase !== undefined ? config.parameters.saveToDatabase : true
        };
        
        console.log(`📋 Request for ${symbol}:`, JSON.stringify(data, null, 2));

        const response = await makeRequest(url, options, data);
        
        console.log(`📊 Response for ${symbol}:`);
        console.log(`HTTP Code: ${response.statusCode}`);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            const responseData = JSON.parse(response.body);
            console.log(`✅ ${symbol} completed successfully`);
            console.log(`📈 Summary for ${symbol}:`, {
              total_records: responseData.summary?.total_records || 0,
              symbols_processed: responseData.summary?.symbols_processed || 0,
              database_processed: responseData.summary?.database_processed || 0,
              database_inserted: responseData.summary?.database_inserted || 0,
              database_updated: responseData.summary?.database_updated || 0,
              duration_ms: responseData.duration_ms || 0
            });
            configSuccessCount++;
            totalSuccessCount++;
          } catch (parseError) {
            console.log(`⚠️ Response parsing failed but HTTP request succeeded for ${symbol}: ${parseError.message}`);
            console.log(`Raw response: ${response.body}`);
            configSuccessCount++;
            totalSuccessCount++;
          }
        } else {
          console.log(`❌ ${symbol} failed with HTTP ${response.statusCode}`);
          console.log(`Error response: ${response.body}`);
          configFailureCount++;
          totalFailureCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${symbol}: ${error.message}`);
        configFailureCount++;
        totalFailureCount++;
      }
      
      totalSymbolsProcessed++;
      console.log('---');
    }

    // Configuration summary
    console.log(`📊 Configuration "${config.name}" Summary:`);
    console.log(`✅ Successful: ${configSuccessCount}`);
    console.log(`❌ Failed: ${configFailureCount}`);
    console.log(`📈 Total Symbols: ${config.parameters.symbols.length}`);
    console.log('==========================================');
  }

  // Overall summary
  console.log(`🎯 Overall Options Collection Summary:`);
  console.log(`✅ Total Successful: ${totalSuccessCount}`);
  console.log(`❌ Total Failed: ${totalFailureCount}`);
  console.log(`📈 Total Symbols Processed: ${totalSymbolsProcessed}`);
  console.log(`📋 Total Configurations: ${configurations.length}`);

  if (totalFailureCount > 0) {
    console.log('⚠️ Some symbols failed - check individual logs above');
    process.exit(1);
  } else {
    console.log('🎉 All options collection completed successfully');
    process.exit(0);
  }
}

// Run the script
runOptionsCollection().catch(error => {
  console.error('❌ Script execution failed:', error);
  process.exit(1);
});