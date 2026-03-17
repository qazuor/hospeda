/**
 * Logger module for centralized logging across the application
 * @module logger
 */

import 'dotenv/config';

export { registerCategoryInternal } from './categories.js';
export { configureLogger, resetLoggerConfig } from './config.js';
export {
    createLogger,
    debug,
    error,
    info,
    log,
    logger,
    registerCategory,
    warn
} from './logger.js';
export { redactSensitiveData, shouldUseWhiteText } from './formatter.js';
export * from './types.js';
export { AuditEventType } from './audit-types.js';
export type { AuditEventTypeValue } from './audit-types.js';

// Export default logger instance
import { logger } from './logger.js';
export default logger;
