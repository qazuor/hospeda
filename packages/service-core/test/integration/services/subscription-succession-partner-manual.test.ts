import { billingOptions, eq, getDb, plans, planVersions, subscriptions, users } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { noTouristVip } from './support/tourist-vip';

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

afterAll(closeServiceTestPool);

describe('TEST:1739:3 succession rejects manual-only Partner plans', () => {
    it('rejects before admitting the predecessor or calling the provider', async () => {
        const db = getDb();
        const [user] = await db
            .insert(users)
            .values({
                email: `partner-succession-${crypto.randomUUID()}@example.test`,
                displayName: 'Partner succession user',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning();
        if (!user) throw new Error('Could not seed partner succession user');
        const [plan] = await db
            .insert(plans)
            .values({
                vertical: 'partner',
                slug: `partner-${crypto.randomUUID()}`,
                name: 'Partner Silver'
            })
            .returning();
        if (!plan) throw new Error('Could not seed partner succession plan');
        const [version] = await db
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'partner',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        if (!version) throw new Error('Could not seed partner succession plan version');
        const [option] = await db
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'monthly',
                amount: 1500000,
                currency: 'ARS'
            })
            .returning();
        if (!option) throw new Error('Could not seed partner succession billing option');

        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const readAuthorization = vi.spyOn(fake, 'readAuthorization');
        const authorize = vi.spyOn(fake, 'authorize');
        const result = await startSuccession(
            {
                userId: user.id,
                predecessorSubscriptionId: crypto.randomUUID(),
                billingOptionId: option.id,
                returnUrl: 'https://example.test'
            },
            {
                provider: fake,
                clock,
                planPolicy: async () => ({
                    graceDays: 10,
                    allowsPause: false,
                    current: true,
                    sellable: true
                }),
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            }
        ).then(
            (value) => ({ value }),
            (error: unknown) => ({ error })
        );

        expect('error' in result).toBe(true);
        if ('error' in result) {
            expect(result.error).toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'PARTNER_MANUAL_ONLY'
            });
        }
        expect(readAuthorization).not.toHaveBeenCalled();
        expect(authorize).not.toHaveBeenCalled();
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        expect(rows).toHaveLength(0);
    });
});
