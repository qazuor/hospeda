/**
 * HOS-2658 AC-29: after data-migration 0195, the REAL effective set (production
 * catalog from migration 0144, trial resolution of `trial-ratchet.ts`, no port
 * replaced) gives a venue owner in trial `ai_translate` with the Basic monthly
 * limit (200), and a venue-pro subscriber the Pro limit (1000).
 */
import { randomUUID } from 'node:crypto';
import { and, billingOptions, eq, getDb, plans, planVersions, sql, subscriptions } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as grant from '../../../../../packages/seed/src/data-migrations/0195-hos-2658-ai-translate-venue-experience-grant';
import type { SeedMigrationCtx } from '../../../../../packages/seed/src/data-migrations/types';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { evaluateAiQuota } from '../../../src/utils/listing-access/ai-quota-gate';
import { testDb } from '../../e2e/setup/test-database';
import { createOwner, createTrial } from '../listing-publication/publication-routes.helpers';

// The composition root injects the clock the trial resolution reads.
initApp();

const owners: string[] = [];
const createdOptionIds: string[] = [];

async function seedUsage(userId: string, count: number): Promise<void> {
    await getDb().execute(
        sql`INSERT INTO ai_usage (id, user_id, feature, provider, model, tokens_in, tokens_out, cost_estimate_micro_usd, latency_ms, status)
            SELECT gen_random_uuid(), ${userId}::uuid, 'translate', 'stub', 'stub-model', 1, 1, 0, 1, 'success'
            FROM generate_series(1, ${count})`
    );
}

const evaluate = (userId: string) =>
    evaluateAiQuota({
        userId,
        vertical: VerticalEnum.VENUE,
        feature: 'translate',
        entitlementKey: 'ai_translate',
        limitKey: 'max_ai_translate_per_month'
    });

/** An ACTIVE principal subscription anchored on the current venue-pro version. */
async function subscribeToVenuePro(userId: string): Promise<void> {
    const db = getDb();
    const [version] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                eq(plans.vertical, VerticalEnum.VENUE),
                eq(plans.slug, 'venue-pro'),
                eq(planVersions.current, true)
            )
        )
        .limit(1);
    if (!version) throw new Error('venue-pro is not in the catalog');
    // The migrated catalog carries plan versions but no prices (prices are not
    // seeded by migrations), so the fixture owns its monthly option: created when
    // absent, reused when present, removed afterwards only if it created it.
    const inserted = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .onConflictDoNothing({ target: [billingOptions.planVersionId, billingOptions.cycle] })
        .returning({ id: billingOptions.id });
    createdOptionIds.push(...inserted.map((row) => row.id));
    const [option] = await db
        .select({ id: billingOptions.id })
        .from(billingOptions)
        .where(
            and(eq(billingOptions.planVersionId, version.id), eq(billingOptions.cycle, 'monthly'))
        )
        .limit(1);
    if (!option) throw new Error('venue-pro monthly billing option could not be resolved');
    await db.insert(subscriptions).values({
        userId,
        vertical: VerticalEnum.VENUE,
        planVersionId: version.id,
        billingOptionId: option.id,
        paymentMethod: 'CARD',
        status: 'ACTIVE',
        class: 'PRINCIPAL'
    });
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    await getDb().transaction(async (tx) => {
        await grant.up({ db: tx } as unknown as SeedMigrationCtx);
    });
});

afterAll(async () => {
    for (const userId of owners) {
        await getDb().execute(sql`DELETE FROM ai_usage WHERE user_id = ${userId}::uuid`);
        await getDb().execute(sql`DELETE FROM subscription WHERE user_id = ${userId}::uuid`);
        // `trial` rows are append-only (trigger reject_trial_delete); the database is
        // disposable, so they stay.
    }
    for (const optionId of createdOptionIds) {
        await getDb().execute(sql`DELETE FROM billing_option WHERE id = ${optionId}::uuid`);
    }
    await testDb.teardown();
});

describe('venue AI translation quota after 0195 (HOS-2658 AC-29)', () => {
    it('a venue owner in trial may translate, and is blocked at 200 calls', async () => {
        // Arrange
        const owner = await createOwner({ email: `trial-${randomUUID()}@example.test` });
        owners.push(owner.id);
        await createTrial({
            userId: owner.id,
            vertical: VerticalEnum.VENUE,
            status: 'TRIAL_ACTIVE'
        });

        // Act
        const fresh = await evaluate(owner.id);
        await seedUsage(owner.id, 199);
        const atLast = await evaluate(owner.id);
        await seedUsage(owner.id, 1);
        const atLimit = await evaluate(owner.id);

        // Assert
        expect(fresh).toEqual({ allowed: true });
        expect(atLast).toEqual({ allowed: true });
        expect(atLimit).toEqual({
            allowed: false,
            reason: 'quota',
            key: 'max_ai_translate_per_month',
            max: 200,
            count: 200
        });
    });

    it('a venue-pro subscriber has the Pro limit of 1000', async () => {
        // Arrange
        const owner = await createOwner({ email: `pro-${randomUUID()}@example.test` });
        owners.push(owner.id);
        await subscribeToVenuePro(owner.id);
        await seedUsage(owner.id, 1000);

        // Act
        const decision = await evaluate(owner.id);

        // Assert
        expect(decision).toEqual({
            allowed: false,
            reason: 'quota',
            key: 'max_ai_translate_per_month',
            max: 1000,
            count: 1000
        });
    });
});
