import pc from 'picocolors';
import { runJson } from '../exec.ts';
import type { Outcome } from '../types.ts';

type Check = {
    readonly conclusion?: string | null;
    readonly status?: string | null;
    readonly name?: string;
};

type RawPr = {
    readonly number: number;
    readonly title: string;
    readonly headRefName: string;
    readonly createdAt: string;
    readonly isDraft: boolean;
    readonly additions: number;
    readonly deletions: number;
    readonly mergeStateStatus: string;
    readonly reviewDecision: string | null;
    readonly statusCheckRollup: Check[] | null;
};

/** Why a pull request is not merged yet. Ordered by how much it needs a human. */
export type Blocker =
    | 'conflict'
    | 'ci-red'
    | 'ci-pending'
    | 'changes-requested'
    | 'draft'
    | 'ready';

export type OpenPr = {
    readonly number: number;
    readonly title: string;
    readonly branch: string;
    readonly ageHours: number;
    readonly lines: number;
    readonly blocker: Blocker;
    readonly failing: readonly string[];
    readonly pendingCount: number;
};

export type OpenPrReport = {
    readonly prs: readonly OpenPr[];
};

/**
 * Classify what is holding a pull request.
 *
 * A pending check reports an EMPTY conclusion, not null, so `?? 'pending'` never
 * fires and seven queued checks read as green. And a conflicted PR does not even
 * start its workflows, so it shows zero checks — which is not success either.
 * Both are treated as blockers rather than as absence of failure.
 */
function classify(pr: RawPr): { blocker: Blocker; failing: string[]; pendingCount: number } {
    const checks = pr.statusCheckRollup ?? [];
    const failing = checks
        .filter((c) =>
            ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(c.conclusion ?? '')
        )
        .map((c) => c.name ?? '?');
    const pendingCount = checks.filter(
        (c) => c.conclusion === '' || c.conclusion === null || c.conclusion === undefined
    ).length;

    if (pr.mergeStateStatus === 'DIRTY') return { blocker: 'conflict', failing, pendingCount };
    if (failing.length > 0) return { blocker: 'ci-red', failing, pendingCount };
    if (pr.isDraft) return { blocker: 'draft', failing, pendingCount };
    if (pendingCount > 0 || checks.length === 0)
        return { blocker: 'ci-pending', failing, pendingCount };
    if (pr.reviewDecision === 'CHANGES_REQUESTED')
        return { blocker: 'changes-requested', failing, pendingCount };
    return { blocker: 'ready', failing, pendingCount };
}

export async function collectOpenPrs(repo: string): Promise<Outcome<OpenPrReport>> {
    const raw = await runJson<RawPr[]>(
        'gh',
        [
            'pr',
            'list',
            '--state',
            'open',
            '--limit',
            '100',
            '--json',
            'number,title,headRefName,createdAt,isDraft,additions,deletions,mergeStateStatus,reviewDecision,statusCheckRollup'
        ],
        { cwd: repo, timeoutMs: 120_000, env: { GITHUB_TOKEN: '' } }
    );
    if (raw === null)
        return { ok: false, reason: 'gh no devolvió PRs (¿autenticado? probá `gh auth status`)' };

    const now = Date.now();
    const prs: OpenPr[] = raw.map((pr) => {
        const { blocker, failing, pendingCount } = classify(pr);
        return {
            number: pr.number,
            title: pr.title,
            branch: pr.headRefName,
            ageHours: (now - Date.parse(pr.createdAt)) / 3_600_000,
            lines: pr.additions + pr.deletions,
            blocker,
            failing,
            pendingCount
        };
    });

    const order: Record<Blocker, number> = {
        conflict: 0,
        'ci-red': 1,
        'changes-requested': 2,
        ready: 3,
        'ci-pending': 4,
        draft: 5
    };
    prs.sort((a, b) => order[a.blocker] - order[b.blocker] || b.ageHours - a.ageHours);
    return { ok: true, data: { prs } };
}

const GROUPS: readonly {
    readonly blocker: Blocker;
    readonly label: string;
    readonly paint: (t: string) => string;
}[] = [
    { blocker: 'conflict', label: 'EN CONFLICTO — no dispara CI hasta resolverlo', paint: pc.red },
    { blocker: 'ci-red', label: 'CI EN ROJO', paint: pc.red },
    { blocker: 'changes-requested', label: 'CON CAMBIOS PEDIDOS', paint: pc.yellow },
    { blocker: 'ready', label: 'VERDE — esperando merge', paint: pc.green },
    { blocker: 'ci-pending', label: 'CI CORRIENDO', paint: pc.dim },
    { blocker: 'draft', label: 'BORRADOR', paint: pc.dim }
];

const age = (hours: number): string =>
    hours < 48 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;

export function drawOpenPrs(r: OpenPrReport): void {
    if (r.prs.length === 0) {
        process.stdout.write(`  ${pc.green('No hay PRs abiertos.')}\n`);
        return;
    }
    for (const group of GROUPS) {
        const rows = r.prs.filter((p) => p.blocker === group.blocker);
        if (rows.length === 0) continue;
        process.stdout.write(`\n  ${group.paint(group.label)}  ·  ${rows.length}\n`);
        for (const pr of rows) {
            process.stdout.write(
                `    ${pc.bold(`#${pr.number}`.padEnd(7))}${age(pr.ageHours).padStart(5)}  ` +
                    `${`${pr.lines.toLocaleString('es-AR')} líneas`.padStart(14)}  ${pr.title.slice(0, 44)}\n`
            );
            process.stdout.write(`    ${' '.repeat(7)}${pc.dim(pr.branch)}\n`);
            if (pr.failing.length > 0) {
                process.stdout.write(
                    `    ${' '.repeat(7)}${pc.red(`falla: ${pr.failing.slice(0, 4).join(', ')}`)}\n`
                );
            } else if (pr.blocker === 'ci-pending' && pr.pendingCount > 0) {
                process.stdout.write(
                    `    ${' '.repeat(7)}${pc.dim(`${pr.pendingCount} checks sin terminar`)}\n`
                );
            }
        }
    }
    process.stdout.write(
        `\n  ${pc.dim('Un check pendiente trae conclusion VACÍA, no null, y un PR en conflicto')}\n` +
            `  ${pc.dim('no arranca ningún workflow: ninguno de los dos es verde.')}\n`
    );
}
