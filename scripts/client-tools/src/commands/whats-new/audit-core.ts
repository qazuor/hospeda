import { classifyPr, type PrOutcome } from './classify.ts';
import { type ApiPr, parseMergeSubjectPrNumber, pickMergedPr, type RangeCommit } from './range.ts';

/** A commit in the range, together with every PR the GitHub API associates with it. */
export interface CommitResolution {
    /** The commit, as `git log` reported it. */
    readonly commit: RangeCommit;
    /**
     * PRs the API associates with this commit. Empty means a direct push: no
     * PR resolves this commit, which the branch workflow forbids.
     */
    readonly prs: readonly ApiPr[];
}

/** A PR, resolved and classified. */
export interface AuditedPr {
    /** The merge commit's SHA. */
    readonly sha: string;
    /** The PR the API resolved for this commit. */
    readonly pr: ApiPr;
    /** Its classification. */
    readonly outcome: PrOutcome;
}

/** A first-parent commit with no associated PR — a direct push to `staging`. */
export interface UnresolvedCommit {
    /** The commit's SHA. */
    readonly sha: string;
    /** Its subject line, for the report. */
    readonly subject: string;
}

/** A disagreement between the API's association and the merge-subject parse. */
export interface SubjectMismatch {
    /** The commit's SHA. */
    readonly sha: string;
    /** PR number the GitHub API associated with the commit (authoritative). */
    readonly apiNumber: number;
    /** PR number parsed from the merge-commit subject. */
    readonly subjectNumber: number;
}

/** The audit's full, classified result. */
export interface AuditResult {
    /** PRs carrying exactly one decision label. */
    readonly evaluated: readonly AuditedPr[];
    /** PRs carrying neither label — blocks. */
    readonly unlabeled: readonly AuditedPr[];
    /** PRs carrying both labels at once — blocks. */
    readonly conflicting: readonly AuditedPr[];
    /** PRs exempt because a bot authored them. */
    readonly botExempt: readonly AuditedPr[];
    /** PRs exempt because their merge commit predates the configured cutoff. */
    readonly preCutoff: readonly AuditedPr[];
    /** First-parent commits with no associated PR — direct pushes. Blocks. */
    readonly unresolvedCommits: readonly UnresolvedCommit[];
    /** API/subject disagreements, reported but never resolved automatically. */
    readonly mismatches: readonly SubjectMismatch[];
    /** Whether a cutoff SHA was configured at all (see `cutoff.ts`). */
    readonly cutoffConfigured: boolean;
}

/**
 * Builds the full audit result from resolved commits.
 *
 * Pure and synchronous on purpose: every `git`/`gh` call happens before this
 * runs, so the classification itself — the part with real decisions to get
 * right — is testable with plain fixtures and no network or filesystem.
 *
 * When the API associates more than one PR with a commit — measured, not
 * hypothetical: a still-open PR whose branch had been rebased onto a merge
 * commit shows up as "associated" alongside the PR that actually merged it —
 * {@link pickMergedPr} picks the one whose `merged_at` is set, never array
 * order, which the API does not document as stable.
 *
 * @param input.resolutions      - Every commit in the range, with its
 *                                  API-resolved PRs.
 * @param input.cutoffTimestamp  - Unix seconds for the configured cutoff, or
 *                                  `null` when none is configured.
 * @returns The {@link AuditResult}.
 */
export function buildAuditResult({
    resolutions,
    cutoffTimestamp
}: {
    readonly resolutions: readonly CommitResolution[];
    readonly cutoffTimestamp: number | null;
}): AuditResult {
    const evaluated: AuditedPr[] = [];
    const unlabeled: AuditedPr[] = [];
    const conflicting: AuditedPr[] = [];
    const botExempt: AuditedPr[] = [];
    const preCutoff: AuditedPr[] = [];
    const unresolvedCommits: UnresolvedCommit[] = [];
    const mismatches: SubjectMismatch[] = [];

    for (const { commit, prs } of resolutions) {
        if (prs.length === 0) {
            unresolvedCommits.push({ sha: commit.sha, subject: commit.subject });
            continue;
        }

        const pr = pickMergedPr({ prs });
        const subjectNumber = parseMergeSubjectPrNumber({ subject: commit.subject });
        if (subjectNumber !== null && subjectNumber !== pr.number) {
            mismatches.push({ sha: commit.sha, apiNumber: pr.number, subjectNumber });
        }

        const isPreCutoff = cutoffTimestamp !== null && commit.timestamp <= cutoffTimestamp;
        const outcome = classifyPr({ pr, preCutoff: isPreCutoff });
        const audited: AuditedPr = { sha: commit.sha, pr, outcome };

        if (outcome.kind === 'bot-exempt') botExempt.push(audited);
        else if (outcome.kind === 'pre-cutoff') preCutoff.push(audited);
        else if (outcome.kind === 'conflict') conflicting.push(audited);
        else if (outcome.kind === 'unlabeled') unlabeled.push(audited);
        else evaluated.push(audited);
    }

    return {
        evaluated,
        unlabeled,
        conflicting,
        botExempt,
        preCutoff,
        unresolvedCommits,
        mismatches,
        cutoffConfigured: cutoffTimestamp !== null
    };
}

/**
 * Whether an audit result blocks the promotion.
 *
 * @param input.result - The audit's classified result.
 * @returns `true` when any PR is unlabeled/conflicting, or any commit is a
 *          direct push.
 */
export function blocksPromotion({ result }: { readonly result: AuditResult }): boolean {
    return (
        result.unlabeled.length > 0 ||
        result.conflicting.length > 0 ||
        result.unresolvedCommits.length > 0
    );
}

/**
 * The audit's exit code, given a fully-resolved result.
 *
 * Only reachable once enumeration, repo resolution and every API call
 * succeeded — the `3` ("could not determine") path is decided earlier, in the
 * orchestration layer, before this function is ever called.
 *
 * @param input.result - The audit's classified result.
 * @returns `0` when clean, `1` when blocked.
 */
export function exitCodeForAudit({ result }: { readonly result: AuditResult }): number {
    return blocksPromotion({ result }) ? 1 : 0;
}
