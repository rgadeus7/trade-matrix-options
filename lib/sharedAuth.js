/**
 * Shared Authentication Utility
 * Supports multiple authentication methods across services
 */

/**
 * Unified API key verification supporting multiple methods
 */
export function verifyApiKey(
  request, 
  config = { method: 'x-api-key', apiKeyEnvVar: 'API_KEY' }
) {
  // X-API-Key header authentication
  if (config.method === 'x-api-key' || config.method === 'both') {
    const apiKey = request.headers.get('X-API-Key');
    const expectedApiKey = process.env[config.apiKeyEnvVar || 'API_KEY'];
    
    if (expectedApiKey && apiKey === expectedApiKey) {
      return true;
    }
  }
  
  // Authorization Bearer token authentication
  if (config.method === 'bearer' || config.method === 'both') {
    const authHeader = request.headers.get('authorization');
    const expectedBearerKey = process.env[config.bearerEnvVar || 'VERCEL_API_KEY'];
    
    if (expectedBearerKey && authHeader && authHeader.startsWith('Bearer ')) {
      const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
      if (providedKey === expectedBearerKey) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Create standardized unauthorized response
 */
export function createUnauthorizedResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
      timestamp: new Date().toISOString()
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'ApiKey'
      }
    }
  );
}

/**
 * Pre-configured auth functions for different services
 */
export const optionsAuth = {
  verify: (request) => verifyApiKey(request, { 
    method: 'x-api-key', 
    apiKeyEnvVar: 'API_KEY' 
  }),
  createUnauthorizedResponse
};

export const backendAuth = {
  verify: (request) => verifyApiKey(request, { 
    method: 'bearer', 
    bearerEnvVar: 'VERCEL_API_KEY' 
  }),
  createUnauthorizedResponse
};
