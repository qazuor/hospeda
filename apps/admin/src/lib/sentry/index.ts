/**
 * Sentry Integration Module
 *
 * Provides error tracking and performance monitoring via Sentry.
 */

export {
    captureError,
    captureMessage,
    initSentry,
    isSentryInitialized,
    Sentry,
    setSentryTags,
    setSentryUser
} from './sentry.config';
