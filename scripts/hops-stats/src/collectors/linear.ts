import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Counted, LinearStats, Outcome, PeriodSpec, TeamStats } from '../types.js';

const API = 'https://api.linear.app/graphql';
const PAGE = 250;

const CONFIG_DIR = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');

/**
 * Where the key is looked for, in order.
 *
 * Two paths because the tool was renamed after the file was already in use:
 * checking both means an existing setup keeps working and nobody has to keep a
 * symlink alive just to bridge the rename.
 */
export const CONFIG_PATHS = [
    join(CONFIG_DIR, 'hospeda', 'stats.conf'),
    join(CONFIG_DIR, 'hops-stats', 'config')
] as const;

export const CONFIG_PATH = CONFIG_PATHS[0];

export const MISSING_KEY_HELP =
    `falta LINEAR_API_KEY.\n` +
    `     Generala en Linear → Settings → Security & access → Personal API keys.\n` +
    `     Guardala en ${CONFIG_PATHS[0]} como:\n` +
    `       LINEAR_API_KEY='lin_api_...'      (chmod 600)\n` +
    `     El archivo, y no solo la variable: una universal de fish no la ve un\n` +
    `     subproceso ni un cron.`;

export type KeySource = { readonly key: string; readonly origin: string };

/**
 * Every place a key could come from, in order of precedence.
 *
 * Plural on purpose. An environment variable holding a stale or rotated key used
 * to win outright and the config file was never reached, so a perfectly good
 * file sat there while the tool reported an authentication error. Callers try
 * each in turn and report WHICH one was rejected.
 */
export async function loadApiKeys(): Promise<KeySource[]> {
    const found: KeySource[] = [];
    const seen = new Set<string>();

    const add = (key: string, origin: string): void => {
        const clean = key.trim();
        if (clean.length === 0 || seen.has(clean)) return;
        seen.add(clean);
        found.push({ key: clean, origin });
    };

    const fromEnv = process.env['LINEAR_API_KEY'];
    if (fromEnv !== undefined) add(fromEnv, 'la variable de entorno LINEAR_API_KEY');

    for (const path of CONFIG_PATHS) {
        let text: string;
        try {
            text = await readFile(path, 'utf8');
        } catch {
            continue;
        }
        for (const line of text.split('\n')) {
            const match = /^\s*(?:export\s+)?LINEAR_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
            const raw = match?.[1];
            if (raw === undefined) continue;
            add(raw.replace(/^['"]|['"]$/g, ''), path);
        }
    }
    return found;
}

/** Kept for callers that only need to know whether any key exists. */
export async function loadApiKey(): Promise<string | null> {
    const keys = await loadApiKeys();
    return keys[0]?.key ?? null;
}

type Issue = {
    readonly identifier: string;
    readonly title: string;
    readonly priority: number | null;
    readonly createdAt: string;
    readonly completedAt: string | null;
    readonly state: { readonly name: string; readonly type: string };
    readonly labels: { readonly nodes: readonly { readonly name: string }[] };
};

const QUERY = `query($team:String!,$cursor:String){
  issues(first:${PAGE}, after:$cursor, filter:{team:{key:{eq:$team}}}){
    nodes{ identifier title priority createdAt completedAt state{name type} labels{nodes{name}} }
    pageInfo{ hasNextPage endCursor }
  }
}`;

/** Fetch every issue in a team, following the cursor. */
async function fetchIssues(key: string, team: string): Promise<Issue[] | string> {
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

const OPEN_TYPES = new Set(['backlog', 'unstarted', 'started', 'triage']);
const PRIORITY_LABELS: Record<number, string> = {
    0: '— sin prioridad',
    1: '1 Urgente',
    2: '2 Alta',
    3: '3 Media',
    4: '4 Baja'
};

/** The team an issue belongs to, read off its identifier (`HOS-123` → `HOS`). */
const teamOf = (issue: Issue): string => issue.identifier.split('-')[0] ?? '?';

/**
 * Count items by a key, keeping the per-team split alongside each total.
 *
 * A combined figure with no breakdown cannot answer "is this our specs or the
 * bug intake", which is usually the actual question behind the number.
 */
function tally<T>(
    items: readonly T[],
    key: (item: T) => string,
    team: (item: T) => string
): Counted[] {
    const totals = new Map<string, number>();
    const perTeam = new Map<string, Map<string, number>>();
    for (const item of items) {
        const k = key(item);
        totals.set(k, (totals.get(k) ?? 0) + 1);
        const inner = perTeam.get(k) ?? new Map<string, number>();
        const t = team(item);
        inner.set(t, (inner.get(t) ?? 0) + 1);
        perTeam.set(k, inner);
    }
    return [...totals.entries()]
        .map(([name, total]) => ({
            name,
            total,
            byTeam: Object.fromEntries(perTeam.get(name) ?? new Map())
        }))
        .sort((a, b) => b.total - a.total);
}

/** Count issues per team, for the week-by-week balance rows. */
const countByTeam = (items: readonly Issue[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const issue of items) {
        const t = teamOf(issue);
        out[t] = (out[t] ?? 0) + 1;
    }
    return out;
};

/**
 * Issue counts, backlog balance and smoke debt.
 *
 * These are the perishable numbers in the whole tool: Linear's API answers for
 * the present only, so a state snapshot not taken today cannot be reconstructed
 * tomorrow. That is why runs are logged.
 */
export async function collectLinear(
    teams: readonly string[],
    period: PeriodSpec
): Promise<Outcome<LinearStats>> {
    const keys = await loadApiKeys();
    if (keys.length === 0) return { ok: false, reason: MISSING_KEY_HELP };

    // Try each candidate against the first team; a rejected key must not stop the
    // run when another source holds a valid one.
    const firstTeam = teams[0] ?? 'HOS';
    let key: string | null = null;
    const rejected: string[] = [];
    for (const candidate of keys) {
        const probe = await fetchIssues(candidate.key, firstTeam);
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

    // Both teams are read by default: specs live in HOS and user-reported bugs in
    // BETA, and a backlog balance that ignores half the intake is not a balance.
    const fetched: Issue[] = [];
    const perTeam: TeamStats[] = [];
    const failures: string[] = [];
    for (const team of teams) {
        const result = await fetchIssues(key, team);
        if (typeof result === 'string') {
            failures.push(`${team}: ${result}`);
            continue;
        }
        // Linear answers an unknown team key with an empty list, not an error, so
        // a typo in --team would otherwise render as a tidy report of zero issues.
        if (result.length === 0) {
            failures.push(`${team}: no devolvió ningún issue (¿existe esa clave de equipo?)`);
            continue;
        }
        fetched.push(...result);
        perTeam.push({
            team,
            total: result.length,
            open: result.filter((i) => OPEN_TYPES.has(i.state.type)).length,
            started: result.filter((i) => i.state.type === 'started').length,
            smoke: result.filter((i) =>
                i.labels.nodes.some((l) => l.name.startsWith('status-needs-smoke'))
            ).length
        });
    }
    // A team that failed must not be silently folded into a smaller total.
    if (perTeam.length === 0) {
        return { ok: false, reason: failures.join('; ') || 'ningún equipo devolvió issues' };
    }
    if (failures.length > 0) {
        process.stderr.write(`  aviso: ${failures.join('; ')}\n`);
    }

    const open = fetched.filter((i) => OPEN_TYPES.has(i.state.type));
    const cutoff = period.since === null ? 0 : Date.parse(period.since);
    const now = Date.now();
    const isSmoke = (i: Issue): boolean =>
        i.labels.nodes.some((l) => l.name.startsWith('status-needs-smoke'));
    const smoke = fetched.filter(isSmoke);

    const weekOf = (iso: string): number => Math.floor((now - Date.parse(iso)) / 604_800_000);
    const balance = Array.from({ length: 8 }, (_, offset) => {
        const week = 7 - offset;
        const created = fetched.filter((i) => weekOf(i.createdAt) === week);
        const closed = fetched.filter(
            (i) => i.completedAt !== null && weekOf(i.completedAt) === week
        );
        return {
            week: week === 0 ? 'esta semana' : `${week} sem atrás`,
            created: created.length,
            closed: closed.length,
            createdByTeam: countByTeam(created),
            closedByTeam: countByTeam(closed)
        };
    });

    const cycles = fetched
        .filter((i) => i.completedAt !== null)
        .map((i) => (Date.parse(i.completedAt as string) - Date.parse(i.createdAt)) / 86_400_000)
        .sort((a, b) => a - b);

    // Naming the oldest one turns a number into something someone can go and
    // close; "61 días" alone tells you there is a problem but not where.
    const oldest = [...smoke].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
    const smokeOldest =
        oldest === undefined
            ? null
            : {
                  identifier: oldest.identifier,
                  title: oldest.title,
                  days: Math.floor((now - Date.parse(oldest.createdAt)) / 86_400_000),
                  labels: oldest.labels.nodes
                      .filter((l) => l.name.startsWith('status-needs-smoke'))
                      .map((l) => l.name)
              };

    return {
        ok: true,
        data: {
            teams: perTeam,
            total: fetched.length,
            open: open.length,
            started: fetched.filter((i) => i.state.type === 'started').length,
            done: fetched.filter((i) => i.state.type === 'completed').length,
            createdInPeriod: fetched.filter((i) => Date.parse(i.createdAt) >= cutoff).length,
            closedInPeriod: fetched.filter(
                (i) => i.completedAt !== null && Date.parse(i.completedAt) >= cutoff
            ).length,
            byState: tally(fetched, (i) => i.state.name, teamOf),
            byPriority: tally(
                open,
                (i) => PRIORITY_LABELS[i.priority ?? 0] ?? '— sin prioridad',
                teamOf
            ).sort((a, b) => a.name.localeCompare(b.name)),
            byArea: tally(
                open.flatMap((i) =>
                    i.labels.nodes
                        .filter((l) => l.name.startsWith('area-'))
                        .map((l) => ({ label: l.name, team: teamOf(i) }))
                ),
                (x) => x.label,
                (x) => x.team
            ),
            smokeTotal: smoke.length,
            smokeByLabel: tally(
                smoke.flatMap((i) =>
                    i.labels.nodes
                        .filter((l) => l.name.startsWith('status-needs-smoke'))
                        .map((l) => ({ label: l.name, team: teamOf(i) }))
                ),
                (x) => x.label,
                (x) => x.team
            ),
            smokeOldest,
            balance,
            cycleMedianDays:
                cycles.length === 0 ? 0 : Math.round(cycles[Math.floor(cycles.length / 2)] ?? 0)
        }
    };
}
