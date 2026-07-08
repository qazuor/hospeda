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

export type { AuditEventTypeValue } from './audit-types.js';
export { AuditEventType } from './audit-types.js';
export type { CapDataOptions } from './cap-data.js';
export { capLogData, DEFAULT_CAP_OPTIONS } from './cap-data.js';
export type { CaptureHookFn } from './capture.js';
export {
    hasCaptureHook,
    invokeCaptureHook,
    registerCaptureHook,
    unregisterCaptureHook
} from './capture.js';
export { registerCategoryInternal } from './categories.js';
export { configureLogger, resetLoggerConfig } from './config.js';
export { redactSensitiveData, shouldUseWhiteText } from './formatter.js';
export type { LogHookFn } from './hooks.js';
export {
    clearHooks,
    dispatchHooks,
    hasHooks,
    registerHook,
    unregisterHook
} from './hooks.js';
export type { LogEntry } from './log-entry.js';
export { buildLogEntry } from './log-entry.js';
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
export * from './types.js';

// Export default logger instance
import { logger } from './logger.js';
export default logger;
