import { isBotAuthor, WHATS_NEW_DONE_LABEL, WHATS_NEW_NONE_LABEL } from './labels.ts';

/** The minimal shape `classifyPr` needs from a resolved pull request. */
export interface ClassifiablePr {
    /** PR author's login, as GitHub reports it. */
    readonly author: string;
    /** Labels currently on the PR. */
    readonly labels: readonly string[];
}

/**
 * The five ways a PR can come out of the audit (HOS-1214 §6.2).
 *
 * `bot-exempt` and `pre-cutoff` never block, regardless of labels. `evaluated`
 * never blocks. `conflict` and `unlabeled` both block, for different reasons:
 * a conflict has too many decisions, an unlabeled PR has none.
 */
export type PrOutcomeKind = 'evaluated' | 'conflict' | 'unlabeled' | 'bot-exempt' | 'pre-cutoff';

/** The classification result for one PR. */
export interface PrOutcome {
    /** Which of the five buckets this PR falls into. */
    readonly kind: PrOutcomeKind;
    /** The single decision label, present only when `kind === 'evaluated'`. */
    readonly label?: typeof WHATS_NEW_NONE_LABEL | typeof WHATS_NEW_DONE_LABEL;
}

/**
 * Classifies one PR for the What's New promotion gate.
 *
 * Order matters and is deliberate: an exemption (bot author, pre-cutoff)
 * always wins over the label state, because a PR from before this system
 * existed — or one a bot opened — was never a candidate for a novelty
 * decision in the first place. Checking labels first would report a
 * dependabot PR as "unlabeled" instead of "exempt", which is a true fact
 * that leads to the wrong remedy (there is nothing to label).
 *
 * @param input.pr        - The PR's author and current labels.
 * @param input.preCutoff - Whether this PR's merge commit predates the
 *                           configured cutoff (see `cutoff.ts`).
 * @returns The {@link PrOutcome}.
 */
export function classifyPr({
    pr,
    preCutoff
}: {
    readonly pr: ClassifiablePr;
    readonly preCutoff: boolean;
}): PrOutcome {
    if (isBotAuthor({ author: pr.author })) return { kind: 'bot-exempt' };
    if (preCutoff) return { kind: 'pre-cutoff' };

    const hasNone = pr.labels.includes(WHATS_NEW_NONE_LABEL);
    const hasDone = pr.labels.includes(WHATS_NEW_DONE_LABEL);

    // Both together is a conflict, not a double-evaluation: the two labels are
    // mutually exclusive by definition (D-2), so having both means the state
    // is wrong, not merely redundant.
    if (hasNone && hasDone) return { kind: 'conflict' };
    if (hasNone) return { kind: 'evaluated', label: WHATS_NEW_NONE_LABEL };
    if (hasDone) return { kind: 'evaluated', label: WHATS_NEW_DONE_LABEL };
    return { kind: 'unlabeled' };
}

/**
 * Whether a classified outcome blocks the promotion.
 *
 * @param input.outcome - A PR's classification.
 * @returns `true` for `conflict` and `unlabeled` only.
 */
export function outcomeBlocks({ outcome }: { readonly outcome: PrOutcome }): boolean {
    return outcome.kind === 'conflict' || outcome.kind === 'unlabeled';
}
