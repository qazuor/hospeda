import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectReadOnly, createKnownIdsReader } from '../../cutover/known-ids.ts';
import { runCutover } from '../../cutover/run-cutover.ts';
import type { FakeObject } from '../cutover/fake-provider.ts';
import { createFakeProvider } from '../cutover/fake-provider.ts';
import type { PgClient } from './scratch-db.ts';
import {
    applyMigrations,
    connect,
    createScratch,
    dropScratch,
    fingerprint,
    requireAdminUrl,
    withDatabase
} from './scratch-db.ts';

/**
 * TEST:U3:5 and TEST:U3:13 (AC:U3:2, AC:U3:4): the cutover script against a REAL
 * Postgres. The old database is built from `main`'s migrations (ref overridable with
 * CUTOVER_OLD_SCHEMA_REF) and seeded with live rows. The provider is simulated: no
 * network call leaves this test. Only databases created here are dropped.
 */
const suffix = randomBytes(4).toString('hex');
const OLD_DB = `cutover_u3_old_${suffix}`;
const NEW_DB = `cutover_u3_new_${suffix}`;
const session = process.env;
const oldRef = session.CUTOVER_OLD_SCHEMA_REF ?? 'origin/main';

const PERSON_EMAIL = 'person.example@example.invalid';

/**
 * Tables whose rows the new system's structural migration writes itself (HOS-1430,
 * `REFERENCE_TABLES` in @repo/db). They are reference data, not transcribed live rows,
 * so TEST:U3:13 exempts them from "the new system stays empty". Kept as literals: the
 * cutover side imports no code from the new system.
 */
const MIGRATION_REFERENCE_TABLES: readonly string[] = [
    'billing_deadline_version',
    'catalog_key',
    'plan',
    'plan_version',
    'plan_version_entitlement',
    'plan_version_limit',
    'vertical',
    'vertical_deadline_version'
];

let admin: PgClient;
let oldUrl: string;
let newUrl: string;

const KNOWN_PRE = ['pre-sub-1', 'pre-sub-2', 'pre-addon-1', 'pre-target-1'];
const KNOWN_PLANS = ['plan-mp-1', 'plan-addon-1', 'plan-checkout-1'];

const PROVIDER_OBJECTS: readonly FakeObject[] = [
    ...KNOWN_PRE.map((id) => ({ kind: 'preapproval' as const, id, status: 'authorized' })),
    ...KNOWN_PLANS.map((id) => ({ kind: 'plan' as const, id, status: 'active' })),
    { kind: 'preapproval', id: 'pre-never-linked', status: 'authorized' }
];

async function seedOld({ client }: { readonly client: PgClient }): Promise<void> {
    // Replica role skips FK triggers: the seed only needs the id columns the script reads.
    await client.query("SET session_replication_role = 'replica'");
    const cust = '00000000-0000-0000-0000-0000000000c1';
    await client.query(
        'INSERT INTO billing_customers (id, external_id, email, name) VALUES ($1, $2, $3, $4)',
        [cust, 'ext-1', PERSON_EMAIL, 'Some Person']
    );
    for (const [i, id] of ['pre-sub-1', 'pre-sub-2'].entries()) {
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
         VALUES ($1, 'visibility-boost-7d', 'pre-addon-1')`,
        [cust]
    );
    await client.query(
        `INSERT INTO billing_plan_price_change_targets
           (price_change_id, subscription_id, mp_subscription_id, target_amount)
         VALUES (gen_random_uuid(), gen_random_uuid(), 'pre-target-1', 1000)`
    );
    await client.query(
        `INSERT INTO billing_mp_plans
           (commercial_plan_id, billing_interval, mp_preapproval_plan_id, amount_ars)
         VALUES (gen_random_uuid(), 'month', 'plan-mp-1', 1000)`
    );
    await client.query(
        `INSERT INTO billing_mp_addon_plans (addon_id, billing_interval, mp_preapproval_plan_id, amount_ars)
         VALUES (gen_random_uuid(), 'month', 'plan-addon-1', 1000)`
    );
    await client.query(
        `INSERT INTO billing_pending_checkouts
           (local_subscription_id, customer_id, plan_id, mp_preapproval_plan_id, nonce, expires_at)
         VALUES (gen_random_uuid(), $1, 'plan-0', 'plan-checkout-1', 'nonce-1', now() + interval '1 day')`,
        [cust]
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

    // The new system's schema: the working tree's migration chain, left EMPTY.
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

function runAgainstOld({ objects }: { readonly objects: readonly FakeObject[] }) {
    const fake = createFakeProvider({ objects });
    return runCutover({
        api: fake.api,
        readKnownIds: createKnownIdsReader({ connectionString: oldUrl }),
        probeIds: [],
        dryRun: false,
        sleep: async () => {}
    });
}

describe('TEST:U3:5 known ids from the old database (AC:U3:4)', () => {
    it('reads the seeded ids from all six columns, ids only', async () => {
        // Arrange
        const read = createKnownIdsReader({ connectionString: oldUrl });
        // Act
        const known = await read();
        // Assert
        expect([...known.preapprovalIds].sort()).toEqual([...KNOWN_PRE].sort());
        expect([...known.planIds].sort()).toEqual([...KNOWN_PLANS].sort());
    });

    it('opens a connection that cannot write', async () => {
        // Arrange
        const client = await connectReadOnly({ connectionString: oldUrl });
        // Act
        const attempt = client.query("UPDATE billing_customers SET name = 'x'");
        // Assert
        await expect(attempt).rejects.toMatchObject({ code: '25006' });
        await client.end();
    });

    it('passes when every known id is in the walk, and fails when one is missing from it', async () => {
        // Arrange
        const complete = await runAgainstOld({ objects: PROVIDER_OBJECTS });
        const missingOne = await runAgainstOld({
            objects: PROVIDER_OBJECTS.filter((o) => o.id !== 'pre-sub-2')
        });
        // Assert
        expect(complete.ok).toBe(true);
        expect(complete.manifest.unknownLiveIds).toEqual(['pre-never-linked']);
        expect(missingOne.ok).toBe(false);
        expect(missingOne.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'KNOWN_ID_MISSING', id: 'pre-sub-2' })
        );
    });
});

describe('TEST:U3:13 the old commitment is cancelled, never transcribed (AC:U3:2)', () => {
    it('does not write to the old database and no live row appears in the new system tables', async () => {
        // Arrange
        const oldClient = await connect({ url: oldUrl });
        const newClient = await connect({ url: newUrl });
        const oldBefore = await fingerprint({ client: oldClient });
        const newBefore = await fingerprint({ client: newClient });
        // Act
        const result = await runAgainstOld({ objects: PROVIDER_OBJECTS });
        const oldAfter = await fingerprint({ client: oldClient });
        const newAfter = await fingerprint({ client: newClient });
        await oldClient.end();
        await newClient.end();
        // Assert
        expect(result.ok).toBe(true);
        expect(result.manifest.cancelledPreapprovalIds.length).toBeGreaterThan(0);
        expect(oldAfter).toEqual(oldBefore);
        expect(oldBefore.billing_subscriptions?.startsWith('2:')).toBe(true);
        expect(newAfter).toEqual(newBefore);
        for (const [table, state] of Object.entries(newAfter)) {
            if (MIGRATION_REFERENCE_TABLES.includes(table)) continue;
            expect(state.startsWith('0:')).toBe(true);
        }
        for (const table of MIGRATION_REFERENCE_TABLES) expect(newAfter[table]).toBeDefined();
        expect(JSON.stringify(result.manifest)).not.toContain(PERSON_EMAIL);
    });
});
