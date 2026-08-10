/**
 * Tuned constants for the host-trade benefit usage + review domain (HOS-376).
 *
 * Every number here encodes a decision that was argued and can be re-argued.
 * They live in one module so the service, the crons, the schemas and the UI all
 * branch on the SAME value — the alternative is a "30 days" in the cron that
 * quietly stops matching the "30 days" the email promised.
 */

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * How long a confirmation request stays actionable before it expires.
 *
 * A month, because the counterpart is not waiting for this email and nothing
 * about it is urgent. An unconfirmed usage counts for nothing and triggers
 * nothing, so a long window costs only the declarer's patience — the pending
 * row simply takes longer to resolve.
 */
export const HOST_TRADE_USAGE_EXPIRY_DAYS = 30;

/**
 * When the single reminder goes out.
 *
 * One reminder, not a series: the recipient did not ask for this, and a second
 * or third nudge about someone else's paperwork reads as harassment. Day 10
 * leaves 20 days of runway, so the reminder is still actionable.
 */
export const HOST_TRADE_USAGE_REMINDER_DAYS = 10;

// ---------------------------------------------------------------------------
// Anti-collusion
// ---------------------------------------------------------------------------

/**
 * Rejections within {@link HOST_TRADE_REJECTION_WINDOW_DAYS} before a provider
 * loses the ability to declare usages.
 *
 * Above 1 deliberately: one rejection can be a misunderstanding or a mis-tap on
 * an email a host barely read. Suspension should take a pattern, not an
 * accident. Lifting it is an explicit admin action.
 */
export const HOST_TRADE_REJECTION_SUSPEND_THRESHOLD = 3;

/** Rolling window over which rejections accumulate toward the threshold. */
export const HOST_TRADE_REJECTION_WINDOW_DAYS = 90;

// ---------------------------------------------------------------------------
// Public display
// ---------------------------------------------------------------------------

/**
 * Reviews required before the directory shows a provider's average rating.
 *
 * Below this the card shows the count alone, with no star. With n=1 the
 * "average" is one person's opinion wearing a rating, and it would outrank a
 * provider carrying forty reviews and a 4.6.
 */
export const HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE = 3;

// ---------------------------------------------------------------------------
// Rating bounds
// ---------------------------------------------------------------------------

/**
 * Lowest selectable rating. Starts at 1, not 0, so "did not rate" and "rated
 * the lowest" never collapse into the same stored value.
 */
export const HOST_TRADE_REVIEW_RATING_MIN = 1;

/** Highest selectable rating. */
export const HOST_TRADE_REVIEW_RATING_MAX = 5;

// ---------------------------------------------------------------------------
// Text bounds
// ---------------------------------------------------------------------------

/** Free-text note the declarer may attach to a usage ("cambio de cerradura"). */
export const HOST_TRADE_USAGE_NOTE_MAX = 300;

/** Free-text note the rejecting party may attach when denying a usage. */
export const HOST_TRADE_USAGE_REJECTION_NOTE_MAX = 300;

/** Minimum length of a review body, when the host chooses to write one. */
export const HOST_TRADE_REVIEW_CONTENT_MIN = 10;

/** Maximum length of a review body. */
export const HOST_TRADE_REVIEW_CONTENT_MAX = 2000;

/** Minimum length of a provider's reply. */
export const HOST_TRADE_REVIEW_REPLY_MIN = 10;

/**
 * Maximum length of a provider's reply.
 *
 * Shorter than the review it answers, on purpose: the reply is a right of
 * response, not a platform for a longer counter-argument than the complaint.
 */
export const HOST_TRADE_REVIEW_REPLY_MAX = 1000;
