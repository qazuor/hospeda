/**
 * Sentry Integration Module
 *
 * Provides error tracking and performance monitoring via Sentry.
 */

export {
    initSentry,
    isSentryInitialized,
    setSentryUser,
    setSentryTags,
    captureError,
    captureMessage,
    Sentry
} from './sentry.config';
