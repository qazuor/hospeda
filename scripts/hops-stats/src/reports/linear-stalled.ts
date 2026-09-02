import pc from 'picocolors';
import { loadApiKeys, MISSING_KEY_HELP } from '../collectors/linear.js';
import type { Outcome } from '../types.js';

const API = 'https://api.linear.app/graphql';

type Issue = {
    readonly identifier: string;
    readonly title: string;
    readonly priority: number | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly startedAt: string | null;
    readonly state: { readonly name: string; readonly type: string };
    readonly labels: { readonly nodes: readonly { readonly name: string }[] };
    readonly assignee: { readonly name: string } | null;
};

const QUERY = `query($team:String!,$cursor:String){
  issues(first:250, after:$cursor, filter:{team:{key:{eq:$team}}, state:{type:{nin:["completed","canceled"]}}}){
    nodes{ identifier title priority createdAt updatedAt startedAt
           state{name type} labels{nodes{name}} assignee{name} }
    pageInfo{ hasNextPage endCursor }
  }
}`;

async function fetchOpen(key: string, team: string): Promise<Issue[] | string> {
    const issues: Issue[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 40; page += 1) {
        let response: Response;
        try {
            response = await fetch(API, {
                method: 'POST',
                headers: { Authorization: key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: QUERY, variables: { team, cursor } }),
                signal: AbortSignal.timeout(30_000)
            });
        } catch (error) {
            return `no se pudo contactar a Linear: ${(error as Error).message}`;
        }
        const body = (await response.json()) as {
            data?: {
                issues: { nodes: Issue[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
            };
            errors?: { message: string }[];
        };
        const firstError = body.errors?.[0]?.message;
        if (firstError !== undefined) return `Linear devolvió un error: ${firstError}`;
        if (body.data === undefined) return 'Linear devolvió una respuesta sin datos';
        issues.push(...body.data.issues.nodes);
        if (!body.data.issues.pageInfo.hasNextPage) return issues;
        cursor = body.data.issues.pageInfo.endCursor;
    }
    return issues;
}

export type StalledRow = {
    readonly identifier: string;
    readonly title: string;
    readonly state: string;
    readonly days: number;
    readonly assignee: string;
    readonly labels: readonly string[];
};

export type StalledReport = {
    readonly inProgress: readonly StalledRow[];
    readonly smokeWaiting: readonly StalledRow[];
    readonly urgent: readonly StalledRow[];
    readonly deadBacklog: readonly StalledRow[];
    readonly totals: {
        readonly inProgress: number;
        readonly smoke: number;
        readonly urgent: number;
        readonly dead: number;
    };
};

const daysSince = (iso: string): number => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);

const toRow = (i: Issue, since: string): StalledRow => ({
    identifier: i.identifier,
    title: i.title,
    state: i.state.name,
    days: daysSince(since),
    assignee: i.assignee?.name ?? '—',
    labels: i.labels.nodes.map((l) => l.name).filter((n) => n.startsWith('status-needs-smoke'))
});

/**
 * Work that was started and stopped.
 *
 * The summary counts 175 issues "in progress"; the useful question is which of
 * them have not been touched in weeks. Sorting by `updatedAt` is what turns a
 * count into a queue someone can work through.
 */
export async function collectStalled(teams: readonly string[]): Promise<Outcome<StalledReport>> {
    const keys = await loadApiKeys();
    if (keys.length === 0) return { ok: false, reason: MISSING_KEY_HELP };

    // Same rule as the summary: a stale key in the environment must not shadow a
    // valid one in the config file.
    const firstTeam = teams[0] ?? 'HOS';
    let key: string | null = null;
    const rejected: string[] = [];
    for (const candidate of keys) {
        const probe = await fetchOpen(candidate.key, firstTeam);
        if (typeof probe !== 'string' || !/authenticat/i.test(probe)) {
            key = candidate.key;
            break;
        }
        rejected.push(candidate.origin);
    }
    if (key === null) {
        return {
            ok: false,
            reason:
                `Linear rechazó ${keys.length === 1 ? 'la key' : `las ${keys.length} keys`} que encontré.\n` +
                rejected.map((o) => `     · ${o}`).join('\n') +
                `\n     Generá una nueva en Linear → Settings → Security & access → Personal API keys.`
        };
    }
    if (rejected.length > 0) {
        process.stderr.write(
            `  aviso: Linear rechazó la key de ${rejected.join(' y ')}; usando la siguiente.\n`
        );
    }

    const all: Issue[] = [];
    const failures: string[] = [];
    for (const team of teams) {
        const result = await fetchOpen(key, team);
        if (typeof result === 'string') {
            failures.push(`${team}: ${result}`);
            continue;
        }
        if (result.length === 0) {
            failures.push(`${team}: no devolvió issues (¿existe esa clave de equipo?)`);
            continue;
        }
        all.push(...result);
    }
    if (all.length === 0) {
        return {
            ok: false,
            reason: failures.join('; ') || 'ningún equipo devolvió issues abiertos'
        };
    }

    const started = all.filter((i) => i.state.type === 'started');
    const smoke = all.filter((i) =>
        i.labels.nodes.some((l) => l.name.startsWith('status-needs-smoke'))
    );
    const urgent = all.filter((i) => i.priority === 1);
    const dead = all.filter((i) => i.state.type === 'backlog' && daysSince(i.updatedAt) > 90);

    const byAge = (a: StalledRow, b: StalledRow): number => b.days - a.days;

    return {
        ok: true,
        data: {
            inProgress: started.map((i) => toRow(i, i.updatedAt)).sort(byAge),
            smokeWaiting: smoke.map((i) => toRow(i, i.updatedAt)).sort(byAge),
            urgent: urgent.map((i) => toRow(i, i.createdAt)).sort(byAge),
            deadBacklog: dead.map((i) => toRow(i, i.updatedAt)).sort(byAge),
            totals: {
                inProgress: started.length,
                smoke: smoke.length,
                urgent: urgent.length,
                dead: dead.length
            }
        }
    };
}

function table(title: string, rows: readonly StalledRow[], limit: number, note: string): void {
    if (rows.length === 0) return;
    process.stdout.write(`\n  ${pc.bold(title)}  ·  ${rows.length}\n`);
    process.stdout.write(`  ${pc.dim(note)}\n\n`);
    for (const row of rows.slice(0, limit)) {
        const days =
            row.days > 30
                ? pc.red(`${row.days}d`.padStart(5))
                : pc.yellow(`${row.days}d`.padStart(5));
        process.stdout.write(
            `    ${pc.bold(row.identifier.padEnd(10))}${days}  ${row.state.slice(0, 12).padEnd(13)}` +
                `${row.title.slice(0, 40)}\n`
        );
        if (row.assignee !== '—' || row.labels.length > 0) {
            const bits = [row.assignee === '—' ? null : row.assignee, ...row.labels].filter(
                Boolean
            );
            process.stdout.write(`    ${' '.repeat(10)}${pc.dim(bits.join('  ·  '))}\n`);
        }
    }
    if (rows.length > limit) {
        process.stdout.write(`    ${pc.dim(`… y ${rows.length - limit} más`)}\n`);
    }
}

export function drawStalled(r: StalledReport): void {
    table(
        'EN CURSO, SIN TOCARSE',
        r.inProgress,
        20,
        'ordenados por hace cuánto que nadie los actualiza'
    );
    table(
        'ESPERANDO SMOKE',
        r.smokeWaiting,
        20,
        'implementados pero sin verificar; el label no se retira solo'
    );
    table('URGENTES ABIERTOS', r.urgent, 15, 'por antigüedad desde que se crearon');
    table('BACKLOG MUERTO', r.deadBacklog, 15, 'en backlog y sin tocarse hace más de 90 días');
    process.stdout.write(
        `\n  ${pc.dim(`En curso: ${r.totals.inProgress}  ·  smoke: ${r.totals.smoke}  ·  urgentes: ${r.totals.urgent}  ·  backlog muerto: ${r.totals.dead}`)}\n`
    );
}
