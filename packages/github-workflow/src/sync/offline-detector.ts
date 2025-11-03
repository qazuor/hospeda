/**
 * Offline connectivity detector
 *
 * Detects network errors and provides retry logic with exponential backoff.
 *
 * @module sync/offline-detector
 */

/**
 * Network error codes that indicate offline status
 */
const NETWORK_ERROR_CODES = [
    'ENOTFOUND', // DNS lookup failed
    'ECONNREFUSED', // Connection refused
    'ETIMEDOUT', // Connection timeout
    'ENETUNREACH', // Network unreachable
    'EHOSTUNREACH', // Host unreachable
    'ECONNRESET' // Connection reset
];

/**
 * Error messages that indicate network issues
 */
const NETWORK_ERROR_MESSAGES = [
    'network',
    'timeout',
    'offline',
    'connect',
    'connection',
    'fetch failed',
    'request failed'
];

/**
 * Offline detector options
 */
export type OfflineDetectorOptions = {
    /** Base delay in milliseconds (default: 1000) */
    baseDelay?: number;

    /** Maximum backoff in milliseconds (default: 60000 = 1 minute) */
    maxBackoff?: number;

    /** Maximum retry attempts (default: 5) */
    maxRetries?: number;
};

/**
 * Default detector options
 */
const DEFAULT_OPTIONS: Required<OfflineDetectorOptions> = {
    baseDelay: 1000,
    maxBackoff: 60000,
    maxRetries: 5
};

/**
 * Offline connectivity detector
 *
 * Provides functionality to detect network errors and calculate
 * retry delays with exponential backoff.
 *
 * @example
 * ```typescript
 * const detector = new OfflineDetector();
 *
 * try {
 *   await githubClient.createIssue(data);
 * } catch (error) {
 *   if (detector.isNetworkError(error)) {
 *     const delay = detector.calculateBackoff(attemptNumber);
 *     await sleep(delay);
 *     // Retry operation
 *   }
 * }
 * ```
 */
export class OfflineDetector {
    private readonly options: Required<OfflineDetectorOptions>;

    /**
     * Create a new offline detector
     *
     * @param options - Detector options
     */
    constructor(options?: OfflineDetectorOptions) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Check if error is a network error
     *
     * Detects errors caused by network connectivity issues.
     *
     * @param error - Error to check
     * @returns True if network error
     *
     * @example
     * ```typescript
     * try {
     *   await apiCall();
     * } catch (error) {
     *   if (detector.isNetworkError(error)) {
     *     console.log('Network issue detected');
     *   }
     * }
     * ```
     */
    isNetworkError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        // Check error code
        const errorCode = (error as { code?: string }).code;
        if (errorCode && NETWORK_ERROR_CODES.includes(errorCode)) {
            return true;
        }

        // Check error message
        const message = error.message.toLowerCase();
        return NETWORK_ERROR_MESSAGES.some((keyword) => message.includes(keyword));
    }

    /**
     * Calculate backoff delay for retry
     *
     * Uses exponential backoff with jitter to avoid thundering herd.
     *
     * @param attemptNumber - Attempt number (0-based)
     * @returns Delay in milliseconds
     *
     * @example
     * ```typescript
     * const delay = detector.calculateBackoff(3); // ~8 seconds
     * await sleep(delay);
     * ```
     */
    calculateBackoff(attemptNumber: number): number {
        // Exponential backoff: delay = baseDelay * 2^attemptNumber
        const exponentialDelay = this.options.baseDelay * 2 ** attemptNumber;

        // Cap at max backoff
        const cappedDelay = Math.min(exponentialDelay, this.options.maxBackoff);

        // Add jitter (±10%) to avoid thundering herd
        const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);

        return Math.floor(cappedDelay + jitter);
    }

    /**
     * Check if should retry operation
     *
     * @param attemptNumber - Current attempt number (0-based)
     * @returns True if should retry
     *
     * @example
     * ```typescript
     * let attempts = 0;
     * while (detector.shouldRetry(attempts)) {
     *   try {
     *     await operation();
     *     break;
     *   } catch (error) {
     *     attempts++;
     *     await sleep(detector.calculateBackoff(attempts));
     *   }
     * }
     * ```
     */
    shouldRetry(attemptNumber: number): boolean {
        return attemptNumber < this.options.maxRetries;
    }
}
