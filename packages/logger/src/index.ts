/**
 * Logger module for centralized logging across the application
 * @module logger
 *
 * IMPORTANT: This module deliberately does NOT auto-load .env files. Library
 * code must not have global side effects — auto-loading env at import time
 * pulls `dotenv` (and its Node-only deps `fs` / `path` / `os`) into any browser
 * bundle that transitively imports this package. Consumers that need env are
 * responsible for loading them at their own entry point (apps/api already
 * does so in `apps/api/src/utils/{env,logger}.ts`; Vite-based apps read env
 * via `import.meta.env`).
 */

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
