export enum ServiceErrorCode {
    /** Input validation failed */
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    /** Entity not found */
    NOT_FOUND = 'NOT_FOUND',
    /** User is not authenticated */
    UNAUTHORIZED = 'UNAUTHORIZED',
    /** User is not authorized to perform the action */
    FORBIDDEN = 'FORBIDDEN',
    /** Unexpected internal error */
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    /** Entity or assignment already exists */
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    /** Invalid pagination parameters provided */
    INVALID_PAGINATION_PARAMS = 'INVALID_PAGINATION_PARAMS',
    /**
     * Method is not implemented.
     * Use this code for public service methods that are stubs or not yet implemented.
     * Always return this error via the homogeneous pipeline (runWithLoggingAndValidation).
     */
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    /** External service or dependency is not available or not configured */
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    /** Service method called without required configuration */
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    /** Per-user quota limit exceeded (e.g. USER tag quota) */
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    /**
     * Plan-based usage limit reached (e.g. MAX_ACCOMMODATIONS, MAX_PHOTOS_PER_ACCOMMODATION).
     * Used by the API-layer limit enforcement middlewares (`enforce*Limit`) when the
     * user has hit the cap defined by their current plan. Distinct from QUOTA_EXCEEDED
     * which models a per-user soft cap unrelated to a billing plan.
     */
    LIMIT_REACHED = 'LIMIT_REACHED',
    /**
     * Plan-based entitlement not granted (e.g. CAN_USE_RICH_DESCRIPTION).
     * Used by the API-layer entitlement enforcement middlewares (`gate*`) when the
     * user's current plan does not include the entitlement required by the action.
     */
    ENTITLEMENT_REQUIRED = 'ENTITLEMENT_REQUIRED',
    /**
     * Upstream payment-provider returned an unexpected error response.
     * Maps to HTTP 502 Bad Gateway. The `details` field may carry a `retryAfter`
     * hint (seconds) when the provider includes one in its error response.
     */
    PROVIDER_ERROR = 'PROVIDER_ERROR',
    /**
     * Upstream payment-provider is throttling requests (rate-limit hit on our
     * side against the provider). Maps to HTTP 503 Service Unavailable. The
     * `details` field may carry a `retryAfter` hint (seconds).
     */
    PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
    /**
     * Upstream payment-provider did not respond within the configured timeout.
     * Maps to HTTP 504 Gateway Timeout. The `details` field may carry a
     * `retryAfter` hint (seconds) for client-side back-off.
     */
    PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT'
}
