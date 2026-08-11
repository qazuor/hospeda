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
    PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
    /**
     * The billing plan targeted by the operation has been disabled (retired).
     * Maps to HTTP 410 Gone — the resource existed but is no longer available.
     * Clients should treat this as a permanent condition and not retry without
     * selecting a different plan.
     */
    PLAN_DISABLED = 'PLAN_DISABLED',
    /**
     * The requested entity existed but has been (soft-)deleted and is permanently
     * gone. Maps to HTTP 410 Gone — distinct from NOT_FOUND (404, never existed).
     * Emitted on public reads of a soft-deleted accommodation/post/gastronomy/
     * experience so crawlers and LLM fetchers deindex the URL fast instead of
     * treating it as a transient 404. Clients should not retry.
     */
    GONE = 'GONE',

    // -----------------------------------------------------------------------
    // Host-trade benefit usage + reviews (HOS-376 §7.5)
    //
    // These are domain codes rather than reuses of NOT_FOUND / FORBIDDEN /
    // ALREADY_EXISTS because the spec's acceptance criteria name the CODE in the
    // response ("responde 403 DECLARATION_BLOCKED"), so it has to reach the
    // client intact. A generic FORBIDDEN plus a detail field would leave the UI
    // unable to tell "you already reviewed this provider" from "you never used
    // their benefit" — two refusals with completely different next steps.
    // -----------------------------------------------------------------------

    /**
     * The email a provider typed does not resolve to a host. Maps to HTTP 404.
     *
     * Deliberately explicit rather than opaque: a typo is the most common way
     * this path fails, and hiding it behind a generic answer makes the provider
     * wait out a thirty-day pending row that was never going to resolve.
     */
    HOST_NOT_FOUND = 'HOST_NOT_FOUND',

    /** A PENDING usage already exists for this (provider, host) pair. HTTP 409. */
    USAGE_PENDING_EXISTS = 'USAGE_PENDING_EXISTS',

    /** A standing rejection blocks this provider from declaring on this host. HTTP 403. */
    DECLARATION_BLOCKED = 'DECLARATION_BLOCKED',

    /** The provider crossed the rejection threshold and may not declare. HTTP 403. */
    DECLARATION_SUSPENDED = 'DECLARATION_SUSPENDED',

    /** Reviewing requires a confirmed usage with that provider first. HTTP 403. */
    NO_CONFIRMED_USAGE = 'NO_CONFIRMED_USAGE',

    /** The actor owns the listing they are trying to review. HTTP 403. */
    SELF_REVIEW_FORBIDDEN = 'SELF_REVIEW_FORBIDDEN',

    /**
     * The actor owns the listing they are declaring a usage on. HTTP 403.
     *
     * The sibling of {@link SELF_REVIEW_FORBIDDEN}, one step earlier in the
     * flow. Reviewing already required not owning the listing, but declaring did
     * not — so an owner could open a usage on himself. It could never be
     * confirmed (neither side is offered the button), leaving an unresolvable
     * PENDING row, and declaring is the step that feeds `confirmedUsesCount` and
     * `distinctHostsCount`: the two numbers the directory ranks providers by.
     */
    SELF_USAGE_FORBIDDEN = 'SELF_USAGE_FORBIDDEN',

    /** This host already reviewed this provider; one client, one voice. HTTP 409. */
    REVIEW_ALREADY_EXISTS = 'REVIEW_ALREADY_EXISTS',

    /**
     * The provider listing is revoked, so it accepts no new usages or reviews.
     * Maps to HTTP 422 — the request was well-formed and the listing still
     * exists (a revoked row is kept, unlike a deleted one), but its state makes
     * the action meaningless.
     */
    PROVIDER_REVOKED = 'PROVIDER_REVOKED'
}
