/**
 * @repo/feedback/config - Barrel export for all config constants.
 *
 * Re-exports all configurable values and UI strings. Import from
 * this barrel instead of importing individual config files.
 *
 * @example
 * ```ts
 * import { FEEDBACK_CONFIG, FEEDBACK_STRINGS } from '@repo/feedback/config';
 * ```
 */
export {
    ALLOWED_FILE_TYPES,
    FEEDBACK_CONFIG,
    LINEAR_CONFIG,
    REPORT_TYPES,
    SEVERITY_LEVELS
} from './feedback.config.js';
export { FEEDBACK_STRINGS } from './strings.js';
