import type { SocialPlatformEnum } from '@repo/schemas';

/**
 * Hashtag count for each target platform of an incoming draft.
 * A platform absent from this map is not being targeted and is not checked.
 */
export type HashtagCountsByPlatform = Partial<Record<SocialPlatformEnum, number>>;

/**
 * Configured `max_hashtags_<platform>` value for each platform.
 * A platform absent from this map has no configured limit and is never
 * reported as a violation, regardless of its hashtag count.
 */
export type MaxHashtagsByPlatform = Partial<Record<SocialPlatformEnum, number>>;

/** One platform whose hashtag count exceeds its configured limit. */
export interface HashtagLimitViolation {
    platform: SocialPlatformEnum;
    /** Hashtag count found on the draft for this platform. */
    count: number;
    /** Configured `max_hashtags_<platform>` value. */
    max: number;
    /** How many hashtags over the limit the draft is (`count - max`). */
    excessBy: number;
}

export type HashtagLimitCheckResult =
    | { ok: true }
    | { ok: false; violations: HashtagLimitViolation[] };

/** Input for {@link checkHashtagLimits}. */
export interface CheckHashtagLimitsInput {
    countsByPlatform: HashtagCountsByPlatform;
    maxByPlatform: MaxHashtagsByPlatform;
}

/**
 * Pure validation: compares a draft's per-platform hashtag counts against the
 * configured `max_hashtags_<platform>` limits (HOS-64 / SPEC-297a G-1).
 *
 * No DB/IO — callers are responsible for resolving both maps (draft target
 * platforms + counts, and the current `social_settings` values) before
 * calling this function.
 *
 * @param input - The counts to check and the configured max per platform.
 * @returns `{ ok: true }` if every targeted platform is within its limit, or
 * `{ ok: false, violations }` listing each platform that exceeded its limit
 * and by how much. A platform with no configured max is never a violation.
 */
export function checkHashtagLimits(input: CheckHashtagLimitsInput): HashtagLimitCheckResult {
    const { countsByPlatform, maxByPlatform } = input;

    const violations: HashtagLimitViolation[] = [];

    for (const [platform, count] of Object.entries(countsByPlatform) as Array<
        [SocialPlatformEnum, number]
    >) {
        const max = maxByPlatform[platform];
        if (max === undefined) {
            continue;
        }
        if (count > max) {
            violations.push({ platform, count, max, excessBy: count - max });
        }
    }

    return violations.length > 0 ? { ok: false, violations } : { ok: true };
}
