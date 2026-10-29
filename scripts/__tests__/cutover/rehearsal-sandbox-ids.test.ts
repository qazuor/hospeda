import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RehearsalSandboxIdsCliDeps } from '../../cutover/cli-rehearsal-sandbox-ids-main.ts';
import { runRehearsalSandboxIdsCli } from '../../cutover/cli-rehearsal-sandbox-ids-main.ts';
import type { ReadOnlyClient } from '../../cutover/known-ids.ts';
import { ProviderError } from '../../cutover/provider-api.ts';
import type { RehearsalSandboxApi } from '../../cutover/rehearsal-sandbox-api.ts';
import type { SandboxIdsManifest } from '../../cutover/rehearsal-sandbox-ids.ts';
import { ID_COLUMNS } from '../../cutover/rehearsal-sandbox-ids.ts';
import type { ObjectKind } from '../../cutover/types.ts';

/**
 * HOS-1957, owner decision 1: the rehearsal sandbox-id rewrite. Every test drives the CLI entry
 * logic against a simulated sandbox and a simulated database that applies the rewrite to its own
 * state: no network, no database, no variables of the real process.
 */

const PAYER = 'buyer@testuser.com';

interface FakeDb {
    readonly client: ReadOnlyClient;
    readonly queries: string[];
    readonly plans: string[];
    readonly preapprovals: string[];
    ended: number;
}

function fakeDb({
    name = 'hospeda_staging',
    role = 'hospeda_staging_user',
    plans = ['prod-plan-1'],
    preapprovals = ['prod-pre-1', 'prod-pre-2'],
    stickyIds = []
}: {
    readonly name?: string;
    readonly role?: string;
    readonly plans?: readonly string[];
    readonly preapprovals?: readonly string[];
    /** Ids the simulated UPDATE does not rewrite (a column the run does not know). */
    readonly stickyIds?: readonly string[];
} = {}): FakeDb {
    const db: FakeDb = {
        queries: [],
        plans: [...plans],
        preapprovals: [...preapprovals],
        ended: 0,
        client: {
            query: async (sql, params) => {
                db.queries.push(sql.trim());
                if (sql.includes('current_database()')) return { rows: [{ name, role }] };
                if (
                    sql.includes('FROM billing_subscriptions WHERE mp_subscription_id IS NOT NULL')
                ) {
                    return { rows: db.preapprovals.map((id) => ({ id })) };
                }
                if (
                    sql.includes('FROM billing_mp_plans WHERE mp_preapproval_plan_id IS NOT NULL')
                ) {
                    return { rows: db.plans.map((id) => ({ id })) };
                }
                if (sql.includes('UPDATE')) {
                    const spec = ID_COLUMNS.find((c) => sql.includes(`UPDATE "${c.table}"`));
                    if (spec?.role !== 'primary') return { rows: [{ n: 0 }] };
                    const [olds, news] = (params ?? []) as [string[], string[]];
                    const state = spec.kind === 'plan' ? db.plans : db.preapprovals;
                    let n = 0;
                    for (const [i, id] of state.entries()) {
                        const at = olds.indexOf(id);
                        if (at >= 0 && !stickyIds.includes(id)) {
                            state[i] = String(news[at]);
                            n += 1;
                        }
                    }
                    return { rows: [{ n }] };
                }
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
    readonly api: RehearsalSandboxApi;
    readonly calls: string[];
    readonly createInputs: unknown[];
}

function fakeSandbox({
    existing = [],
    failLookup = false,
    failCreate = false
}: {
    readonly existing?: readonly string[];
    readonly failLookup?: boolean;
    readonly failCreate?: boolean;
} = {}): FakeSandbox {
    const objects = new Set(existing);
    const calls: string[] = [];
    const createInputs: unknown[] = [];
    let seq = 0;
    const create = (kind: ObjectKind): string => {
        if (failCreate) throw new ProviderError({ message: 'refused', httpStatus: 400 });
        seq += 1;
        const id = `sbx-${kind}-${seq}`;
        objects.add(id);
        calls.push(`CREATE ${kind} ${id}`);
        return id;
    };
    return {
        calls,
        createInputs,
        api: {
            lookup: async ({ kind, id }) => {
                calls.push(`GET ${kind} ${id}`);
                if (failLookup) throw new ProviderError({ message: 'boom', httpStatus: 500 });
                return objects.has(id) ? 'found' : 'not-found';
            },
            createPlan: async (input) => {
                createInputs.push(input);
                return create('plan');
            },
            createPreapproval: async (input) => {
                createInputs.push(input);
                return create('preapproval');
            }
        }
    };
}

const SESSION = {
    CUTOVER_MP_ACCESS_TOKEN: 'tok',
    CUTOVER_STAGING_DATABASE_URL: 'postgres://x/y',
    CUTOVER_PAYER_EMAIL: PAYER
};

function harness({
    db = fakeDb(),
    sandbox = fakeSandbox(),
    tags = ['test_user'],
    session = SESSION,
    failConnect = false
}: {
    readonly db?: FakeDb;
    readonly sandbox?: FakeSandbox;
    readonly tags?: readonly string[] | 'throw';
    readonly session?: Readonly<Record<string, string | undefined>>;
    readonly failConnect?: boolean;
} = {}) {
    const dir = mkdtempSync(path.join(tmpdir(), 'hos1957-ids-'));
    const manifestPath = path.join(dir, 'manifest.json');
    const errLines: string[] = [];
    const outLines: string[] = [];
    let connects = 0;
    const deps = (args: readonly string[]): RehearsalSandboxIdsCliDeps => ({
        args,
        session,
        createAccountApi: () => ({
            readAccountTags: async () => {
                if (tags === 'throw') throw new Error('network');
                return tags;
            },
            searchPreapprovalsByPayerEmail: async () => ({ total: 0, ids: [], rowsSeen: 0 })
        }),
        createSandboxApi: () => sandbox.api,
        connectDb: async () => {
            connects += 1;
            if (failConnect) throw new Error('refused');
            return db.client;
        },
        out: (line) => outLines.push(line),
        err: (line) => errLines.push(line)
    });
    return {
        db,
        sandbox,
        errLines,
        outLines,
        connects: () => connects,
        run: (args: readonly string[]) =>
            runRehearsalSandboxIdsCli(deps([...args, '--manifest-out', manifestPath])),
        manifestText: () => readFileSync(manifestPath, 'utf8'),
        manifest: (): SandboxIdsManifest =>
            JSON.parse(readFileSync(manifestPath, 'utf8')) as SandboxIdsManifest
    };
}

const wrote = (db: FakeDb): boolean =>
    db.queries.some((q) => q.startsWith('BEGIN') && !q.includes('READ ONLY'));

describe('HOS-1957 sandbox-id rewrite: guards refuse before any write (exit 2)', () => {
    const refusals: readonly {
        readonly title: string;
        readonly h: () => ReturnType<typeof harness>;
        readonly args: readonly string[];
    }[] = [
        { title: 'no --target', h: () => harness(), args: ['--confirm'] },
        { title: '--target=prod', h: () => harness(), args: ['--target=prod', '--confirm'] },
        {
            title: 'a missing token',
            h: () => harness({ session: { ...SESSION, CUTOVER_MP_ACCESS_TOKEN: undefined } }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: 'a missing payer email on --confirm',
            h: () => harness({ session: { ...SESSION, CUTOVER_PAYER_EMAIL: undefined } }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: 'a production token (no test_user tag)',
            h: () => harness({ tags: ['normal'] }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: 'an unreadable account',
            h: () => harness({ tags: 'throw' }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: "production's database name",
            h: () => harness({ db: fakeDb({ name: 'postgres' }) }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: "production's database role",
            h: () => harness({ db: fakeDb({ role: 'postgres' }) }),
            args: ['--target=staging', '--confirm']
        },
        {
            title: 'a failed connection',
            h: () => harness({ failConnect: true }),
            args: ['--target=staging', '--confirm']
        }
    ];

    for (const { title, h: build, args } of refusals) {
        it(`refuses on ${title}`, async () => {
            // Arrange
            const h = build();
            // Act
            const code = await h.run(args);
            // Assert
            expect(code).toBe(2);
            expect(h.sandbox.calls).toEqual([]);
            expect(wrote(h.db)).toBe(false);
        });
    }

    it('checks the token before opening the database', async () => {
        // Arrange
        const h = harness({ tags: ['normal'] });
        // Act
        await h.run(['--target=staging']);
        // Assert
        expect(h.connects()).toBe(0);
    });

    it('closes the session it opened when the database is not staging', async () => {
        // Arrange
        const h = harness({ db: fakeDb({ name: 'postgres' }) });
        // Act
        await h.run(['--target=staging']);
        // Assert
        expect(h.db.ended).toBe(1);
    });
});

describe('HOS-1957 sandbox-id rewrite: dry run (the default)', () => {
    it('reads every id by id, creates nothing, writes nothing, needs no payer email', async () => {
        // Arrange
        const h = harness({ session: { ...SESSION, CUTOVER_PAYER_EMAIL: undefined } });
        // Act
        const code = await h.run(['--target=staging']);
        // Assert
        expect(code).toBe(0);
        expect(h.sandbox.calls).toEqual([
            'GET plan prod-plan-1',
            'GET preapproval prod-pre-1',
            'GET preapproval prod-pre-2'
        ]);
        expect(wrote(h.db)).toBe(false);
        expect(h.manifest()).toMatchObject({
            outcome: 'dry-run',
            toMirrorIds: ['prod-plan-1', 'prod-pre-1', 'prod-pre-2'],
            mappings: []
        });
    });
});

describe('HOS-1957 sandbox-id rewrite: confirmed run', () => {
    it('mirrors each production id, rewrites the copy in one transaction and maps them', async () => {
        // Arrange
        const h = harness();
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(0);
        expect(h.db.plans).toEqual(['sbx-plan-1']);
        expect(h.db.preapprovals).toEqual(['sbx-preapproval-2', 'sbx-preapproval-3']);
        expect(h.db.queries.filter((q) => q === 'BEGIN')).toHaveLength(1);
        expect(h.db.queries).toContain('COMMIT');
        expect(h.db.queries.filter((q) => q.includes('UPDATE'))).toHaveLength(ID_COLUMNS.length);
        const manifest = h.manifest();
        expect(manifest.outcome).toBe('ok');
        expect(manifest.mappings).toEqual([
            { kind: 'plan', prodId: 'prod-plan-1', sandboxId: 'sbx-plan-1' },
            { kind: 'preapproval', prodId: 'prod-pre-1', sandboxId: 'sbx-preapproval-2' },
            { kind: 'preapproval', prodId: 'prod-pre-2', sandboxId: 'sbx-preapproval-3' }
        ]);
        expect(manifest.rewrittenRows['billing_subscriptions.mp_subscription_id']).toBe(2);
        expect(h.manifestText()).not.toContain(PAYER);
        expect(h.outLines.join('\n')).not.toContain(PAYER);
    });

    it('uses one deterministic idempotency key per production id', async () => {
        // Arrange
        const h = harness();
        // Act
        await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(h.sandbox.createInputs).toEqual([
            { idempotencyKey: 'hospeda-rehearsal-plan-prod-plan-1' },
            { payerEmail: PAYER, idempotencyKey: 'hospeda-rehearsal-preapproval-prod-pre-1' },
            { payerEmail: PAYER, idempotencyKey: 'hospeda-rehearsal-preapproval-prod-pre-2' }
        ]);
    });

    it('is a no-op on a copy that already holds sandbox ids (a re-run)', async () => {
        // Arrange
        const sandbox = fakeSandbox({ existing: ['sbx-a', 'sbx-b'] });
        const h = harness({ sandbox, db: fakeDb({ plans: ['sbx-a'], preapprovals: ['sbx-b'] }) });
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(0);
        expect(sandbox.calls.filter((c) => c.startsWith('CREATE'))).toEqual([]);
        expect(wrote(h.db)).toBe(false);
        expect(h.manifest()).toMatchObject({
            outcome: 'ok',
            alreadySandboxIds: ['sbx-a', 'sbx-b']
        });
    });

    it('stops before creating anything when a lookup fails', async () => {
        // Arrange
        const h = harness({ sandbox: fakeSandbox({ failLookup: true }) });
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(1);
        expect(h.sandbox.calls.filter((c) => c.startsWith('CREATE'))).toEqual([]);
        expect(wrote(h.db)).toBe(false);
        expect(h.manifest().failures[0]?.code).toBe('PROVIDER_ERROR');
    });

    it('writes nothing to the copy when a mirror cannot be created', async () => {
        // Arrange
        const h = harness({ sandbox: fakeSandbox({ failCreate: true }) });
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(1);
        expect(wrote(h.db)).toBe(false);
        expect(h.manifest().failures[0]?.code).toBe('CREATE_FAILED');
    });

    it('rolls the whole rewrite back when an id survives it', async () => {
        // Arrange
        const h = harness({ db: fakeDb({ stickyIds: ['prod-pre-2'] }) });
        // Act
        const code = await h.run(['--target=staging', '--confirm']);
        // Assert
        expect(code).toBe(1);
        expect(h.db.queries).toContain('ROLLBACK');
        expect(h.db.queries).not.toContain('COMMIT');
        const manifest = h.manifest();
        expect(manifest.failures).toEqual([
            {
                code: 'REWRITE_INCOMPLETE',
                id: 'prod-pre-2',
                detail: 'still in the copy after the rewrite'
            }
        ]);
        expect(manifest.rewrittenRows).toEqual({});
    });
});
