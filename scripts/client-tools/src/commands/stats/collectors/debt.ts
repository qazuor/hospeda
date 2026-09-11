import { run } from '../exec.ts';
import { type Annotation, type DebtStats, type Outcome, STALE_DAYS } from '../types.ts';

const SOURCE_GLOBS = ['-g', '*.ts', '-g', '*.tsx', '-g', '*.astro'];

/**
 * Files where an `any` is not somebody's decision: generated output, ambient
 * declarations, and test helpers. Over half the raw hits in this repo live in
 * `routeTree.gen.ts` alone, so counting them roughly doubles the figure and
 * blames code nobody wrote.
 */
const AUTHORED_ONLY = [
    '-g',
    '!**/*.test.*',
    '-g',
    '!**/*.spec.*',
    '-g',
    '!**/*.d.ts',
    '-g',
    '!**/*.gen.ts',
    '-g',
    '!**/*.gen.tsx',
    '-g',
    '!**/generated/**',
    '-g',
    '!**/test/**',
    '-g',
    '!**/tests/**',
    '-g',
    '!**/e2e/**'
];

const ANNOTATION_PATTERNS = [
    '\\b(TODO|FIXME|HACK|XXX)\\b',
    '@ts-expect-error',
    '@ts-ignore',
    'biome-ignore'
] as const;

/** Count every annotation keyword in one pass over the source. */
async function countAnnotations(repo: string): Promise<Record<string, number> | null> {
    const args = ['-o', '--no-messages'];
    for (const pattern of ANNOTATION_PATTERNS) args.push('-e', pattern);
    args.push(...SOURCE_GLOBS, '-g', '!**/dist/**', '--', '.');

    const result = await run('rg', args, { cwd: repo, okCodes: [1], timeoutMs: 120_000 });
    if (!result.ok) return null;

    const counts: Record<string, number> = {};
    for (const line of result.stdout.split('\n')) {
        const token = line.slice(line.lastIndexOf(':') + 1).trim();
        if (token.length === 0) continue;
        counts[token] = (counts[token] ?? 0) + 1;
    }
    return counts;
}

/** Per-file `any` counts, restricted to hand-written source. */
async function countAny(
    repo: string
): Promise<{ total: number; top: { path: string; count: number }[] } | null> {
    const result = await run(
        'rg',
        [
            '-c',
            '--no-messages',
            '-e',
            ':\\s*any\\b',
            '-e',
            '<any>',
            '-e',
            '\\bas any\\b',
            ...SOURCE_GLOBS,
            ...AUTHORED_ONLY,
            '--',
            '.'
        ],
        { cwd: repo, okCodes: [1], timeoutMs: 120_000 }
    );
    if (!result.ok) return null;

    const rows: { path: string; count: number }[] = [];
    let total = 0;
    for (const line of result.stdout.split('\n')) {
        const sep = line.lastIndexOf(':');
        if (sep <= 0) continue;
        const count = Number.parseInt(line.slice(sep + 1), 10);
        if (Number.isNaN(count)) continue;
        rows.push({ path: line.slice(0, sep).replace(/^\.\//, ''), count });
        total += count;
    }
    rows.sort((a, b) => b.count - a.count);
    return { total, top: rows.slice(0, 6) };
}

type Hit = { kind: Annotation['kind']; path: string; line: number; text: string };

/** Locate every annotation, keeping the file, line and the comment itself. */
async function locate(repo: string): Promise<Hit[]> {
    const found = await run(
        'rg',
        [
            '-n',
            '--no-messages',
            '-e',
            '\\b(TODO|FIXME|HACK|XXX)\\b',
            ...SOURCE_GLOBS,
            '-g',
            '!**/dist/**',
            '--',
            '.'
        ],
        { cwd: repo, okCodes: [1], timeoutMs: 120_000 }
    );
    if (!found.ok) return [];

    const hits: Hit[] = [];
    for (const raw of found.stdout.split('\n')) {
        const match = /^(.+?):(\d+):(.*)$/.exec(raw);
        if (match === null) continue;
        const [, path, lineNo, body] = match;
        if (path === undefined || lineNo === undefined || body === undefined) continue;
        const kindMatch = /\b(TODO|FIXME|HACK|XXX)\b/.exec(body);
        const kind = kindMatch?.[1] as Annotation['kind'] | undefined;
        if (kind === undefined) continue;
        hits.push({
            kind,
            path: path.replace(/^\.\//, ''),
            line: Number.parseInt(lineNo, 10),
            // Strip comment syntax and the keyword so what is left is the message.
            text: body
                .replace(/^\s*(\/\/|\/\*+|\*|<!--|#)\s*/, '')
                .replace(/\b(TODO|FIXME|HACK|XXX)\b\s*:?\s*/, '')
                .replace(/\s*(\*\/|-->)\s*$/, '')
                .trim()
                .slice(0, 84)
        });
    }
    return hits;
}

/**
 * Date each annotation by asking git when its line last changed.
 *
 * The age is the point: a FIXME nobody has touched in a year is not a task, it
 * is a decision that was never made. Ages are resolved with bounded concurrency
 * because this is one `git log -L` per hit.
 */
async function dateHits(repo: string, hits: readonly Hit[], limit = 400): Promise<Annotation[]> {
    const subset = hits.slice(0, limit);
    const now = Date.now() / 1000;
    const out: Annotation[] = [];
    const CONCURRENCY = 12;

    for (let i = 0; i < subset.length; i += CONCURRENCY) {
        const slice = subset.slice(i, i + CONCURRENCY);
        const dated = await Promise.all(
            slice.map(async (hit): Promise<Annotation> => {
                const log = await run(
                    'git',
                    ['log', '-1', '--format=%ct', '-L', `${hit.line},${hit.line}:${hit.path}`],
                    { cwd: repo, timeoutMs: 20_000 }
                );
                const stamp = log.ok
                    ? Number.parseInt(log.stdout.split('\n')[0] ?? '', 10)
                    : Number.NaN;
                return {
                    ...hit,
                    ageDays: Number.isNaN(stamp) ? -1 : Math.floor((now - stamp) / 86_400)
                };
            })
        );
        out.push(...dated);
    }
    return out;
}

/** Technical debt that is written down in the code itself. */
export async function collectDebt(repo: string): Promise<Outcome<DebtStats>> {
    const [annotations, anyCounts, hits] = await Promise.all([
        countAnnotations(repo),
        countAny(repo),
        locate(repo)
    ]);

    if (annotations === null) return { ok: false, reason: 'ripgrep falló al contar anotaciones' };
    if (anyCounts === null) return { ok: false, reason: 'ripgrep falló al contar `any`' };

    const dated = await dateHits(repo, hits);
    const todoAges = dated
        .filter((a) => a.kind === 'TODO' && a.ageDays >= 0)
        .map((a) => a.ageDays)
        .sort((a, b) => b - a);

    // FIXME and HACK are always worth listing; a TODO only once it has gone stale.
    const stale = dated
        .filter((a) => a.kind === 'FIXME' || a.kind === 'HACK' || a.ageDays > STALE_DAYS)
        .sort((a, b) => b.ageDays - a.ageDays);

    return {
        ok: true,
        data: {
            annotations,
            explicitAny: anyCounts.total,
            anyTop: anyCounts.top,
            todoOldestDays: todoAges[0] ?? 0,
            todoMedianDays:
                todoAges.length === 0 ? 0 : (todoAges[Math.floor(todoAges.length / 2)] ?? 0),
            stale,
            staleCount: stale.length
        }
    };
}
