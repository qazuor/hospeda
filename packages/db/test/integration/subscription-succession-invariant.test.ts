import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

interface DbError {
    code?: string;
    constraint?: string;
}

async function withRollback(body: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await body(client);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

async function rejected(
    client: PoolClient,
    statement: string,
    params: unknown[]
): Promise<DbError | null> {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(statement, params);
        return null;
    } catch (error) {
        return error as DbError;
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}

/** The six statuses both partial indexes treat as live (migration 0139:227-228). */
const LIVE = [
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED'
] as const;

/** The three statuses outside the live set the indexes leave alone. */
const DEAD = ['ABANDONED', 'CANCELLED', 'CHARGE_DECLINED'] as const;

/** Seeds one user with a random slug/email and returns its id. */
async function seedUser(client: PoolClient): Promise<string> {
    const id = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        id,
        `b3-succession-${id}`,
        `b3-succession-${id}@example.test`
    ]);
    return id;
}

/** Seeds one plan + sellable current version + monthly option for a vertical. */
async function seedPlan(
    client: PoolClient,
    vertical: string
): Promise<{ planVersionId: string; billingOptionId: string }> {
    const plan = await client.query<{ id: string }>(
        "INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, 'B3.2 plan') RETURNING id",
        [vertical, `b3-succession-${crypto.randomUUID()}`]
    );
    const planId = plan.rows[0]?.id as string;
    const version = await client.query<{ id: string }>(
        `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
         VALUES ($1, $2, $3, true, true, 0, false) RETURNING id`,
        [planId, vertical, Math.floor(Math.random() * 100_000_000) + 1000]
    );
    const planVersionId = version.rows[0]?.id as string;
    const option = await client.query<{ id: string }>(
        `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
         VALUES ($1, 'monthly', 1000, 'ARS') RETURNING id`,
        [planVersionId]
    );
    return { planVersionId, billingOptionId: option.rows[0]?.id as string };
}

interface InsertSubscriptionArgs {
    readonly userId: string;
    readonly vertical: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly status: string;
    readonly class?: string;
    readonly succeedsId?: string | null;
    readonly succeededById?: string | null;
}

const INSERT_SUBSCRIPTION = `INSERT INTO subscription
    (user_id, vertical, plan_version_id, billing_option_id, payment_method, status, class, succeeds_id, succeeded_by_id)
    VALUES ($1, $2, $3, $4, 'CARD', $5, $6, $7, $8)`;

/** Seed args flattened into the positional array `INSERT_SUBSCRIPTION` expects. */
function subscriptionParams(args: InsertSubscriptionArgs): unknown[] {
    return [
        args.userId,
        args.vertical,
        args.planVersionId,
        args.billingOptionId,
        args.status,
        args.class ?? 'PRINCIPAL',
        args.succeedsId ?? null,
        args.succeededById ?? null
    ];
}

/** Inserts one seeded `subscription` row and returns its id. */
async function insertSubscription(
    client: PoolClient,
    args: InsertSubscriptionArgs
): Promise<string> {
    const row = await client.query<{ id: string }>(
        `${INSERT_SUBSCRIPTION} RETURNING id`,
        subscriptionParams(args)
    );
    return row.rows[0]?.id as string;
}

describe('TEST:B3:7 — subscription is born with the succession columns, the exclusion check and the two partial indexes (AC:B3:7)', () => {
    it('declares two nullable uuid self-referencing columns', async () => {
        const columns = await getTestPool().query<{
            column_name: string;
            data_type: string;
            is_nullable: string;
        }>(
            `SELECT column_name, data_type, is_nullable FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'subscription'
               AND column_name IN ('succeeds_id', 'succeeded_by_id')`
        );
        const byName = Object.fromEntries(columns.rows.map((r) => [r.column_name, r]));
        expect(byName.succeeds_id?.data_type).toBe('uuid');
        expect(byName.succeeds_id?.is_nullable).toBe('YES');
        expect(byName.succeeded_by_id?.data_type).toBe('uuid');
        expect(byName.succeeded_by_id?.is_nullable).toBe('YES');

        const fks = await getTestPool().query<{ conname: string; ref: string }>(
            `SELECT conname, confrelid::regclass::text AS ref FROM pg_constraint
             WHERE contype = 'f' AND conrelid = 'subscription'::regclass`
        );
        const byFk = Object.fromEntries(fks.rows.map((r) => [r.conname, r.ref]));
        expect(byFk.subscription_succeeds_id_subscription_id_fk).toBe('subscription');
        expect(byFk.subscription_succeeded_by_id_subscription_id_fk).toBe('subscription');
    });

    it('declares the exclusion check that forbids both columns at once', async () => {
        const defs = await getTestPool().query<{ def: string }>(
            `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
             WHERE conname = 'ck_subscription_succession_exclusive'
               AND conrelid = 'subscription'::regclass`
        );
        expect(defs.rows).toHaveLength(1);
        const def = defs.rows[0]?.def ?? '';
        expect(def.startsWith('CHECK')).toBe(true);
        expect(def).toContain('NOT');
        expect(def).toContain('succeeds_id IS NOT NULL');
        expect(def).toContain('succeeded_by_id IS NOT NULL');
    });

    it('declares two partial indexes split by succeeds_id over the six live statuses', async () => {
        const indexes = await getTestPool().query<{ indexname: string; indexdef: string }>(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'subscription'"
        );
        const byName = Object.fromEntries(indexes.rows.map((r) => [r.indexname, r.indexdef]));
        const origin = byName.uq_subscription_commitment_origin ?? '';
        const successor = byName.uq_subscription_commitment_successor ?? '';
        expect(origin).not.toBe('');
        expect(successor).not.toBe('');

        for (const def of [origin, successor]) {
            expect(def).toContain('CREATE UNIQUE INDEX');
            expect(def).toContain('(user_id, vertical)');
            expect(def).toContain("'PRINCIPAL'");
            for (const status of LIVE) {
                expect(def).toContain(`'${status}'`);
            }
            for (const status of DEAD) {
                expect(def).not.toContain(`'${status}'`);
            }
        }

        expect(origin).toContain('succeeds_id IS NULL');
        expect(origin).not.toContain('succeeds_id IS NOT NULL');
        expect(successor).toContain('succeeds_id IS NOT NULL');
        expect(successor).not.toContain('succeeds_id IS NULL');
    });
});

describe('TEST:B3:8 — the database refuses what invariant 8 forbids and accepts one origin with its one successor (AC:B3:7)', () => {
    it('refuses a second live origin for the same user and vertical', async () => {
        await withRollback(async (client) => {
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            for (const status of LIVE) {
                const error = await rejected(
                    client,
                    `${INSERT_SUBSCRIPTION} RETURNING id`,
                    subscriptionParams({
                        userId,
                        vertical: 'accommodation',
                        ...plan,
                        status
                    })
                );
                expect(error?.code).toBe('23505');
                expect(error?.constraint).toBe('uq_subscription_commitment_origin');
            }
        });
    });

    it('refuses a second live successor', async () => {
        await withRollback(async (client) => {
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            const origin = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: origin
            });
            const error = await rejected(
                client,
                `${INSERT_SUBSCRIPTION} RETURNING id`,
                subscriptionParams({
                    userId,
                    vertical: 'accommodation',
                    ...plan,
                    status: 'ACTIVE',
                    succeedsId: origin
                })
            );
            expect(error?.code).toBe('23505');
            expect(error?.constraint).toBe('uq_subscription_commitment_successor');
        });
    });

    it('refuses succeeding a successor through both closed doors', async () => {
        await withRollback(async (client) => {
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            const origin = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const successor = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: origin
            });

            // (c1) a second live successor collides on the successor index.
            const byIndex = await rejected(
                client,
                `${INSERT_SUBSCRIPTION} RETURNING id`,
                subscriptionParams({
                    userId,
                    vertical: 'accommodation',
                    ...plan,
                    status: 'ACTIVE',
                    succeedsId: successor
                })
            );
            expect(byIndex?.code).toBe('23505');
            expect(byIndex?.constraint).toBe('uq_subscription_commitment_successor');

            // (c2) pointing the successor both ways trips the exclusion check.
            const third = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'CANCELLED'
            });
            const byCheck = await rejected(
                client,
                'UPDATE subscription SET succeeded_by_id = $1 WHERE id = $2',
                [third, successor]
            );
            expect(byCheck?.code).toBe('23514');
            expect(byCheck?.constraint).toBe('ck_subscription_succession_exclusive');
        });
    });

    it('refuses a row pointing in both directions', async () => {
        await withRollback(async (client) => {
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            const origin = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const successor = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: origin
            });
            const error = await rejected(
                client,
                `${INSERT_SUBSCRIPTION} RETURNING id`,
                subscriptionParams({
                    userId,
                    vertical: 'accommodation',
                    ...plan,
                    status: 'CANCELLED',
                    succeedsId: origin,
                    succeededById: successor
                })
            );
            expect(error?.code).toBe('23514');
            expect(error?.constraint).toBe('ck_subscription_succession_exclusive');
        });
    });

    it('accepts one origin with its one live successor: two rows, one commitment', async () => {
        await withRollback(async (client) => {
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            const origin = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const successor = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: origin
            });
            expect(origin).toBeTruthy();
            expect(successor).toBeTruthy();

            const count = await client.query<{ n: string }>(
                `SELECT count(*)::text AS n FROM subscription
                 WHERE user_id = $1 AND vertical = $2 AND class = 'PRINCIPAL'
                   AND status::text = ANY($3::text[])`,
                [userId, 'accommodation', [...LIVE]]
            );
            expect(count.rows[0]?.n).toBe('2');
        });
    });

    it('counts only the live principal commitments the two indexes cover', async () => {
        await withRollback(async (client) => {
            const userId = await seedUser(client);
            const otherUserId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            const gastronomyPlan = await seedPlan(client, 'gastronomy');
            await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });

            // A dead origin of the same user and vertical is not in either index.
            for (const status of DEAD) {
                const dead = await insertSubscription(client, {
                    userId,
                    vertical: 'accommodation',
                    ...plan,
                    status
                });
                expect(dead).toBeTruthy();
            }

            // Another user keeps its own origin.
            const other = await insertSubscription(client, {
                userId: otherUserId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            expect(other).toBeTruthy();

            // Another vertical of the same user keeps its own origin.
            const gastronomy = await insertSubscription(client, {
                userId,
                vertical: 'gastronomy',
                planVersionId: gastronomyPlan.planVersionId,
                billingOptionId: gastronomyPlan.billingOptionId,
                status: 'ACTIVE'
            });
            expect(gastronomy).toBeTruthy();

            // A COMPLEMENTO is not a commitment and needs no plan anchor.
            await client.query(
                `INSERT INTO subscription (user_id, vertical, payment_method, status, class)
                 VALUES ($1, $2, 'CARD', 'ACTIVE', 'COMPLEMENTO')`,
                [userId, 'accommodation']
            );
        });
    });

    it('TEST:B3:8 mutation: without the origin index a second live origin is accepted', async () => {
        await withRollback(async (client) => {
            await client.query('DROP INDEX uq_subscription_commitment_origin');
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const error = await rejected(
                client,
                `${INSERT_SUBSCRIPTION} RETURNING id`,
                subscriptionParams({
                    userId,
                    vertical: 'accommodation',
                    ...plan,
                    status: 'ACTIVE'
                })
            );
            expect(error).toBeNull();
        });
    });

    it('TEST:B3:8 mutation: without the successor index a second live successor is accepted', async () => {
        await withRollback(async (client) => {
            await client.query('DROP INDEX uq_subscription_commitment_successor');
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            const origin = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: origin
            });
            const error = await rejected(
                client,
                `${INSERT_SUBSCRIPTION} RETURNING id`,
                subscriptionParams({
                    userId,
                    vertical: 'accommodation',
                    ...plan,
                    status: 'ACTIVE',
                    succeedsId: origin
                })
            );
            expect(error).toBeNull();
        });
    });

    it('TEST:B3:8 mutation: without the exclusion check a row pointing both ways is accepted', async () => {
        await withRollback(async (client) => {
            await client.query(
                'ALTER TABLE subscription DROP CONSTRAINT ck_subscription_succession_exclusive'
            );
            const userId = await seedUser(client);
            const plan = await seedPlan(client, 'accommodation');
            const origin = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const successor = await insertSubscription(client, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: origin
            });
            const error = await rejected(
                client,
                `${INSERT_SUBSCRIPTION} RETURNING id`,
                subscriptionParams({
                    userId,
                    vertical: 'accommodation',
                    ...plan,
                    status: 'CANCELLED',
                    succeedsId: origin,
                    succeededById: successor
                })
            );
            expect(error).toBeNull();
        });
    });
});
