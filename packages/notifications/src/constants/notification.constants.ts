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

/**
 * Email outbox sender constants (HOS-1423, unit U2).
 *
 * Kept apart from {@link NOTIFICATION_CONSTANTS}: `MAX_RETRY_ATTEMPTS` there
 * (3) governs the legacy Redis retry queue, which the outbox does not use.
 */
export const EMAIL_OUTBOX_CONSTANTS = {
    /**
     * Delivery attempts after which an outbox row is definitively `failed`.
     * A transactional row that reaches it is escalated (NUCLEO/07 §1.3).
     */
    MAX_ATTEMPTS: 5,

    /**
     * Commercial mails one recipient may be SENT in the cap window. A third
     * vertical's win-back on the same day is exactly what the cap stops
     * ("suprimir dos de tres", HOS-1353 11-trial §6.2), so the cap is one.
     * Transactional mail is never counted nor capped (NUCLEO/07 §4.2).
     */
    DAILY_COMMERCIAL_CAP_PER_RECIPIENT: 1,

    /**
     * Length of the cap window: a rolling 24 hours. U2.3 replaces it with the
     * calendar day of the market time zone (America/Argentina/Buenos_Aires).
     */
    DAILY_CAP_WINDOW_MS: 24 * 60 * 60 * 1000
} as const;
