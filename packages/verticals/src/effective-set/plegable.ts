/**
 * The discard of the plegable set (HOS-1439, V3, AC:V3:2; `V/15` §2.6): what is
 * folded is the coverage set MINUS the complements when no live TITLE other
 * than a TRIAL is present.
 *
 * `cobertura(user, vertical)` returns every live source, of the three classes,
 * on purpose (contract §2.1 and §2.4): the loss notice and the reconciler need
 * to see them all. The discard lives where the fold executes, not in the
 * contract: a rule that lives only in a sentence is not a gate. GUARD:G-R2
 * watches this condition (`scripts/check-plegable-discard.ts`).
 */
import { type CoverageSource, coverageSourceClassOf } from '@repo/billing-verticals-contract';
import type { FoldableSource } from './types';

/**
 * Whether the set carries a live TITLE that is not a TRIAL.
 *
 * A running trial IS a TITLE (contract §2.4), but it does not admit complements:
 * an ADDON `USER` or `GLOBAL` bought with another vertical's subscription would
 * then add in the trial's vertical, which the trial's own rule forbids
 * (`V/11` §5.3). Without a title like this one, the complements are discarded
 * before any of the four strategies folds them.
 *
 * @param args.sources - The live sources of the coverage set.
 * @returns `true` when at least one live non-TRIAL TITLE exists.
 */
export function hasLiveNonTrialTitle({
    sources
}: {
    readonly sources: readonly CoverageSource[];
}): boolean {
    return sources.some(
        (source) =>
            coverageSourceClassOf({ source }).sourceClass === 'TITLE' && source.type !== 'TRIAL'
    );
}

/**
 * The plegable set of a `user + vertical`: TITLE and BASE always, COMPLEMENT only
 * when {@link hasLiveNonTrialTitle} holds, and a TRIAL only while no live
 * SUBSCRIPTION title is present.
 *
 * The TRIAL rule (HOS-2027, owner decision 2026-11-04): a subscription supersedes
 * the trial of its vertical. Folding both summed `SUM` keys such as
 * `max_accommodations` (trial 1 + plan 1 = 2) for the window between subscribing
 * and the trial's conversion, which restored a listing the billing had
 * unpublished and then trimmed the owner's newest one once the trial left. The
 * set comes from `billing.coverage(user, vertical)`, so its sources are of that
 * vertical, except the Tourist VIP inheritance the resolver injects from another
 * vertical: that source is marked `foreignVertical` and never supersedes a trial.
 * If the subscription title goes away the
 * trial contributes again. `cobertura` still lists the TRIAL (contract §2.1).
 *
 * @param args.sources - The live sources of the coverage set, with their values.
 * @returns The sources the four aggregation strategies fold.
 */
export function selectPlegableSources({
    sources
}: {
    readonly sources: readonly FoldableSource[];
}): readonly FoldableSource[] {
    const hasSubscriptionTitle = sources.some(
        ({ source, foreignVertical }) =>
            foreignVertical !== true &&
            source.type === 'SUBSCRIPTION' &&
            coverageSourceClassOf({ source }).sourceClass === 'TITLE'
    );
    const admitsComplements = hasLiveNonTrialTitle({
        sources: sources.map(({ source }) => source)
    });
    return sources.filter(({ source }) => {
        if (source.type === 'TRIAL' && hasSubscriptionTitle) return false;
        return coverageSourceClassOf({ source }).sourceClass !== 'COMPLEMENT' || admitsComplements;
    });
}
