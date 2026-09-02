import { classifyCheck, type PrStatus, type RawCheck } from '../commands/ci/verdict.ts';
import { run } from './exec.ts';

/**
 * A pull request, with everything the merge gate needs on top of its checks.
 *
 * One fetcher serves both `ci` and `merge` deliberately: two queries asking
 * near-identical questions drift, and the day they disagree neither is
 * obviously the wrong one.
 */
export interface PrSnapshot extends PrStatus {
    /** `CLEAN` / `BEHIND` / `BLOCKED` / `DIRTY` / `UNSTABLE` / `UNKNOWN`. */
    readonly mergeStateStatus: string;
    /** Whether the pull request is still a draft. */
    readonly isDraft: boolean;
    /** Branch this pull request would merge into. */
    readonly baseRefName: string;
    /** Pull request title. */
    readonly title: string;
}

/** What one lookup returns: a snapshot, no pull request, or a failure. */
export type PrLookup = PrSnapshot | 'none' | { readonly error: string };

/**
 * Runs `gh` with the ambient token cleared.
 *
 * A stale `GITHUB_TOKEN` in the shell wins over `gh`'s own stored credentials
 * and every call answers 401 — which, read as "no data", becomes a confident
 * "no hay PR" for a branch that has one. Measured: this repo's flows all clear
 * it for the same reason.
 *
 * @param input.args - Arguments passed to `gh`.
 * @param input.cwd  - Repository directory to run in.
 * @returns The captured result.
 */
export async function gh({
    args,
    cwd
}: {
    readonly args: readonly string[];
    readonly cwd: string;
}): Promise<{ readonly ok: boolean; readonly stdout: string; readonly error: string }> {
    return await run({ command: 'gh', args, cwd, timeoutMs: 120_000, env: { GITHUB_TOKEN: '' } });
}

/** The fields asked of `gh pr list`. */
const PR_FIELDS = 'number,state,mergeable,mergeStateStatus,isDraft,baseRefName,title,statusCheckRollup';

/**
 * Reads the pull request for a branch, if there is one.
 *
 * @param input.branch - Branch to look up.
 * @param input.cwd    - Repository directory to run in.
 * @returns The {@link PrLookup}.
 */
export async function findPr({
    branch,
    cwd
}: {
    readonly branch: string;
    readonly cwd: string;
}): Promise<PrLookup> {
    const listed = await gh({
        args: ['pr', 'list', '--head', branch, '--state', 'all', '--limit', '1', '--json', PR_FIELDS],
        cwd
    });
    // A failed query is NOT "no pull request": saying so would report a branch
    // as PR-less because a credential expired.
    if (!listed.ok) return { error: listed.error };

    let parsed: readonly {
        number?: number;
        state?: string;
        mergeable?: string;
        mergeStateStatus?: string;
        isDraft?: boolean;
        baseRefName?: string;
        title?: string;
        statusCheckRollup?: readonly RawCheck[] | null;
    }[];
    try {
        parsed = JSON.parse(listed.stdout) as typeof parsed;
    } catch {
        return { error: 'gh devolvió algo que no pude interpretar' };
    }
    const pr = parsed[0];
    if (pr?.number === undefined) return 'none';

    return {
        number: pr.number,
        state: pr.state ?? 'UNKNOWN',
        // Absent is UNKNOWN, never MERGEABLE: GitHub computes both of these
        // lazily and answers UNKNOWN on the first ask, so a default of
        // "mergeable" would wave through the very first query every time.
        mergeable: pr.mergeable ?? 'UNKNOWN',
        mergeStateStatus: pr.mergeStateStatus ?? 'UNKNOWN',
        isDraft: pr.isDraft ?? false,
        baseRefName: pr.baseRefName ?? '',
        title: pr.title ?? '',
        checks: (pr.statusCheckRollup ?? []).map((raw) => classifyCheck({ raw }))
    };
}
