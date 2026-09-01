import { daysAgo } from '../dates.js';
import { run, runJson } from '../exec.js';
import type { Outcome, PeriodSpec, PrStats, UntestedPr, Windowed } from '../types.js';

type MergedPr = {
    readonly number: number;
    readonly title: string;
    readonly mergedAt: string;
    readonly createdAt: string;
    readonly additions: number;
    readonly deletions: number;
};

/** Percentile from a sorted ascending array. */
function percentile(sorted: readonly number[], fraction: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.min(Math.floor(sorted.length * fraction), sorted.length - 1);
    return sorted[index] ?? 0;
}

/**
 * Whether a merge commit's diff touched source without touching any test.
 *
 * Judging this per COMMIT is noise: tests and implementation are routinely
 * committed separately. A merge commit carries the whole pull request, which is
 * the unit review actually saw, so that is what gets judged. Diffing against
 * `^1` is required — a plain diff of a merge commit yields nothing.
 */
async function verdictFor(
    repo: string,
    sha: string
): Promise<'with-tests' | 'no-tests' | 'no-code'> {
    const diff = await run('git', ['diff', `${sha}^1`, sha, '--name-only'], {
        cwd: repo,
        timeoutMs: 30_000
    });
    if (!diff.ok) return 'no-code';
    let touchedSource = false;
    let touchedTest = false;
    for (const path of diff.stdout.split('\n')) {
        if (path.length === 0) continue;
        if (/(\.test\.|\.spec\.|\/test\/)/.test(path)) {
            touchedTest = true;
            continue;
        }
        if (/\.(ts|tsx|astro)$/.test(path)) touchedSource = true;
    }
    if (!touchedSource) return 'no-code';
    return touchedTest ? 'with-tests' : 'no-tests';
}

/**
 * A merge subject reads `Merge pull request #123 from owner/branch-name`.
 *
 * Reporting that verbatim buries the two facts that matter under boilerplate,
 * so the number and the head branch are pulled out and the rest dropped.
 */
function parseMergeSubject(subject: string): UntestedPr {
    const match = /Merge pull request #(\d+) from [^/]+\/(\S+)/.exec(subject);
    if (match !== null) {
        const [, number, from] = match;
        return { number: Number.parseInt(number ?? '', 10), from: from ?? '—' };
    }
    // Squash merges and manual merges carry no PR number; keep the subject.
    const squash = /\(#(\d+)\)\s*$/.exec(subject);
    return {
        number: squash?.[1] === undefined ? null : Number.parseInt(squash[1], 10),
        from: subject.replace(/\s*\(#\d+\)\s*$/, '').slice(0, 60)
    };
}

/**
 * Pull request throughput, size and test hygiene for the period.
 *
 * The GitHub half needs `gh` to be authenticated; the hygiene half is purely
 * local, so it still reports when the network side is unavailable.
 */
export async function collectPrs(
    repo: string,
    base: string,
    period: PeriodSpec
): Promise<Outcome<PrStats>> {
    const since = period.since ?? '2000-01-01';
    const sinceArgs = period.since === null ? [] : [`--since=${period.since}`];

    const merged = await runJson<MergedPr[]>(
        'gh',
        [
            'pr',
            'list',
            '--state',
            'merged',
            '--limit',
            '500',
            '--search',
            `merged:>=${since}`,
            '--json',
            'number,title,mergedAt,createdAt,additions,deletions'
        ],
        { cwd: repo, timeoutMs: 120_000, env: { GITHUB_TOKEN: '' } }
    );
    if (merged === null) {
        return { ok: false, reason: 'gh no devolvió PRs (¿autenticado? probá `gh auth status`)' };
    }

    const open = await runJson<{ number: number }[]>(
        'gh',
        ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number'],
        { cwd: repo, timeoutMs: 60_000, env: { GITHUB_TOKEN: '' } }
    );

    const leadHours = merged
        .map((pr) => (Date.parse(pr.mergedAt) - Date.parse(pr.createdAt)) / 3_600_000)
        .sort((a, b) => a - b);
    const sizes = merged.map((pr) => pr.additions + pr.deletions).sort((a, b) => a - b);
    const biggest = [...merged]
        .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
        .slice(0, 6)
        .map((pr) => ({ number: pr.number, lines: pr.additions + pr.deletions, title: pr.title }));

    const mergeShas = await run('git', ['log', base, ...sinceArgs, '--merges', '--format=%H'], {
        cwd: repo
    });
    let withTests = 0;
    let withoutTests = 0;
    let noCode = 0;
    const untested: UntestedPr[] = [];

    if (mergeShas.ok) {
        const shas = mergeShas.stdout.split('\n').filter((s) => s.length > 0);
        for (const sha of shas) {
            const verdict = await verdictFor(repo, sha);
            if (verdict === 'with-tests') {
                withTests += 1;
                continue;
            }
            if (verdict === 'no-code') {
                noCode += 1;
                continue;
            }
            withoutTests += 1;
            if (untested.length < 10) {
                const subject = await run('git', ['log', '-1', '--format=%s', sha], { cwd: repo });
                if (subject.ok) untested.push(parseMergeSubject(subject.stdout.trim()));
            }
        }
    }

    const countWindow = async (
        window: readonly string[],
        match: (line: string) => boolean
    ): Promise<number> => {
        const result = await run('git', ['log', base, ...window, '--format=%s'], { cwd: repo });
        if (!result.ok) return 0;
        return result.stdout.split('\n').filter((line) => line.length > 0 && match(line)).length;
    };
    const isRevert = (line: string): boolean => /^revert/i.test(line);
    const isMerge = (line: string): boolean => /^Merge pull request #/.test(line);
    const windows: readonly (readonly string[])[] = [
        [`--since=${daysAgo(7)}`],
        [`--since=${daysAgo(30)}`],
        []
    ];
    const [revertWeek, revertMonth, revertTotal] = await Promise.all(
        windows.map((w) => countWindow(w, isRevert))
    );
    const [mergeWeek, mergeMonth, mergeTotal] = await Promise.all(
        windows.map((w) => countWindow(w, isMerge))
    );

    const reverts: Windowed = {
        week: revertWeek ?? 0,
        month: revertMonth ?? 0,
        total: revertTotal ?? 0
    };
    // GitHub only answers for the searched window, so the wider counts come from
    // the local merge history instead of a second, slower API call.
    const mergedWindowed: Windowed = {
        week: mergeWeek ?? 0,
        month: mergeMonth ?? 0,
        total: mergeTotal ?? 0
    };

    return {
        ok: true,
        data: {
            merged: mergedWindowed,
            open: open?.length ?? 0,
            leadMedianH: percentile(leadHours, 0.5),
            leadP90H: percentile(leadHours, 0.9),
            leadMaxH: leadHours[leadHours.length - 1] ?? 0,
            sizeMedian: percentile(sizes, 0.5),
            biggest,
            withTests,
            withoutTests,
            noCode,
            untested,
            reverts
        }
    };
}
