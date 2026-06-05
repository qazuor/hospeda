import { ModerationStatusEnum } from '@repo/schemas';

/**
 * Content-moderation score at or above this threshold forces the review into
 * PENDING state regardless of the entity's per-type default.
 *
 * With the v1 stub engine a blocked-word/domain hit returns score = 1.0,
 * clean text returns 0.0. Any threshold in (0, 1] means a match → PENDING.
 * When the real graded engine lands (SPEC-195) the same threshold begins
 * producing proportional decisions with no code changes here.
 *
 * Set to 0.5 so that the stub binary result maps cleanly:
 *   - 0.0 (clean)  → below threshold → entity default applies
 *   - 1.0 (hit)    → at/above threshold → force PENDING
 */
export const MODERATION_PENDING_THRESHOLD = 0.5;

/**
 * Entity-type discriminator used by {@link resolveInitialModerationState} to
 * apply per-entity default policy (spec §3.1).
 *
 * - `accommodation` — semi-verified (reviewer opened a conversation with the
 *   host). Defaults to APPROVED. Future: verified post-stay → stays APPROVED.
 * - `destination`   — unverified (anyone can write). Must be human-moderated
 *   before public visibility.
 */
export type ReviewEntityType = 'accommodation' | 'destination';

/**
 * Verification level of the review author.
 *
 * - `'semi'`     — current accommodation default: reviewer contacted the host.
 * - `'verified'` — future reservation-system: reviewer completed a confirmed stay.
 * - `'none'`     — no transactional verification; used for destination reviews.
 */
export type ReviewVerificationLevel = 'semi' | 'verified' | 'none';

/**
 * Input for {@link resolveInitialModerationState}.
 */
export interface ResolveInitialModerationStateInput {
    /**
     * The entity type of the review being created.
     * Drives the per-entity default when the moderation score is below threshold.
     */
    readonly entityType: ReviewEntityType;

    /**
     * Verification level of the reviewing user.
     * `'verified'` always yields APPROVED regardless of entity type (future
     * reservation-system slot — no behaviour change until an actual reservation
     * system sets this value).
     */
    readonly verificationLevel: ReviewVerificationLevel;

    /**
     * Overall severity score from `@repo/content-moderation/moderateText`.
     * Range: 0..1. Values >= {@link MODERATION_PENDING_THRESHOLD} force PENDING.
     */
    readonly moderationScore: number;
}

/**
 * Resolves the initial `moderationState` for a new review.
 *
 * Decision tree (applied in priority order):
 * 1. `moderationScore >= PENDING_THRESHOLD` → `PENDING`
 *    Content-moderation hit forces human review regardless of entity type.
 * 2. `verificationLevel === 'verified'` → `APPROVED`
 *    Future reservation-verified reviews are pre-approved (Airbnb model).
 * 3. Entity-type default (spec §3.1):
 *    - `accommodation` → `APPROVED`  (semi-verified, publish immediately)
 *    - `destination`   → `PENDING`   (unverified, human gate required)
 *
 * @param input - Resolution inputs (entity type, verification level, score).
 * @returns The computed {@link ModerationStatusEnum} for the new review.
 *
 * @example
 * ```ts
 * // Clean accommodation review → APPROVED
 * resolveInitialModerationState({
 *   entityType: 'accommodation',
 *   verificationLevel: 'semi',
 *   moderationScore: 0,
 * }); // ModerationStatusEnum.APPROVED
 *
 * // Blocked-word destination review → PENDING (content-mod overrides default)
 * resolveInitialModerationState({
 *   entityType: 'destination',
 *   verificationLevel: 'none',
 *   moderationScore: 1.0,
 * }); // ModerationStatusEnum.PENDING
 *
 * // Blocked-word accommodation review → PENDING (content-mod overrides default)
 * resolveInitialModerationState({
 *   entityType: 'accommodation',
 *   verificationLevel: 'semi',
 *   moderationScore: 1.0,
 * }); // ModerationStatusEnum.PENDING
 *
 * // Verified-by-reservation review → APPROVED regardless of entity type
 * resolveInitialModerationState({
 *   entityType: 'destination',
 *   verificationLevel: 'verified',
 *   moderationScore: 0,
 * }); // ModerationStatusEnum.APPROVED
 * ```
 */
export function resolveInitialModerationState(
    input: ResolveInitialModerationStateInput
): ModerationStatusEnum {
    const { entityType, verificationLevel, moderationScore } = input;

    // Priority 1: content-moderation hit → force PENDING
    if (moderationScore >= MODERATION_PENDING_THRESHOLD) {
        return ModerationStatusEnum.PENDING;
    }

    // Priority 2: verified reviewer (future reservation system) → APPROVED
    if (verificationLevel === 'verified') {
        return ModerationStatusEnum.APPROVED;
    }

    // Priority 3: per-entity default
    if (entityType === 'accommodation') {
        return ModerationStatusEnum.APPROVED;
    }

    // entityType === 'destination' (and any future unknown type) → PENDING
    return ModerationStatusEnum.PENDING;
}
