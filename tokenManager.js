import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class TokenManager {
  static instance = null;
  
  constructor() {
    this.accessToken = null;
    this.refreshToken = process.env.TRADESTATION_REFRESH_TOKEN || null;
    this.tokenExpiry = 0;
    this.isRefreshing = false;
    this.lastRefreshAttempt = 0;
    this.refreshAttempts = 0;
    this.MAX_REFRESH_ATTEMPTS = 3;
    this.REFRESH_COOLDOWN = 5 * 60 * 1000; // 5 minutes
    
    // console.log(`🔐 TokenManager initialized with refresh token: ${this.refreshToken ? 'Available' : 'Missing'}`);
  }

  /**
   * Get the singleton instance of TokenManager
   */
  static getInstance() {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Main method to ensure a valid token before any API operation
   */
  async ensureValidToken() {
    try {
      // console.log('🔐 Validating TradeStation token...');
      
      // Check if we have a valid access token
      if (this.accessToken && this.isTokenValid()) {
        // console.log('✅ Access token is valid');
        return true;
      }
      
      // Try to refresh the token
      if (this.canAttemptRefresh()) {
        // console.log('🔄 Access token expired or missing, attempting refresh...');
        const refreshSuccess = await this.refreshAccessToken();
        if (refreshSuccess) {
          // console.log('✅ Token refreshed successfully');
          return true;
        }
      }
      
      console.error('❌ Failed to obtain valid TradeStation token');
      return false;
      
    } catch (error) {
      console.error('❌ Token validation error:', error.message);
      return false;
    }
  }

  /**
   * Check if the current access token is valid
   */
  isTokenValid() {
    if (!this.accessToken) {
      return false;
    }
    
    // Check if token is expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    const isExpired = Date.now() >= (this.tokenExpiry - bufferTime);
    
    if (isExpired) {
      // console.log('⏰ Access token is expired');
      return false;
    }
    
    return true;
  }

  /**
   * Check if we can attempt a token refresh
   */
  canAttemptRefresh() {
    if (!this.refreshToken) {
      console.error('❌ No refresh token available');
      return false;
    }
    
    // Check if we've exceeded max attempts
    if (this.refreshAttempts >= this.MAX_REFRESH_ATTEMPTS) {
      console.error('❌ Max refresh attempts reached, manual re-authentication required');
      return false;
    }
    
    return true;
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      console.error('❌ No refresh token available');
      return false;
    }

    if (this.refreshAttempts >= this.MAX_REFRESH_ATTEMPTS) {
      console.error('❌ Max refresh attempts reached, manual re-authentication required');
      return false;
    }

    this.isRefreshing = true;
    this.lastRefreshAttempt = Date.now();
    this.refreshAttempts++;

    try {
      // console.log(`🔄 Refreshing token (attempt ${this.refreshAttempts}/${this.MAX_REFRESH_ATTEMPTS})`);
      
      const response = await axios.post(
        'https://signin.tradestation.com/oauth/token',
        {
          grant_type: 'refresh_token',
          client_id: process.env.TRADESTATION_CLIENT_ID,
          client_secret: process.env.TRADESTATION_CLIENT_SECRET,
          refresh_token: this.refreshToken
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      // Reset refresh attempts on success
      this.refreshAttempts = 0;

      // console.log('✅ TradeStation token refreshed successfully');
      // console.log(`📅 Token expires at: ${new Date(this.tokenExpiry).toISOString()}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error.response?.data || error.message);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get the current access token
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Get token information for debugging
   */
  getTokenInfo() {
    return {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : null,
      isExpired: this.tokenExpiry ? Date.now() >= this.tokenExpiry : true,
      refreshAttempts: this.refreshAttempts,
      isRefreshing: this.isRefreshing
    };
  }
}

export default TokenManager;
