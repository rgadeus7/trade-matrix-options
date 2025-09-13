import { optionsAuth } from './sharedAuth.js';

// Re-export the shared auth functions for backward compatibility
export const verifyApiKey = optionsAuth.verify;
export const createUnauthorizedResponse = optionsAuth.createUnauthorizedResponse;
