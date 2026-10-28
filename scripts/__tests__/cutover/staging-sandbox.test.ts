import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StagingSandboxCliDeps } from '../../cutover/cli-staging-sandbox-main.ts';
import { runStagingSandboxCli } from '../../cutover/cli-staging-sandbox-main.ts';
import type { ReadOnlyClient } from '../../cutover/known-ids.ts';
import { ProviderError } from '../../cutover/provider-api.ts';
import type { StagingSandboxManifest } from '../../cutover/run-staging-sandbox.ts';
import type { StagingSandboxApi } from '../../cutover/staging-sandbox-api.ts';
import type { FakeObject, FakeProvider } from './fake-provider.ts';
import { createFakeProvider } from './fake-provider.ts';

/**
 * HOS-1951: the staging sandbox run (step V1 of the staging window). Every test drives the CLI
 * entry logic against a simulated provider and a simulated read-only database: no network, no
 * database, no session variables of the real process.
 */

const EMAIL_A = 'host-a@example.test';
const EMAIL_B = 'host-b@example.test';
const PROBES_EMPTY = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../packages/payments/src/probes/probes.json'
);

/** Sandbox account: two anchored, two loose (found by email), one already cancelled. */
const OBJECTS: readonly FakeObject[] = [
    { kind: 'preapproval', id: 'pre-anchored-live', status: 'authorized' },
    { kind: 'preapproval', id: 'pre-anchored-cancelled', status: 'cancelled' },
    { kind: 'preapproval', id: 'pre-loose-pending', status: 'pending' },
    { kind: 'preapproval', id: 'pre-loose-paused', status: 'paused' }
];

interface FakeDb {
    readonly client: ReadOnlyClient;
    readonly queries: string[];
    connects: number;
    ended: number;
}

function fakeDb({
    name = 'hospeda_staging',
    anchored = ['pre-anchored-live', 'pre-anchored-cancelled'],
    emails = [EMAIL_A, EMAIL_B]
}: {
    readonly name?: string;
    readonly anchored?: readonly string[];
    readonly emails?: readonly string[];
} = {}): FakeDb {
    const queries: string[] = [];
    const db: FakeDb = {
        queries,
        connects: 0,
        ended: 0,
        client: {
            query: async (sql) => {
                queries.push(sql.trim());
                if (sql.includes('current_database()')) return { rows: [{ name }] };
                if (sql.includes('FROM provider_link'))
                    return { rows: anchored.map((id) => ({ id })) };
                if (sql.includes('declared_payer_email'))
                    return { rows: emails.map((email) => ({ email })) };
                return { rows: [] };
            },
            end: async () => {
                db.ended += 1;
            }
        }
    };
    return db;
}

interface FakeSandbox {
    readonly api: StagingSandboxApi;
    readonly calls: string[];
}

function fakeSandbox({
    tags = ['test_user', 'normal'],
    byEmail = {
        [EMAIL_A]: ['pre-loose-pending'],
        [EMAIL_B]: ['pre-loose-paused', 'pre-anchored-live']
    },
    totalOverride = {}
}: {
    readonly tags?: readonly string[];
    readonly byEmail?: Readonly<Record<string, readonly string[]>>;
    readonly totalOverride?: Readonly<Record<string, number>>;
} = {}): FakeSandbox {
    const calls: string[] = [];
    return {
        calls,
        api: {
            readAccountTags: async () => {
                calls.push('USERS_ME');
                return tags;
            },
            searchPreapprovalsByPayerEmail: async ({ payerEmail }) => {
                calls.push('SEARCH');
                const ids = byEmail[payerEmail] ?? [];
                const total = totalOverride[payerEmail] ?? ids.length;
                return { total, ids, rowsSeen: ids.length };
            }
        }
    };
}

interface Harness {
    readonly provider: FakeProvider;
    readonly sandbox: FakeSandbox;
    readonly db: FakeDb;
    readonly errLines: string[];
    readonly outLines: string[];
    readonly manifestPath: string;
    readonly run: (args: readonly string[]) => Promise<number>;
    readonly manifest: () => StagingSandboxManifest;
}

function harness({
    provider = createFakeProvider({ objects: OBJECTS }),
    sandbox = fakeSandbox(),
    db = fakeDb(),
    session = { CUTOVER_MP_ACCESS_TOKEN: 'tok', CUTOVER_STAGING_DATABASE_URL: 'postgres://x/y' },
    probeIds
}: {
    readonly probeIds?: readonly string[];
    readonly provider?: FakeProvider;
    readonly sandbox?: FakeSandbox;
    readonly db?: FakeDb;
    readonly session?: Readonly<Record<string, string | undefined>>;
} = {}): Harness {
    const dir = mkdtempSync(path.join(tmpdir(), 'hos1951-'));
    const manifestPath = path.join(dir, 'manifest.json');
    let probesPath = PROBES_EMPTY;
    if (probeIds !== undefined) {
        probesPath = path.join(dir, 'probes.json');
        writeFileSync(probesPath, JSON.stringify({ ids: probeIds }));
    }
    const errLines: string[] = [];
    const outLines: string[] = [];
    const deps = (args: readonly string[]): StagingSandboxCliDeps => ({
        args,
        session,
        createApi: () => provider.api,
        createSandboxApi: () => sandbox.api,
        connectDb: async () => {
            db.connects += 1;
            return db.client;
        },
        sleep: async () => {},
        backoffMs: [0, 0, 0],
        out: (line) => outLines.push(line),
        err: (line) => errLines.push(line)
    });
    return {
        provider,
        sandbox,
        db,
        errLines,
        outLines,
        manifestPath,
        run: (args) =>
            runStagingSandboxCli(
                deps([...args, '--probes', probesPath, '--manifest-out', manifestPath])
            ),
        manifest: () => JSON.parse(readFileSync(manifestPath, 'utf8')) as StagingSandboxManifest
    };
}

const cancelCalls = (provider: FakeProvider): readonly string[] =>
    provider.calls.filter((c) => c.startsWith('CANCEL'));

describe('HOS-1951 dry run (the default)', () => {
    it('reads every source and re-reads by id, but sends no cancellation', async () => {
        // Arrange
        const h = harness();
        // Act
        const code = await h.run(['--target=staging']);
        // Assert
        expect(code).toBe(0);
        expect(cancelCalls(h.provider)).toEqual([]);
        const m = h.manifest();
        expect(m.mode).toBe('dry-run');
        expect(m.outcome).toBe('dry-run');
        expect(m.liveIds).toEqual(['pre-anchored-live', 'pre-loose-paused', 'pre-loose-pending']);
        expect(m.alreadyCancelledIds).toEqual(['pre-anchored-cancelled']);
        expect(m.cancelRequestedIds).toEqual([]);
        expect(m.sources).toEqual({ anchoredIds: 2, payerEmails: 2, manifestIds: 0 });
        expect(h.provider.state.get('pre-anchored-live')?.status).toBe('authorized');
    });

    it('never writes a payer email into the manifest nor to the output', async () => {
        // Arrange
        const h = harness();
        // Act
        await h.run(['--target=staging']);
        // Assert
        const text = readFileSync(h.manifestPath, 'utf8');
        const printed = [...h.outLines, ...h.errLines].join('\n');
        for (const email of [EMAIL_A, EMAIL_B]) {
            expect(text).not.toContain(email);
            expect(printed).not.toContain(email);
        }
    });

    it('reads the database inside a READ ONLY transaction and closes it', async () => {
        // Arrange
        const h = harness();
        // Act
        await h.run(['--target=staging']);
        // Assert
        expect(h.db.queries[0]).toContain('current_database()');
        expect(h.db.queries[1]).toBe('BEGIN READ ONLY');
        expect(h.db.queries.at(-1)).toBe('ROLLBACK');
        expect(h.db.ended).toBe(1);
    });
});

describe('HOS-1951 --apply', () => {
    it('cancels every live preapproval and re-reads each until it reads cancelled', async () => {
        // Arrange
        const h = harness();
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(0);
        expect(cancelCalls(h.provider)).toEqual([
            'CANCEL preapproval pre-anchored-live',
            'CANCEL preapproval pre-loose-paused',
            'CANCEL preapproval pre-loose-pending'
        ]);
        const lastCancel = h.provider.calls.lastIndexOf('CANCEL preapproval pre-loose-pending');
        expect(h.provider.calls.slice(lastCancel + 1)).toEqual([
            'GET preapproval pre-anchored-live',
            'GET preapproval pre-loose-paused',
            'GET preapproval pre-loose-pending'
        ]);
        const m = h.manifest();
        expect(m.outcome).toBe('ok');
        expect(m.cancelledIds).toEqual(m.liveIds);
        expect(m.cancelRequestedIds).toEqual(m.liveIds);
        expect(m.alreadyCancelledIds).toEqual(['pre-anchored-cancelled']);
    });

    it('fails (exit 1) when a preapproval never reads cancelled after the retries', async () => {
        // Arrange
        const h = harness({
            provider: createFakeProvider({ objects: OBJECTS, stuckIds: ['pre-loose-paused'] })
        });
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(1);
        const m = h.manifest();
        expect(m.outcome).toBe('failed');
        expect(m.failures).toEqual([
            {
                code: 'NOT_CANCELLED',
                id: 'pre-loose-paused',
                detail: "still 'paused' after 3 retries"
            }
        ]);
        expect(m.cancelledIds).toEqual(['pre-anchored-live', 'pre-loose-pending']);
    });

    it('keeps the probes of the probe manifest alive', async () => {
        // Arrange
        const h = harness({ probeIds: ['pre-loose-paused'] });
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(0);
        expect(cancelCalls(h.provider)).not.toContain('CANCEL preapproval pre-loose-paused');
        expect(h.manifest().preservedProbeIds).toEqual(['pre-loose-paused']);
        expect(h.manifest().foundIds).not.toContain('pre-loose-paused');
    });

    it('leaves alone a status it does not know', async () => {
        // Arrange
        const provider = createFakeProvider({
            objects: [...OBJECTS, { kind: 'preapproval', id: 'pre-weird', status: 'expired' }]
        });
        const h = harness({
            provider,
            db: fakeDb({ anchored: ['pre-anchored-live', 'pre-weird'] })
        });
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(1);
        expect(cancelCalls(provider)).not.toContain('CANCEL preapproval pre-weird');
        expect(h.manifest().failures.map((f) => [f.code, f.id])).toEqual([
            ['UNEXPECTED_STATUS', 'pre-weird']
        ]);
    });

    it('records a 404 as not found, not as a failure', async () => {
        // Arrange
        const provider = createFakeProvider({ objects: OBJECTS });
        const getById = provider.api.getById;
        const api = {
            ...provider.api,
            getById: async (input: Parameters<typeof getById>[0]) => {
                if (input.id === 'pre-gone')
                    throw new ProviderError({ message: 'gone', httpStatus: 404 });
                return getById(input);
            }
        };
        const h = harness({
            provider: { ...provider, api },
            db: fakeDb({ anchored: ['pre-gone', 'pre-anchored-live'], emails: [] })
        });
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(0);
        expect(h.manifest().notFoundIds).toEqual(['pre-gone']);
    });

    it('reports an incomplete payer-email search without naming the email', async () => {
        // Arrange
        const h = harness({ sandbox: fakeSandbox({ totalOverride: { [EMAIL_B]: 5 } }) });
        // Act
        const code = await h.run(['--target=staging']);
        // Assert
        expect(code).toBe(1);
        expect(h.manifest().failures).toEqual([
            {
                code: 'SEARCH_INCOMPLETE',
                detail: 'payer email 2 of 2: walked 2 distinct of 5 (rows 2)'
            }
        ]);
    });
});

describe('HOS-1951 environment guards (fail-closed)', () => {
    it('refuses (exit 2) a token whose account is not a test account, before any read', async () => {
        // Arrange
        const h = harness({ sandbox: fakeSandbox({ tags: ['normal'] }) });
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(2);
        expect(h.errLines.join('\n')).toContain("no 'test_user' tag");
        expect(h.provider.calls).toEqual([]);
        expect(h.sandbox.calls).toEqual(['USERS_ME']);
        expect(h.db.connects).toBe(0);
    });

    it('refuses (exit 2) when the account cannot be read', async () => {
        // Arrange
        const sandbox = fakeSandbox();
        const failing: FakeSandbox = {
            calls: sandbox.calls,
            api: {
                ...sandbox.api,
                readAccountTags: async () => {
                    throw new ProviderError({ message: 'x', httpStatus: 401 });
                }
            }
        };
        const h = harness({ sandbox: failing });
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(2);
        expect(h.provider.calls).toEqual([]);
    });

    it('refuses (exit 2) a database that is not staging, before reading any source', async () => {
        // Arrange
        const h = harness({ db: fakeDb({ name: 'postgres' }) });
        // Act
        const code = await h.run(['--target=staging', '--apply']);
        // Assert
        expect(code).toBe(2);
        expect(h.errLines.join('\n')).toContain("the database is not 'hospeda_staging'");
        expect(h.db.queries).toEqual(['SELECT current_database() AS name']);
        expect(h.provider.calls).toEqual([]);
        expect(h.sandbox.calls).not.toContain('SEARCH');
        expect(h.db.ended).toBe(1);
    });

    it.each([
        [[]],
        [['--target=prod']],
        [['--target', 'production', '--apply']]
    ])('refuses (exit 2) without --target=staging: %j', async (args) => {
        // Arrange
        const h = harness();
        // Act
        const code = await h.run(args);
        // Assert
        expect(code).toBe(2);
        expect(h.sandbox.calls).toEqual([]);
        expect(h.db.connects).toBe(0);
        expect(h.provider.calls).toEqual([]);
    });

    it('refuses (exit 2) when a session variable is missing', async () => {
        // Arrange
        const h = harness({ session: { CUTOVER_MP_ACCESS_TOKEN: 'tok' } });
        // Act
        const code = await h.run(['--target=staging']);
        // Assert
        expect(code).toBe(2);
        expect(h.sandbox.calls).toEqual([]);
        expect(h.db.connects).toBe(0);
    });
});

describe('HOS-1951 retry from the manifest is idempotent', () => {
    it('a second run over the manifest, after the reset, sends nothing again', async () => {
        // Arrange: first real run cancels everything live
        const provider = createFakeProvider({ objects: OBJECTS });
        const first = harness({ provider });
        expect(await first.run(['--target=staging', '--apply'])).toBe(0);
        const cancelsAfterFirst = cancelCalls(provider).length;
        // the reset erased every anchor: the database has no sources any more
        const second = harness({ provider, db: fakeDb({ anchored: [], emails: [] }) });
        // Act
        const code = await second.run([
            '--target=staging',
            '--apply',
            '--from-manifest',
            first.manifestPath
        ]);
        // Assert
        expect(code).toBe(0);
        expect(cancelCalls(provider)).toHaveLength(cancelsAfterFirst);
        const m = second.manifest();
        expect(m.sources.manifestIds).toBe(4);
        expect(m.cancelRequestedIds).toEqual([]);
        expect(m.alreadyCancelledIds).toEqual([
            'pre-anchored-cancelled',
            'pre-anchored-live',
            'pre-loose-paused',
            'pre-loose-pending'
        ]);
    });

    it('a retry after a stuck cancellation cancels only what is still live', async () => {
        // Arrange: the first run leaves one preapproval stuck
        const provider = createFakeProvider({ objects: OBJECTS, stuckIds: ['pre-loose-paused'] });
        const first = harness({ provider });
        expect(await first.run(['--target=staging', '--apply'])).toBe(1);
        const second = harness({
            provider: createFakeProvider({ objects: [...provider.state.values()] }),
            db: fakeDb({ anchored: [], emails: [] })
        });
        // Act
        const code = await second.run([
            '--target=staging',
            '--apply',
            '--from-manifest',
            first.manifestPath
        ]);
        // Assert
        expect(code).toBe(0);
        expect(cancelCalls(second.provider)).toEqual(['CANCEL preapproval pre-loose-paused']);
        expect(second.manifest().cancelledIds).toEqual(['pre-loose-paused']);
    });

    it('refuses (exit 2) a file that is not a manifest of this run', async () => {
        // Arrange
        const h = harness();
        // Act
        const code = await h.run(['--target=staging', '--from-manifest', PROBES_EMPTY]);
        // Assert
        expect(code).toBe(2);
        expect(h.provider.calls).toEqual([]);
    });
});
