/**
 * Today the deadlines table of the verticals half does not exist (it is born
 * in V6.9/V6.10), so version 1 of the initial values is a constant here; when
 * the table lands, this file is the only one that changes.
 *
 * PLAZO:5 — the pre-expiry campaign for trial (V4, AC:V4:4):
 * 10, 5, 2 and 0 days before the trial ends.
 */

/** The only version of the deadlines table at this time. */
export const TRIAL_DEADLINES_VERSION = 1 as const;

/** Pre-expiry campaign offsets (days before `endsAt`). */
export const PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS = [10, 5, 2, 0] as const;

/**
 * Computes the pre-expiry campaign milestones for a trial that ends at a given
 * instant. Returns new `Date` objects; does not mutate the argument.
 *
 * @param args - the trial end instant.
 * @returns The milestones in order: `endsAt - 10d`, `endsAt - 5d`, `endsAt - 2d`, `endsAt`.
 */
export function computePreExpiryMilestones(args: { readonly endsAt: Date }): readonly Date[] {
    return PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS.map(
        (days) => new Date(args.endsAt.getTime() - days * 86_400_000)
    );
}
