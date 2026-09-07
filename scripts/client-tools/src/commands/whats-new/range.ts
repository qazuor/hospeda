import { run } from '../../lib/exec.ts';
import { gh } from '../../lib/github.ts';

/**
 * The commit range the audit enumerates (HOS-1214 §6.2, F-7).
 *
 * `git log --first-parent` over exactly this range yields one commit per PR
 * merged into `staging` and not yet promoted to `main` — the branch workflow
 * mandates `gh pr merge --merge` (`--no-ff`), so every merge produces a
 * first-parent commit and nothing else does.
 */
export const RANGE = 'origin/main..origin/staging';

/** Record separator inserted between commits (ASCII RS, 0x1e). */
const RECORD_SEP = '\x1e';
/** Field separator inserted between a commit's fields (ASCII US, 0x1f). */
const FIELD_SEP = '\x1f';

/** One commit in the range, as `git log` reports it. */
export interface RangeCommit {
    /** Full 40-character commit SHA. */
    readonly sha: string;
    /** Committer date, Unix seconds — used for the pre-cutoff comparison. */
    readonly timestamp: number;
    /** The commit's subject line (first line of the message). */
    readonly subject: string;
}

/**
 * Enumerates the first-parent commits in {@link RANGE}, one per merged PR.
 *
 * `%H`/`%ct`/`%s` are joined with control-character separators that cannot
 * appear in a commit subject, so a subject containing `|` or any other
 * "safe-looking" delimiter cannot corrupt the parse.
 *
 * @param input.cwd   - Repository directory to run `git` from.
 * @param input.range - Override for tests; defaults to {@link RANGE}.
 * @returns The commits, oldest-parse-order as `git log` reports them, or
 *          `null` when the range could not be read at all (AC-13: this is a
 *          "cannot determine", never a silent empty range).
 */
export async function enumerateFirstParentCommits({
    cwd,
    range = RANGE
}: {
    readonly cwd: string;
    readonly range?: string;
}): Promise<readonly RangeCommit[] | null> {
    const result = await run({
        command: 'git',
        args: [
            'log',
            '--first-parent',
            `--format=%H${FIELD_SEP}%ct${FIELD_SEP}%s${RECORD_SEP}`,
            range
        ],
        cwd,
        timeoutMs: 60_000
    });
    if (!result.ok) return null;

    const commits: RangeCommit[] = [];
    for (const record of result.stdout.split(RECORD_SEP)) {
        if (record.trim().length === 0) continue;
        const [sha, ctRaw, ...subjectParts] = record.replace(/^\n/, '').split(FIELD_SEP);
        const ct = Number(ctRaw);
        if (sha === undefined || !Number.isFinite(ct)) continue;
        commits.push({ sha, timestamp: ct, subject: subjectParts.join(FIELD_SEP).trim() });
    }
    return commits;
}

/**
 * Reads a single commit's committer timestamp.
 *
 * Used for the cutoff SHA itself, which may or may not appear in
 * {@link RANGE} (once `staging` promotes past it, it falls out of range) —
 * so it needs its own lookup rather than being found inside the enumerated
 * list.
 *
 * @param input.sha - Commit to look up.
 * @param input.cwd - Repository directory to run `git` from.
 * @returns Unix seconds, or `null` when the SHA does not resolve.
 */
export async function readCommitTimestamp({
    sha,
    cwd
}: {
    readonly sha: string;
    readonly cwd: string;
}): Promise<number | null> {
    const result = await run({
        command: 'git',
        args: ['log', '-1', '--format=%ct', sha],
        cwd,
        timeoutMs: 30_000
    });
    if (!result.ok) return null;
    const trimmed = result.stdout.trim();
    const parsed = Number(trimmed);
    return trimmed.length > 0 && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parses the PR number out of a merge-commit subject, when there is one.
 *
 * Kept ONLY as a cross-check against the GitHub API's own association
 * (HOS-1214 §6.2): "Merge pull request #NNNN from ..." is what `gh pr merge
 * --merge` writes, but it is a string convention, not an API contract, and a
 * disagreement between the two is reported rather than silently resolved.
 *
 * @param input.subject - The commit's subject line.
 * @returns The PR number, or `null` when the subject is not a merge commit.
 */
export function parseMergeSubjectPrNumber({
    subject
}: {
    readonly subject: string;
}): number | null {
    const match = /^Merge pull request #(\d+)\b/.exec(subject);
    return match?.[1] === undefined ? null : Number(match[1]);
}

/** One pull request as the GitHub API reports it, trimmed to what the audit needs. */
export interface ApiPr {
    /** Pull request number. */
    readonly number: number;
    /** Pull request title. */
    readonly title: string;
    /** Author's login. */
    readonly author: string;
    /** Labels currently on the PR. */
    readonly labels: readonly string[];
    /**
     * Whether this PR was actually merged (`merged_at !== null`).
     *
     * Measured 2026-09-07 against this repo's own history: `GET
     * .../commits/{sha}/pulls` on a real merge commit returned TWO PRs — the
     * one that merged it, and an unrelated still-OPEN PR whose branch had
     * since been rebased onto that same commit. Both are legitimately
     * "associated" by GitHub's own definition, so `merged` is what lets
     * {@link pickMergedPr} tell which one actually merged this commit instead
     * of trusting array order, which the API does not document as stable.
     */
    readonly merged: boolean;
}

/** What resolving a commit to its PR(s) returns. */
export type PrResolution =
    | { readonly ok: true; readonly prs: readonly ApiPr[] }
    | { readonly ok: false; readonly error: string };

/**
 * Resolves a commit to the pull request(s) associated with it.
 *
 * This is the AUTHORITATIVE association (HOS-1214 §6.2) — `GET
 * /repos/{owner}/{repo}/commits/{sha}/pulls` — never a parse of the merge
 * subject. An empty array is a valid, meaningful answer: it means the commit
 * is a direct push, not a failure.
 *
 * @param input.sha      - Commit SHA to resolve.
 * @param input.repoSlug - `owner/repo`.
 * @param input.cwd      - Repository directory to run `gh` from.
 * @returns The {@link PrResolution}.
 */
export async function resolvePrsForCommit({
    sha,
    repoSlug,
    cwd
}: {
    readonly sha: string;
    readonly repoSlug: string;
    readonly cwd: string;
}): Promise<PrResolution> {
    const result = await gh({ args: ['api', `repos/${repoSlug}/commits/${sha}/pulls`], cwd });
    if (!result.ok) return { ok: false, error: result.error };

    let parsed: readonly {
        number?: number;
        title?: string;
        user?: { login?: string };
        labels?: readonly { name?: string }[];
        merged_at?: string | null;
    }[];
    try {
        parsed = JSON.parse(result.stdout) as typeof parsed;
    } catch {
        return { ok: false, error: 'gh api devolvió algo que no pude interpretar' };
    }

    const prs = parsed
        .filter((raw) => raw.number !== undefined)
        .map(
            (raw): ApiPr => ({
                number: raw.number as number,
                title: raw.title ?? '',
                author: raw.user?.login ?? '',
                labels: (raw.labels ?? [])
                    .map((label) => label.name)
                    .filter((name): name is string => name !== undefined),
                merged: raw.merged_at !== null && raw.merged_at !== undefined
            })
        );
    return { ok: true, prs };
}

/**
 * Picks the PR that actually merged a commit, out of every PR the API
 * associates with it.
 *
 * Prefers a MERGED PR over array order, which GitHub does not document as
 * stable (see the measured note on {@link ApiPr.merged}). Falls back to the
 * first entry only when none of the associated PRs are merged — an anomaly
 * for a first-parent commit produced by `gh pr merge --merge` (F-7), but one
 * that must still resolve to SOMETHING rather than crash.
 *
 * @param input.prs - Every PR the API associated with one commit (non-empty).
 * @returns The PR to classify this commit against.
 */
export function pickMergedPr({ prs }: { readonly prs: readonly ApiPr[] }): ApiPr {
    return prs.find((pr) => pr.merged) ?? (prs[0] as ApiPr);
}

/**
 * Resolves the `owner/repo` slug the API calls need.
 *
 * @param input.cwd - Repository directory to run `gh` from.
 * @returns The slug, or `null` when `gh` could not resolve it (AC-13: a
 *          "cannot determine", handled the same as a failed API call).
 */
export async function resolveRepoSlug({ cwd }: { readonly cwd: string }): Promise<string | null> {
    const result = await gh({
        args: ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
        cwd
    });
    if (!result.ok) return null;
    const slug = result.stdout.trim();
    return slug.length > 0 ? slug : null;
}
