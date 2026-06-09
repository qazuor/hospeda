import { MODERATION_PENDING_THRESHOLD } from '@repo/content-moderation';
import { ModerationStatusEnum } from '@repo/schemas';

export { MODERATION_PENDING_THRESHOLD };

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

    /**
     * DB-backed pending threshold for the current context.
     * When provided, overrides the package-level {@link MODERATION_PENDING_THRESHOLD}
     * constant so that admin-edited thresholds take effect immediately.
     * Callers fetch this via `getThresholdForContext({ context })` and pass the
     * resolved `.pending` value here. Falls back to `MODERATION_PENDING_THRESHOLD`
     * when omitted (backwards-compatible).
     */
    readonly pendingThreshold?: number;
}

/**
 * Resolves the initial `moderationState` for a new review.
 *
 * Decision tree (applied in priority order):
 * 1. `moderationScore >= pendingThreshold` → `PENDING`
 *    Content-moderation hit forces human review regardless of entity type.
 *    The effective threshold is `input.pendingThreshold ?? MODERATION_PENDING_THRESHOLD`,
 *    allowing callers to inject a DB-backed admin-editable value.
 * 2. `verificationLevel === 'verified'` → `APPROVED`
 *    Future reservation-verified reviews are pre-approved (Airbnb model).
 * 3. Entity-type default (spec §3.1):
 *    - `accommodation` → `APPROVED`  (semi-verified, publish immediately)
 *    - `destination`   → `PENDING`   (unverified, human gate required)
 *
 * @param input - Resolution inputs (entity type, verification level, score, optional DB threshold).
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
 * // DB-backed threshold at 0.8 → score 0.6 does not trigger PENDING
 * resolveInitialModerationState({
 *   entityType: 'accommodation',
 *   verificationLevel: 'semi',
 *   moderationScore: 0.6,
 *   pendingThreshold: 0.8,
 * }); // ModerationStatusEnum.APPROVED
 * ```
 */
export function resolveInitialModerationState(
    input: ResolveInitialModerationStateInput
): ModerationStatusEnum {
    const { entityType, verificationLevel, moderationScore, pendingThreshold } = input;
    const effectiveThreshold = pendingThreshold ?? MODERATION_PENDING_THRESHOLD;

    // Priority 1: content-moderation hit → force PENDING
    if (moderationScore >= effectiveThreshold) {
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
