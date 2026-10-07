/**
 * @fileoverview
 * TEST:B1:11 (AC:B1:11, INV:D17, DEC-MP-009#📌1): GUARD:G17, its three
 * predicates, by mutation. No decision comes out of a provider notice without
 * re-reading the resource by id.
 *
 * Each case builds a throwaway git tree that is green (a receiver that keeps to
 * kind, id and version; a transition that takes a `ProviderRead` and hands it to
 * `assertFreshForAct`; the cutover script reading the notification table),
 * applies ONE mutation from the spec and runs the guard over it. Each mutation
 * turns it red with the message of ITS predicate, and only that one. The real
 * tree is green.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    CUTOVER_DIR,
    findNoticeBodyReads,
    findStateOutsideRead,
    MIN_SCANNED_FILES,
    NOTIFICATION_TABLE_NAME,
    RULE_MESSAGES,
    type Rule,
    run
} from '../check-decision-rereads-by-id.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RECEIVER = 'apps/api/src/routes/payments/notices.ts';
const TRANSITION = 'apps/api/src/services/billing/authorization-transitions.ts';
const SWEEP = 'apps/api/src/cron/jobs/billing-sweep.job.ts';
const TABLE = NOTIFICATION_TABLE_NAME;

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g17-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A receiver for both channels, plus `extra` lines inside its handler. */
const receiver = ({
    extra = ''
}: {
    readonly extra?: string;
} = {}) => `import type { NoticeDelivery, PaymentProvider } from '@repo/payments';

export async function receive({ provider, c }: Deps) {
    const rawBody = await c.req.text();
    const body = JSON.parse(rawBody);
    const topic = c.req.query('topic');
    const dataId = c.req.query('data.id');
    const delivery: NoticeDelivery = { headers: c.req.header(), body: rawBody };
    const notice = await provider.decodeNotice(delivery);${extra}
    await enqueue({ kind: notice.resourceKind, id: notice.resourceId, version: notice.version });
    return { topic, dataId, type: body.type, id: body.data.id, data: body.data };
}
`;

/** A transition that takes a read by id, plus `extra` lines. */
const transition = ({
    params = 'readonly read: ProviderRead<AuthorizationSnapshot>; readonly act: ActStart',
    extra = ''
}: {
    readonly params?: string;
    readonly extra?: string;
} = {}) => `import {
    type ActStart,
    type AuthorizationSnapshot,
    assertFreshForAct,
    type ProviderRead
} from '@repo/payments';

export function activate({ read, act }: { ${params} }) {
    const fresh = assertFreshForAct({ read, act });
    const { snapshot } = assertFreshForAct({ read, act });${extra}
    return fresh.snapshot.status === 'active' && snapshot.status === 'active';
}
`;

const GREEN: Readonly<Record<string, string>> = {
    [RECEIVER]: receiver(),
    [TRANSITION]: transition(),
    // An email webhook reads its own body freely: it receives no provider notice.
    'apps/api/src/routes/webhooks/brevo.ts':
        'export async function brevo(c: C) {\n    const body = await c.req.json();\n    return body.event;\n}\n',
    // `.snapshot` in a file that does not import the payments package.
    'apps/web/src/lib/gallery.ts': 'export const first = (g: G) => g.snapshot.url;\n',
    // A mention in a comment is not a read.
    [SWEEP]: `// the sweep never reads ${TABLE}\nexport const sweep = () => 1;\n`,
    // The cutover reads the table, read only (U3.3 / HOS-1428).
    [`${CUTOVER_DIR}notifications.ts`]: `export const rows = (db: Db) => db.execute('select id from ${TABLE}');\n`
};

/** Runs the guard over GREEN plus `overrides`. */
function guardOver({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}) {
    return run({ root: makeTree({ files: { ...GREEN, ...overrides } }), minScannedFiles: 0 });
}

/** Red with exactly this predicate's message. */
function expectOnly({
    result,
    rule
}: {
    readonly result: ReturnType<typeof run>;
    readonly rule: Rule;
}) {
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(RULE_MESSAGES[rule]);
    for (const other of Object.keys(RULE_MESSAGES) as Rule[])
        if (other !== rule) expect(result.output).not.toContain(RULE_MESSAGES[other]);
}

describe('G17 over a green tree', () => {
    it('passes: kind, id and version from the notice; state only through assertFreshForAct; the cutover reads', () => {
        const { exitCode, output } = guardOver();
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });
});

describe('TEST:B1:11 (a) — the receiver reads more than kind, id and version', () => {
    it('reading status from the notice body fails with the message of (a), naming the line', () => {
        const result = guardOver({
            overrides: {
                [RECEIVER]: receiver({ extra: "\n    if (body.status === 'authorized') return;" })
            }
        });
        expectOnly({ result, rule: 'G17(a)' });
        expect(result.output).toContain(`${RECEIVER}:10`);
    });

    it.each([
        ['a parsed body', '\n    const s = JSON.parse(rawBody).status;'],
        ['an awaited json body', '\n    const s = (await c.req.json()).status;'],
        ['a bracket read', "\n    const s = body['status'];"],
        ['a field under data', '\n    const s = body.data.status;'],
        ['a destructuring', '\n    const { status } = body;'],
        ['a nested destructuring', '\n    const { data: { status } } = await c.req.json();'],
        ['a rest destructuring', '\n    const { type, ...rest } = body;'],
        ['a spread', '\n    const copy = { ...body };'],
        ['an IPN query parameter', "\n    const s = c.req.query('status');"],
        ['a field of the notice', '\n    const s = notice.status;'],
        [
            'a body bound under another name',
            '\n    const parsed = JSON.parse(rawBody);\n    const s = parsed.status;'
        ]
    ])('turns red on %s', (_case, extra) => {
        expectOnly({
            result: guardOver({ overrides: { [RECEIVER]: receiver({ extra }) } }),
            rule: 'G17(a)'
        });
    });
});

describe('TEST:B1:11 (b) — a decision gets the state other than by a read by id', () => {
    it('a transition that receives the state from the notice body fails with the message of (b)', () => {
        const result = guardOver({
            overrides: {
                [TRANSITION]: transition({
                    params: 'readonly read: ProviderRead<AuthorizationSnapshot>; readonly act: ActStart; readonly state: AuthorizationSnapshot'
                }),
                [RECEIVER]: receiver({
                    extra: '\n    activate({ read: undefined, act, state: JSON.parse(rawBody) });'
                })
            }
        });
        expectOnly({ result, rule: 'G17(b)' });
        expect(result.output).toContain(`${TRANSITION}:8`);
    });

    it.each([
        [
            'reads .snapshot off a read without assertFreshForAct',
            '\n    const s = read.snapshot.status;'
        ],
        ['destructures snapshot from a read', '\n    const { snapshot: raw } = read;'],
        ['names a bare status type', '\n    const s: AuthorizationStatus = fresh.snapshot.status;'],
        ['builds a read by hand', '\n    const fake = stampProviderRead({ snapshot: x, clock });']
    ])('turns red when a decision %s', (_case, extra) => {
        expectOnly({
            result: guardOver({ overrides: { [TRANSITION]: transition({ extra }) } }),
            rule: 'G17(b)'
        });
    });
});

describe('TEST:B1:11 (c) — something reads the notification table', () => {
    it.each([
        [
            'the sweep',
            SWEEP,
            'export const sweep = (db: Db) => db.select().from(providerNotification);\n'
        ],
        [
            'the receiver, processing a Webhooks delivery',
            RECEIVER,
            receiver({
                extra: `\n    await db.execute(sql\`select 1 from ${TABLE} where id = \${notice.resourceId}\`);`
            })
        ]
    ])('a query in %s fails with the message of (c)', (_case, file, source) => {
        const result = guardOver({ overrides: { [file]: source } });
        expectOnly({ result, rule: 'G17(c)' });
        expect(result.output).toContain(file);
    });

    it.each([
        ['apps/', 'apps/api/src/services/notifications.ts'],
        ['packages/', 'packages/db/src/notifications.ts'],
        ['another scripts/ folder', 'scripts/reports/notifications.ts']
    ])('the cutover read itself is red when it lives under %s', (_case, file) => {
        const source = GREEN[`${CUTOVER_DIR}notifications.ts`] as string;
        expectOnly({ result: guardOver({ overrides: { [file]: source } }), rule: 'G17(c)' });
    });
});

describe('the predicates, unit by unit', () => {
    it('(a) leaves a file that receives no notice alone', () => {
        const source = 'const body = await c.req.json();\nexport const s = body.status;\n';
        expect(findNoticeBodyReads({ file: 'a.ts', source })).toEqual([]);
    });

    it('(b) allows ProviderRead<…> and the state types inside an import, and reads nothing without the import', () => {
        expect(findStateOutsideRead({ file: 'a.ts', source: transition() })).toEqual([]);
        expect(
            findStateOutsideRead({
                file: 'a.ts',
                source: 'export const s = (r: R) => r.snapshot.status;\n'
            })
        ).toEqual([]);
    });
});

describe('G17 cannot pass vacuously', () => {
    it('fails when fewer files than the floor were scanned', () => {
        const result = run({ root: makeTree({ files: GREEN }) });
        expect(MIN_SCANNED_FILES).toBe(1000);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('not a clean tree');
    });

    it('is green over this repository', { timeout: 60_000 }, () => {
        const result = run({ root: REPO_ROOT });
        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });
});

describe('G17 wiring', () => {
    const rootPkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
        readonly scripts: Readonly<Record<string, string>>;
    };
    const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8').split('\n');
    const start = ci.indexOf('  guards:');
    const end = ci.findIndex(
        (line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)
    );
    const guardsJob = start === -1 ? '' : ci.slice(start, end === -1 ? undefined : end).join('\n');

    it('has its own script and is part of pnpm check:guards', () => {
        expect(rootPkg.scripts['check:decision-rereads-by-id']).toBe(
            'tsx scripts/check-decision-rereads-by-id.ts'
        );
        const chain = (rootPkg.scripts['check:guards'] ?? '')
            .split('&&')
            .map((step) => step.trim());
        expect(chain).toContain('pnpm check:decision-rereads-by-id');
    });

    it('is a named step of the guards job of ci.yml', () => {
        expect(guardsJob).toContain('(GUARD:G17)');
        expect(guardsJob).toMatch(/^\s+run: pnpm check:decision-rereads-by-id\s*$/m);
    });
});
