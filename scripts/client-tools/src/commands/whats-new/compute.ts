import {
    type AuditResult,
    buildAuditResult,
    type CommitResolution,
    exitCodeForAudit
} from './audit-core.ts';
import { readCutoffSha } from './cutoff.ts';
import {
    enumerateFirstParentCommits,
    type PrResolution,
    type RangeCommit,
    readCommitTimestamp,
    resolvePrsForCommit,
    resolveRepoSlug
} from './range.ts';

/** What computing the audit returns: a result, or a reason it could not be determined. */
export type ComputeOutcome =
    | { readonly ok: true; readonly result: AuditResult }
    | { readonly ok: false; readonly reason: string };

/**
 * Every `git`/`gh` call `computeAudit` needs, as an injectable seam.
 *
 * Defaults to the real implementations in `range.ts` and `cutoff.ts`. Tests
 * override individual entries to simulate exactly one failure at a time —
 * most importantly a GitHub API outage (AC-13) — without spawning a real
 * `git`/`gh` process or depending on network access.
 */
export interface ComputeDeps {
    readonly enumerate: typeof enumerateFirstParentCommits;
    readonly resolveSlug: typeof resolveRepoSlug;
    readonly resolvePr: typeof resolvePrsForCommit;
    readonly readTimestamp: typeof readCommitTimestamp;
    readonly readCutoff: typeof readCutoffSha;
}

/** The real dependencies, used outside tests. */
export const REAL_DEPS: ComputeDeps = {
    enumerate: enumerateFirstParentCommits,
    resolveSlug: resolveRepoSlug,
    resolvePr: resolvePrsForCommit,
    readTimestamp: readCommitTimestamp,
    readCutoff: readCutoffSha
};

/**
 * Runs every `git`/`gh` call the audit needs and classifies the result.
 *
 * Every failure path here returns `ok: false`, which the caller (`audit.ts`)
 * turns into exit `3` — "could not determine" — NEVER exit `1`. This is
 * AC-13's whole point: a GitHub outage or an unresolvable range must never be
 * reported as "a PR was found unevaluated", because the remedy for that (go
 * label PRs) is not the remedy for an outage (wait and retry), and a false `1`
 * sends someone to fix PRs that were already fine.
 *
 * @param input.repoRoot - Repository root (where {@link readCutoffSha} reads
 *                          the single source of truth from).
 * @param input.cwd      - Directory to run `git`/`gh` from (may be a worktree).
 * @param input.deps     - Injectable seam, defaulting to {@link REAL_DEPS}.
 * @returns The {@link ComputeOutcome}.
 */
export async function computeAudit({
    repoRoot,
    cwd,
    deps = REAL_DEPS
}: {
    readonly repoRoot: string;
    readonly cwd: string;
    readonly deps?: ComputeDeps;
}): Promise<ComputeOutcome> {
    const commits = await deps.enumerate({ cwd });
    if (commits === null) {
        return {
            ok: false,
            reason:
                'No pude enumerar el rango (git log --first-parent origin/main..origin/staging falló). ' +
                '¿Los remotos están al día? Probá `git fetch origin main staging`.'
        };
    }

    const repoSlug = await deps.resolveSlug({ cwd });
    if (repoSlug === null) {
        return {
            ok: false,
            reason: 'No pude resolver el owner/repo vía `gh repo view`. Revisá `gh auth status`.'
        };
    }

    const cutoffSha = deps.readCutoff({ repoRoot });
    let cutoffTimestamp: number | null = null;
    if (cutoffSha !== null) {
        const timestamp = await deps.readTimestamp({ sha: cutoffSha, cwd });
        if (timestamp === null) {
            return {
                ok: false,
                reason:
                    `El cutoff configurado (${cutoffSha}) no resuelve a un commit. ` +
                    'Revisá scripts/whats-new-gate-cutoff.txt.'
            };
        }
        cutoffTimestamp = timestamp;
    }

    const resolutions: CommitResolution[] = [];
    for (const commit of commits) {
        const resolved: PrResolution = await deps.resolvePr({ sha: commit.sha, repoSlug, cwd });
        if (!resolved.ok) {
            return {
                ok: false,
                reason: `No pude consultar la API de GitHub para ${commit.sha}: ${firstLine({ text: resolved.error })}`
            };
        }
        resolutions.push({ commit, prs: resolved.prs });
    }

    return { ok: true, result: buildAuditResult({ resolutions, cutoffTimestamp }) };
}

/** First line of a (possibly multi-line) error message, for a one-line report. */
function firstLine({ text }: { readonly text: string }): string {
    return text.split('\n')[0] ?? text;
}

/**
 * The process exit code for a {@link ComputeOutcome} (AC-13).
 *
 * Pulled out as its own pure function, separate from `runWhatsNewAudit`'s
 * I/O, precisely so the `ok: false` → `3` mapping has a direct unit test
 * instead of living as an unverified one-liner inside the orchestrator. This
 * is the single place that decides "not knowing" from "blocked" — a `3` can
 * only come from here, and only when there is no {@link AuditResult} at all.
 *
 * @param input.outcome - What {@link computeAudit} returned.
 * @returns `3` when the audit could not be determined, otherwise the result's
 *          own exit code (`0` clean, `1` blocked).
 */
export function exitCodeForOutcome({ outcome }: { readonly outcome: ComputeOutcome }): number {
    if (!outcome.ok) return 3;
    return exitCodeForAudit({ result: outcome.result });
}

/** Re-exported for callers that only need the commit shape. */
export type { RangeCommit };
