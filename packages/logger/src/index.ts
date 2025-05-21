/**
 * Logger module for centralized logging across the application
 * @module logger
 */

export { configureLogger, resetLoggerConfig } from './config.js';
export {
    createLogger,
    debug,
    error,
    info,
    log,
    logger,
    warn
} from './logger.js';
export * from './types.js';

// Export default logger instance
import { logger } from './logger.js';
export default logger;
