import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Report } from './types.js';

export const LOG_PATH = join(
    process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share'),
    'hops-stats',
    'history.jsonl'
);

/** One flat record per run, so a later run can diff against it. */
export type Record_ = Readonly<Record<string, number | string>>;

/**
 * Flatten a report into the scalar metrics worth tracking over time.
 *
 * Only successful sections contribute. A failed section is absent from the
 * record rather than logged as zero, so a diff never shows a fake drop caused
 * by a command that could not run.
 */
export function toRecord(report: Report): Record_ {
    const out: Record<string, number | string> = {
        ts: report.at,
        sha: report.sha,
        period: report.period.id
    };
    if (report.code?.ok === true) {
        const c = report.code.data;
        Object.assign(out, {
            src_loc: c.srcLoc,
            src_files: c.srcFiles,
            test_loc: c.testLoc,
            test_files: c.testFiles,
            files_over_500: c.filesOver500,
            tracked_files: c.trackedFiles
        });
    }
    if (report.tests?.ok === true) {
        const t = report.tests.data;
        Object.assign(out, {
            test_cases: t.cases,
            suites: t.suites,
            assertions: t.assertions,
            hard_skips: t.hardSkips
        });
    }
    if (report.tests?.ok === true) {
        Object.assign(out, { tests_misplaced: report.tests.data.misplacedTotal });
    }
    if (report.i18n?.ok === true) {
        const i = report.i18n.data;
        Object.assign(out, {
            i18n_namespaces: i.namespaces,
            i18n_keys: i.totalKeys,
            i18n_missing: Object.values(i.missingByLocale).reduce((a, b) => a + b, 0),
            i18n_extra: Object.values(i.extraByLocale).reduce((a, b) => a + b, 0)
        });
    }
    if (report.debt?.ok === true) {
        const d = report.debt.data;
        Object.assign(out, {
            explicit_any: d.explicitAny,
            todo: d.annotations['TODO'] ?? 0,
            biome_ignore: d.annotations['biome-ignore'] ?? 0,
            ts_expect_error: d.annotations['@ts-expect-error'] ?? 0
        });
    }
    if (report.prs?.ok === true) {
        Object.assign(out, {
            prs_merged_month: report.prs.data.merged.month,
            prs_open: report.prs.data.open,
            prs_without_tests: report.prs.data.withoutTests
        });
    }
    if (report.linear?.ok === true) {
        const l = report.linear.data;
        Object.assign(out, {
            issues_total: l.total,
            issues_open: l.open,
            issues_smoke: l.smokeTotal,
            issues_started: l.started
        });
    }
    if (report.repo?.ok === true) {
        Object.assign(out, {
            worktrees: report.repo.data.worktrees.length,
            worktree_mb: report.repo.data.totalMb,
            worktrees_reclaimable: report.repo.data.worktrees.filter((w) => w.state === 'merged')
                .length
        });
    }
    return out;
}

/** Append a run to the history log, creating the directory on first use. */
export async function append(record: Record_): Promise<void> {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, `${JSON.stringify(record)}\n`, 'utf8');
}

/** The most recent previously logged run, or null when there is no history. */
export async function previous(): Promise<Record_ | null> {
    try {
        const text = await readFile(LOG_PATH, 'utf8');
        const lines = text.split('\n').filter((l) => l.length > 0);
        const last = lines[lines.length - 1];
        return last === undefined ? null : (JSON.parse(last) as Record_);
    } catch {
        return null;
    }
}

/** Metrics that moved between two runs, with the direction of the change. */
export function diff(
    before: Record_,
    after: Record_
): { key: string; before: number; after: number; delta: number }[] {
    const rows: { key: string; before: number; after: number; delta: number }[] = [];
    for (const [key, value] of Object.entries(after)) {
        if (typeof value !== 'number') continue;
        const old = before[key];
        if (typeof old !== 'number' || old === value) continue;
        rows.push({ key, before: old, after: value, delta: value - old });
    }
    return rows;
}
