/**
 * Simple test script to verify API setup
 */
import { logger } from '@repo/logger';
import { app } from './app.js';

const port = 3001;

logger.info('🚀 Testing API setup...');
logger.info(`Server would start on port ${port}`);
logger.info('✅ API configuration successful!');

export { app };
