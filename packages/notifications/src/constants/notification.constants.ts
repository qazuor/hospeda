/**
 * Notification system constants
 */
export const NOTIFICATION_CONSTANTS = {
    /** Maximum number of retry attempts for failed notifications */
    MAX_RETRY_ATTEMPTS: 3,

    /** Base delay in milliseconds before first retry */
    RETRY_BASE_DELAY_MS: 60_000,

    /** Multiplier for exponential backoff on retries */
    RETRY_BACKOFF_MULTIPLIER: 5,

    /** Default sender email address */
    DEFAULT_FROM_EMAIL: 'noreply@hospeda.com.ar',

    /** Default sender name */
    DEFAULT_FROM_NAME: 'Hospeda',

    /** Redis key for notification retry queue */
    REDIS_RETRY_QUEUE_KEY: 'notifications:retry_queue',

    /** Time-to-live for retry queue entries in seconds (24 hours) */
    REDIS_RETRY_TTL_SECONDS: 86_400
} as const;
