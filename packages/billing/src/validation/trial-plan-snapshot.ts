/**
 * @file trial-plan-snapshot.ts
 * @description The snapshot-vs-composition guard for composed trial plans
 * (HOS-1012 T-036, spec §6.8).
 *
 * ## The invariant, and it only runs one way
 *
 * > **The snapshot is for showing. The composition is for gating.** If the two
 * > ever diverge, what goes stale is a screen, never a door.
 *
 * A trial plan row stores `pro`'s entitlements and `basico`'s limits so that any
 * reader showing plan information to a human — the admin billing view, the
 * downgrade preview — sees something sensible instead of an empty plan, which
 * would read as *unlimited*. Nothing gates on it: `loadEntitlements` resolves
 * the composition live.
 *
 * ## Why this takes ROWS and not config constants
 *
 * Because a guard that compares config with config agrees with itself and proves
 * nothing. HOS-39's Model C makes `limitsValues` and `entitlements` COMMERCIAL:
 * the database wins, the seed deliberately does not sync them from config, and
 * the admin `PlanDialog` edits them. So the only drift this guard exists to
 * catch — an operator raising `owner-basico`'s photo cap, or granting
 * `owner-pro` a new entitlement — exists ONLY in the database and is invisible
 * to anything reading `plans.config.ts`.
 *
 * Hence the signature: hand it the rows you actually resolved.
 *
 * ## Why it reports rather than throws
 *
 * A divergence here is expected and harmless: the operator edit that caused it
 * is a supported action, and the door it might have opened was never wired to
 * the snapshot. Turning that into a hard failure would fail the seed on a
 * legitimate price-list change. What it is good for is telling someone that the
 * admin screen is now showing a number the trial does not actually enforce.
 */
import { composeTrialGrants, readTrialComposition } from '../config/trial-plans.config.js';

/**
 * A `billing_plans` row as far as this guard is concerned — the shape both
 * `getPlanBySlug` (`BillingPlanResponse`) and a raw Drizzle select satisfy.
 */
export interface TrialSnapshotPlanRow {
    /** The plan's slug — `billing_plans.name`. The table has no `slug` column. */
    readonly slug: string;
    /** The row's stored entitlements. */
    readonly entitlements?: readonly string[] | null;
    /** The row's stored limits. */
    readonly limits?: Readonly<Record<string, number>> | null;
    /** The row's `metadata` JSONB, where `trialComposition` lives. */
    readonly metadata?: unknown;
}

/** One way in which a trial plan's snapshot disagrees with its composition. */
export interface TrialSnapshotDivergence {
    /** The trial plan whose snapshot is stale. */
    readonly trialPlanSlug: string;
    /**
     * What is wrong:
     * - `'entitlements'` / `'limits'` — the snapshot half differs from what the
     *   corresponding source row currently holds.
     * - `'missing-source'` — a source named by the composition was not among the
     *   rows supplied. Reported rather than ignored: a composition pointing at a
     *   plan that no longer exists is the one case where the trial really does
     *   fall back to its snapshot at gate time.
     */
    readonly kind: 'entitlements' | 'limits' | 'missing-source';
    /** The source plan slug this divergence concerns. */
    readonly sourceSlug: string;
    /** What the composition resolves today. Absent for `'missing-source'`. */
    readonly composed?: unknown;
    /** What the trial plan row stores. Absent for `'missing-source'`. */
    readonly snapshot?: unknown;
}

/** Sorted, so two equal sets never differ merely by insertion order. */
function normaliseEntitlements(value: readonly string[] | null | undefined): string[] {
    return [...(value ?? [])].sort();
}

/** Key-sorted, for the same reason. */
function normaliseLimits(
    value: Readonly<Record<string, number>> | null | undefined
): Array<[string, number]> {
    return Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Finds every way the supplied trial plan rows' snapshots disagree with what
 * their compositions resolve, against those same rows.
 *
 * Rows that declare no `metadata.trialComposition` are ignored — this asks
 * nothing of an ordinary plan.
 *
 * @param input.rows - Every plan row to consider: the trial plans AND the source
 *   plans their compositions name. Resolution happens within this set, by slug,
 *   so the caller decides what "live" means (a DB read, a fixture, a fake).
 * @returns Every divergence found; an empty array means the snapshots agree.
 */
export function findTrialSnapshotDivergences(input: {
    readonly rows: readonly TrialSnapshotPlanRow[];
}): readonly TrialSnapshotDivergence[] {
    const bySlug = new Map(input.rows.map((r) => [r.slug, r]));
    const divergences: TrialSnapshotDivergence[] = [];

    for (const row of input.rows) {
        const composition = readTrialComposition(row.metadata);
        if (!composition) {
            continue;
        }

        const entitlementsSource = bySlug.get(composition.entitlementsFrom);
        const limitsSource = bySlug.get(composition.limitsFrom);

        if (!entitlementsSource) {
            divergences.push({
                trialPlanSlug: row.slug,
                kind: 'missing-source',
                sourceSlug: composition.entitlementsFrom
            });
        }
        if (!limitsSource) {
            divergences.push({
                trialPlanSlug: row.slug,
                kind: 'missing-source',
                sourceSlug: composition.limitsFrom
            });
        }
        if (!entitlementsSource || !limitsSource) {
            continue;
        }

        const composed = composeTrialGrants({ entitlementsSource, limitsSource });

        const composedEntitlements = normaliseEntitlements(composed.entitlements);
        const snapshotEntitlements = normaliseEntitlements(row.entitlements);
        if (JSON.stringify(composedEntitlements) !== JSON.stringify(snapshotEntitlements)) {
            divergences.push({
                trialPlanSlug: row.slug,
                kind: 'entitlements',
                sourceSlug: composition.entitlementsFrom,
                composed: composedEntitlements,
                snapshot: snapshotEntitlements
            });
        }

        const composedLimits = normaliseLimits(composed.limits);
        const snapshotLimits = normaliseLimits(row.limits);
        if (JSON.stringify(composedLimits) !== JSON.stringify(snapshotLimits)) {
            divergences.push({
                trialPlanSlug: row.slug,
                kind: 'limits',
                sourceSlug: composition.limitsFrom,
                composed: composedLimits,
                snapshot: snapshotLimits
            });
        }
    }

    return divergences;
}

/**
 * Renders divergences as one human-readable line each, for a seed/cron log.
 *
 * @param divergences - The result of {@link findTrialSnapshotDivergences}.
 * @returns One line per divergence.
 */
export function describeTrialSnapshotDivergences(
    divergences: readonly TrialSnapshotDivergence[]
): string[] {
    return divergences.map((d) => {
        if (d.kind === 'missing-source') {
            return `Trial plan "${d.trialPlanSlug}" composes from "${d.sourceSlug}", which was not found — it will gate on its own snapshot until that plan exists.`;
        }
        return `Trial plan "${d.trialPlanSlug}" snapshot ${d.kind} is stale against "${d.sourceSlug}": gating uses ${JSON.stringify(d.composed)}, the row shows ${JSON.stringify(d.snapshot)}.`;
    });
}
