import { daysAgo } from '../dates.js';
import { run } from '../exec.js';
import type { GitStats, Outcome, PeriodSpec, Windowed } from '../types.js';

/**
 * Paths whose churn says nothing about the code.
 *
 * Unfiltered, the top of the "most edited" list is task-master bookkeeping and
 * the lockfile — they change on every task and point at no engineering decision.
 */
const CHURN_NOISE = [/pnpm-lock\.yaml$/, /\/tasks\/(state\.json|TODOs\.md)$/, /_journal\.json$/];

/** Build the `--since` argument list for a period, empty for "all history". */
const sinceArgs = (period: PeriodSpec): string[] =>
    period.since === null ? [] : [`--since=${period.since}`];

/** Count matching commits over week, month and all-time windows at once. */
async function windowed(
    repo: string,
    base: string,
    extraArgs: readonly string[],
    match: (line: string) => boolean
): Promise<Windowed> {
    const [week, month, total] = await Promise.all(
        [[`--since=${daysAgo(7)}`], [`--since=${daysAgo(30)}`], []].map(async (window) => {
            const result = await run('git', ['log', base, ...window, ...extraArgs], { cwd: repo });
            if (!result.ok) return 0;
            return result.stdout.split('\n').filter((line) => line.length > 0 && match(line))
                .length;
        })
    );
    return { week: week ?? 0, month: month ?? 0, total: total ?? 0 };
}

/**
 * Commit-level activity, reported over three windows.
 *
 * A single period gives a number with nothing to sit against; the week beside
 * the month beside all-time is what makes it readable as a trend.
 */
export async function collectGit(
    repo: string,
    base: string,
    period: PeriodSpec
): Promise<Outcome<GitStats>> {
    const since = sinceArgs(period);

    const [subjects, emails, names] = await Promise.all([
        run('git', ['log', base, ...since, '--format=%s'], { cwd: repo }),
        run('git', ['log', base, ...since, '--format=%ae'], { cwd: repo }),
        run('git', ['log', base, ...since, '--name-only', '--format='], { cwd: repo })
    ]);

    if (!subjects.ok) return { ok: false, reason: `git log falló: ${subjects.error}` };

    const [commits, migrations, specs] = await Promise.all([
        windowed(repo, base, ['--format=%H'], () => true),
        windowed(repo, base, ['--diff-filter=A', '--name-only', '--format='], (p) =>
            /^packages\/db\/src\/migrations\/\d/.test(p)
        ),
        windowed(repo, base, ['--diff-filter=A', '--name-only', '--format='], (p) =>
            /^\.specs\/.*\/spec\.md$/.test(p)
        )
    ]);

    const lines = subjects.stdout.split('\n').filter((l) => l.length > 0);

    const typeCounts = new Map<string, number>();
    for (const subject of lines) {
        const match = /^(\w+)[(:]/.exec(subject);
        const type = match?.[1];
        if (type === undefined) continue;
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }

    const churnCounts = new Map<string, number>();
    if (names.ok) {
        for (const path of names.stdout.split('\n')) {
            if (path.length === 0) continue;
            if (CHURN_NOISE.some((re) => re.test(path))) continue;
            churnCounts.set(path, (churnCounts.get(path) ?? 0) + 1);
        }
    }

    const authors = emails.ok
        ? new Set(emails.stdout.split('\n').filter((e) => e.length > 0)).size
        : 0;

    return {
        ok: true,
        data: {
            commits,
            authors,
            migrations,
            specs,
            types: [...typeCounts.entries()]
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8),
            churn: [...churnCounts.entries()]
                .map(([path, count]) => ({ path, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8)
        }
    };
}
