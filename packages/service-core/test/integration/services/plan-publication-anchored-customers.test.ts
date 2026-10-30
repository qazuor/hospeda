import { billingOptions, LIVE_SUBSCRIPTION_STATUSES, subscriptions, users } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { countAnchoredCustomersFromSubscriptions } from '../../../src/services/plan-catalog/plan-publication.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

afterAll(closeServiceTestPool);

// HOS-1653 covers AC:V2:6: the confirmation says how many customers it reaches.
describe('HOS-1653 countAnchoredCustomersFromSubscriptions', () => {
    async function seedChoice(): Promise<{
        versionId: string;
        optionId: string;
        otherVersionId: string;
        otherOptionId: string;
    }> {
        const pool = getServiceTestPool();
        const planId = (
            await pool.query<{ id: string }>(
                'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
                ['accommodation', `hos-1653-${crypto.randomUUID()}`, 'HOS-1653 plan']
            )
        ).rows[0]?.id;
        if (!planId) throw new Error('No plan');
        const versionId = (
            await pool.query<{ id: string }>(
                `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
                 VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id`,
                [planId, Math.floor(Math.random() * 100000000) + 1000]
            )
        ).rows[0]?.id;
        const otherVersionId = (
            await pool.query<{ id: string }>(
                `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
                 VALUES ($1, 'accommodation', $2, true, false, 0, false) RETURNING id`,
                [planId, Math.floor(Math.random() * 100000000) + 100000000]
            )
        ).rows[0]?.id;
        if (!versionId || !otherVersionId) throw new Error('No version');
        const db = getServiceTestDb();
        const [option] = await db
            .insert(billingOptions)
            .values({ planVersionId: versionId, cycle: 'monthly', amount: 1000, currency: 'ARS' })
            .returning({ id: billingOptions.id });
        const [otherOption] = await db
            .insert(billingOptions)
            .values({
                planVersionId: otherVersionId,
                cycle: 'monthly',
                amount: 1000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option || !otherOption) throw new Error('No option');
        return { versionId, optionId: option.id, otherVersionId, otherOptionId: otherOption.id };
    }

    async function seedSubscription(input: {
        versionId: string;
        optionId: string;
        status: string;
        userId?: string;
        succeedsId?: string;
    }): Promise<{ userId: string; subscriptionId: string }> {
        const db = getServiceTestDb();
        let userId = input.userId;
        if (!userId) {
            const [user] = await db
                .insert(users)
                .values({
                    email: `hos-1653-${crypto.randomUUID()}@example.test`,
                    displayName: 'HOS-1653 customer',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                })
                .returning({ id: users.id });
            if (!user) throw new Error('No user');
            userId = user.id;
        }
        const [subscription] = await db
            .insert(subscriptions)
            .values({
                userId,
                vertical: 'accommodation',
                planVersionId: input.versionId,
                billingOptionId: input.optionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: input.status,
                succeedsId: input.succeedsId ?? null
            })
            .returning({ id: subscriptions.id });
        if (!subscription) throw new Error('No subscription');
        return { userId, subscriptionId: subscription.id };
    }

    it('HOS-1653 excludes terminal rows and another version of the same plan', async () => {
        const choice = await seedChoice();
        await seedSubscription({
            versionId: choice.versionId,
            optionId: choice.optionId,
            status: 'ACTIVE'
        });
        for (const status of ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED']) {
            await seedSubscription({
                versionId: choice.versionId,
                optionId: choice.optionId,
                status
            });
        }
        await seedSubscription({
            versionId: choice.otherVersionId,
            optionId: choice.otherOptionId,
            status: 'ACTIVE'
        });
        expect(
            await countAnchoredCustomersFromSubscriptions({ planVersionId: choice.versionId })
        ).toBe(1);
    });

    it('HOS-1653 returns zero without a prior version', async () => {
        expect(await countAnchoredCustomersFromSubscriptions({ planVersionId: null })).toBe(0);
    });

    it('HOS-1653 includes all six live subscription statuses', async () => {
        const choice = await seedChoice();
        for (const status of LIVE_SUBSCRIPTION_STATUSES) {
            await seedSubscription({
                versionId: choice.versionId,
                optionId: choice.optionId,
                status
            });
        }
        expect(
            await countAnchoredCustomersFromSubscriptions({ planVersionId: choice.versionId })
        ).toBe(6);
    });

    it('HOS-1653 counts one customer with live origin and successor only once', async () => {
        const choice = await seedChoice();
        const origin = await seedSubscription({
            versionId: choice.versionId,
            optionId: choice.optionId,
            status: 'ACTIVE'
        });
        await seedSubscription({
            versionId: choice.versionId,
            optionId: choice.optionId,
            status: 'PENDING_AUTHORIZATION',
            userId: origin.userId,
            succeedsId: origin.subscriptionId
        });
        expect(
            await countAnchoredCustomersFromSubscriptions({ planVersionId: choice.versionId })
        ).toBe(1);
    });
});
