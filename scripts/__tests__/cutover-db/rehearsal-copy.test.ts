import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectWritable, createKnownIdsReader } from '../../cutover/known-ids.ts';
import { discoverTextColumns, runEmailRewrite } from '../../cutover/rehearsal-email-rewrite.ts';
import type { RehearsalSandboxApi } from '../../cutover/rehearsal-sandbox-api.ts';
import type { SandboxIdsManifest } from '../../cutover/rehearsal-sandbox-ids.ts';
import { runSandboxIdRewrite } from '../../cutover/rehearsal-sandbox-ids.ts';
import { runCutover } from '../../cutover/run-cutover.ts';
import type { ObjectKind } from '../../cutover/types.ts';
import { createManifestWriter } from '../../cutover/write-manifest.ts';
import type { FakeObject } from '../cutover/fake-provider.ts';
import { createFakeProvider } from '../cutover/fake-provider.ts';
import type { PgClient } from './scratch-db.ts';
import {
    applyMigrations,
    connect,
    createScratch,
    dropScratch,
    fingerprint,
    PRE_CUTOVER_MAIN_SHA,
    requireAdminUrl,
    withDatabase
} from './scratch-db.ts';

/**
 * HOS-1957: the two rehearsal-copy tools against a REAL Postgres. The copy is built from `main`'s
 * migrations (the old schema production runs; ref overridable with CUTOVER_OLD_SCHEMA_REF) and the
 * new schema from the working tree. The provider is simulated. The staging guard is not under test
 * here (the CLI tests cover it): the run functions are called on a scratch database directly.
 */
const suffix = randomBytes(4).toString('hex');
const OLD_DB = `rehearsal_copy_old_${suffix}`;
const NEW_DB = `rehearsal_copy_new_${suffix}`;
const session = process.env;
const oldRef = session.CUTOVER_OLD_SCHEMA_REF ?? PRE_CUTOVER_MAIN_SHA;

const PROD_PRE = ['prod-pre-sub-1', 'prod-pre-sub-2', 'prod-pre-addon-1', 'prod-pre-target-1'];
const PROD_PLANS = ['prod-plan-mp-1', 'prod-plan-addon-1', 'prod-plan-checkout-1'];
const FOREIGN_SQL = `'[a-z0-9._%+-]+@(?!example\\.invalid([^a-z0-9.-]|$))[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}'`;

let admin: PgClient;
let oldUrl: string;
let newUrl: string;

async function seedOld({ client }: { readonly client: PgClient }): Promise<void> {
    await client.query("SET session_replication_role = 'replica'");
    const cust = '00000000-0000-0000-0000-0000000000c1';
    await client.query(
        `INSERT INTO users (id, slug, email) VALUES
           ('00000000-0000-0000-0000-0000000000a1', 'ana', 'Ana@Example.com'),
           ('00000000-0000-0000-0000-0000000000a2', 'bob', 'bob@example.org')`
    );
    await client.query(
        'INSERT INTO billing_customers (id, external_id, email, name) VALUES ($1, $2, $3, $4)',
        [cust, 'ext-1', ' ana@example.com ', 'Ana']
    );
    for (const [i, id] of ['prod-pre-sub-1', 'prod-pre-sub-2'].entries()) {
        await client.query(
            `INSERT INTO billing_subscriptions
               (customer_id, plan_id, status, billing_interval, current_period_start,
                current_period_end, mp_subscription_id, product_domain)
             VALUES ($1, $2, 'active', 'month', now(), now() + interval '30 days', $3, 'accommodation')`,
            [cust, `plan-${i}`, id]
        );
    }
    await client.query(
        `INSERT INTO billing_addon_purchases (customer_id, addon_slug, mp_subscription_id)
         VALUES ($1, 'visibility-boost-7d', 'prod-pre-addon-1')`,
        [cust]
    );
    await client.query(
        `INSERT INTO billing_plan_price_change_targets
           (price_change_id, subscription_id, mp_subscription_id, target_amount)
         VALUES (gen_random_uuid(), gen_random_uuid(), 'prod-pre-target-1', 1000)`
    );
    await client.query(
        `INSERT INTO billing_subscription_polling_jobs (subscription_id, provider, provider_resource_id)
         VALUES (gen_random_uuid(), 'mercadopago', 'prod-pre-sub-1')`
    );
    await client.query(
        `INSERT INTO billing_mp_plans (commercial_plan_id, billing_interval, mp_preapproval_plan_id, amount_ars)
         VALUES (gen_random_uuid(), 'month', 'prod-plan-mp-1', 1000)`
    );
    await client.query(
        `INSERT INTO billing_mp_addon_plans (addon_id, billing_interval, mp_preapproval_plan_id, amount_ars)
         VALUES (gen_random_uuid(), 'month', 'prod-plan-addon-1', 1000)`
    );
    await client.query(
        `INSERT INTO billing_pending_checkouts
           (local_subscription_id, customer_id, plan_id, mp_preapproval_plan_id, nonce, payer_email, expires_at)
         VALUES (gen_random_uuid(), $1, 'plan-0', 'prod-plan-checkout-1', 'nonce-1', 'bob@example.org', now() + interval '1 day')`,
        [cust]
    );
    await client.query(
        `INSERT INTO billing_prices (plan_id, currency, unit_amount, billing_interval, mp_price_id, metadata)
         VALUES (gen_random_uuid(), 'ARS', 1000, 'month', 'prod-plan-mp-1', '{"contact":"Carl@Example.net","n":1}')`
    );
    await client.query("SET session_replication_role = 'origin'");
}

beforeAll(async () => {
    admin = await connect({ url: requireAdminUrl() });
    await createScratch({ admin, name: OLD_DB });
    await createScratch({ admin, name: NEW_DB });
    oldUrl = withDatabase({ url: requireAdminUrl(), database: OLD_DB });
    newUrl = withDatabase({ url: requireAdminUrl(), database: NEW_DB });
    const oldClient = await connect({ url: oldUrl });
    await applyMigrations({ client: oldClient, source: { kind: 'git-ref', ref: String(oldRef) } });
    await seedOld({ client: oldClient });
    await oldClient.end();
    const newClient = await connect({ url: newUrl });
    await applyMigrations({ client: newClient, source: { kind: 'working-tree' } });
    await newClient.end();
}, 180_000);

afterAll(async () => {
    if (admin) {
        await dropScratch({ admin, name: OLD_DB });
        await dropScratch({ admin, name: NEW_DB });
        await admin.end();
    }
});

async function withClient<T>(url: string, fn: (client: PgClient) => Promise<T>): Promise<T> {
    const client = await connectWritable({ connectionString: url });
    try {
        return await fn(client as PgClient);
    } finally {
        await client.end();
    }
}

describe('HOS-1957 G2 email rewrite on the old schema', () => {
    it('a dry run counts the addresses and changes nothing', async () => {
        // Arrange
        const before = await withClient(oldUrl, (client) => fingerprint({ client }));
        // Act
        const report = await withClient(oldUrl, (client) =>
            runEmailRewrite({ mode: 'dry-run', client, salt: 's' })
        );
        const after = await withClient(oldUrl, (client) => fingerprint({ client }));
        // Assert
        expect(after).toEqual(before);
        expect(report.columns).toEqual(
            expect.arrayContaining([
                { column: 'public.users.email', whole: 2, embedded: 0 },
                { column: 'public.billing_customers.email', whole: 1, embedded: 0 },
                { column: 'public.billing_pending_checkouts.payer_email', whole: 1, embedded: 0 },
                { column: 'public.billing_prices.metadata', whole: 0, embedded: 1 }
            ])
        );
    });

    it('--confirm leaves no deliverable address, keeps one mailbox one address, and is idempotent', async () => {
        // Act
        const report = await withClient(oldUrl, (client) =>
            runEmailRewrite({ mode: 'confirm', client, salt: 'secret' })
        );
        const second = await withClient(oldUrl, (client) =>
            runEmailRewrite({ mode: 'confirm', client, salt: 'other' })
        );
        const rows = await withClient(oldUrl, async (client) => ({
            users: (await client.query('SELECT slug, email FROM users ORDER BY slug')).rows,
            customer: (await client.query('SELECT email FROM billing_customers')).rows[0]?.email,
            checkout: (await client.query('SELECT payer_email FROM billing_pending_checkouts'))
                .rows[0]?.payer_email,
            metadata: (await client.query('SELECT metadata FROM billing_prices')).rows[0]?.metadata,
            left: (
                await client.query(
                    `SELECT count(*)::int AS n FROM users WHERE email ~* ${FOREIGN_SQL}`
                )
            ).rows[0]?.n
        }));
        // Assert
        expect(report.outcome).toBe('ok');
        expect(report.remainingRows).toBe(0);
        expect(second.totals.rows).toBe(0);
        const [ana, bob] = rows.users;
        expect(String(ana?.email)).toMatch(/^rehearsal\+[0-9a-f-]{36}@example\.invalid$/);
        expect(rows.customer).toBe(ana?.email);
        expect(rows.checkout).toBe(bob?.email);
        expect(ana?.email).not.toBe(bob?.email);
        expect(rows.metadata).toEqual({ contact: 'rehearsal@example.invalid', n: 1 });
        expect(rows.left).toBe(0);
    });
});

describe('HOS-1957 email rewrite finds the mailbox columns of the new schema', () => {
    it('discovers the new subscription payer email and the users table', async () => {
        // Act
        const columns = await withClient(newUrl, (client) => discoverTextColumns({ client }));
        const names = columns.map((c) => `${c.table}.${c.column}`);
        // Assert
        expect(names).toContain('users.email');
        expect(names).toContain('subscription.declared_payer_email');
        expect(names.some((n) => n.startsWith('__drizzle_migrations'))).toBe(false);
    });
});

function fakeSandbox(): {
    readonly api: RehearsalSandboxApi;
    readonly objects: Map<string, ObjectKind>;
} {
    const objects = new Map<string, ObjectKind>();
    let seq = 0;
    const create = (kind: ObjectKind): string => {
        seq += 1;
        const id = `sbx-${kind}-${seq}`;
        objects.set(id, kind);
        return id;
    };
    return {
        objects,
        api: {
            lookup: async ({ id }) => (objects.has(id) ? 'found' : 'not-found'),
            createPlan: async () => create('plan'),
            createPreapproval: async () => create('preapproval')
        }
    };
}

describe('HOS-1957 sandbox-id rewrite on the old schema (owner decision 1)', () => {
    it('rewrites every id column, followers included, and the U3 run then finds every known id', async () => {
        // Arrange
        const sandbox = fakeSandbox();
        const dir = mkdtempSync(path.join(tmpdir(), 'hos1957-db-'));
        const writer = createManifestWriter<SandboxIdsManifest>({
            wantedPath: path.join(dir, 'm.json'),
            fallback: () => undefined
        });
        // Act
        const manifest = await withClient(oldUrl, (client) =>
            runSandboxIdRewrite({
                mode: 'confirm',
                client,
                api: sandbox.api,
                payerEmail: 'b@testuser.com',
                writer
            })
        );
        const known = await createKnownIdsReader({ connectionString: oldUrl })();
        const followers = await withClient(oldUrl, async (client) => ({
            job: (
                await client.query(
                    'SELECT provider_resource_id AS v FROM billing_subscription_polling_jobs'
                )
            ).rows[0]?.v,
            price: (await client.query('SELECT mp_price_id AS v FROM billing_prices')).rows[0]?.v
        }));
        const objects: FakeObject[] = [...sandbox.objects].map(([id, kind]) => ({
            kind,
            id,
            status: kind === 'plan' ? 'active' : 'pending'
        }));
        const cutover = await runCutover({
            api: createFakeProvider({ objects }).api,
            readKnownIds: createKnownIdsReader({ connectionString: oldUrl }),
            probeIds: [],
            dryRun: true,
            sleep: async () => {}
        });
        // Assert
        expect(manifest.outcome).toBe('ok');
        expect(manifest.mappings.map((m) => m.prodId).sort()).toEqual(
            [...PROD_PLANS, ...PROD_PRE].sort()
        );
        expect(
            [...known.planIds, ...known.preapprovalIds].every((id) => sandbox.objects.has(id))
        ).toBe(true);
        const map = new Map(manifest.mappings.map((m) => [m.prodId, m.sandboxId]));
        expect(followers.job).toBe(map.get('prod-pre-sub-1'));
        expect(followers.price).toBe(map.get('prod-plan-mp-1'));
        expect(manifest.rewrittenRows['billing_subscriptions.mp_subscription_id']).toBe(2);
        expect(cutover.manifest.failures.filter((f) => f.code === 'KNOWN_ID_MISSING')).toEqual([]);
    });
});
