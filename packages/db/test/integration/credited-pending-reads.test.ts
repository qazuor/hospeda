import { afterAll, describe, expect, it } from 'vitest';
import { findCreditedPendingAuthorizations } from '../../src/models/subscription/credited-pending.reads.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { payments } from '../../src/schemas/vertical/payment.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { providerLinks } from '../../src/schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

describe('TEST:1740:1 credited pending selector', () => {
    it('returns only qualifying pending principal subscriptions once, within their window', async () => {
        await withTestTransaction(async (tx) => {
            const [user] = await tx
                .insert(users)
                .values({
                    email: `credited-${crypto.randomUUID()}@example.test`,
                    displayName: 'Credited',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!user) throw new Error('Expected user');
            const [plan] = await tx
                .insert(plans)
                .values({
                    vertical: 'accommodation',
                    slug: `credited-${crypto.randomUUID()}`,
                    name: 'Plan'
                })
                .returning();
            if (!plan) throw new Error('Expected plan');
            const [version] = await tx
                .insert(planVersions)
                .values({
                    planId: plan.id,
                    vertical: 'accommodation',
                    rank: Math.floor(Math.random() * 1e8),
                    sellable: true,
                    current: true,
                    trialDays: 0,
                    allowsPause: false
                })
                .returning();
            if (!version) throw new Error('Expected version');
            const [option] = await tx
                .insert(billingOptions)
                .values({
                    planVersionId: version.id,
                    cycle: 'monthly',
                    amount: 1000,
                    currency: 'ARS'
                })
                .returning();
            if (!option) throw new Error('Expected option');
            const now = new Date('2026-10-23T12:00:00Z');
            const ids: Record<string, string> = {};
            for (const [key, options] of Object.entries({
                yes: {},
                noPayment: {},
                pendingPayment: {},
                refunded: {},
                expired: { window: new Date(now.getTime() - 1) },
                active: { status: 'ACTIVE' },
                complement: { class: 'COMPLEMENTO' },
                noLink: { link: false },
                duplicate: { duplicate: true },
                nullWindow: { nullWindow: true },
                manual: { paymentMethod: 'MANUAL' }
            } as Record<
                string,
                {
                    window?: Date;
                    status?: string;
                    class?: string;
                    link?: boolean;
                    duplicate?: boolean;
                    nullWindow?: boolean;
                    paymentMethod?: string;
                }
            >)) {
                const [user] = await tx
                    .insert(users)
                    .values({
                        email: `credited-${crypto.randomUUID()}@example.test`,
                        displayName: 'Credited',
                        emailVerified: true,
                        lifecycleState: 'ACTIVE'
                    })
                    .returning();
                if (!user) throw new Error('Expected user');
                const [row] = await tx
                    .insert(subscriptions)
                    .values({
                        userId: user.id,
                        vertical: 'accommodation',
                        planVersionId: version.id,
                        billingOptionId: option.id,
                        paymentMethod: options.paymentMethod ?? 'CARD',
                        status: options.status ?? 'PENDING_AUTHORIZATION',
                        class: options.class ?? 'PRINCIPAL',
                        authorizationWindowDeadlineVersion: 1,
                        authorizationWindowEndsAt: options.nullWindow
                            ? null
                            : (options.window ?? new Date(now.getTime() + 100_000))
                    })
                    .returning();
                if (!row) throw new Error('Expected subscription');
                ids[key] = row.id;
                if (options.link !== false)
                    await tx.insert(providerLinks).values({
                        subscriptionId: row.id,
                        provider: 'MERCADO_PAGO',
                        providerId: `auth-${crypto.randomUUID()}`
                    });
                const status =
                    key === 'noPayment'
                        ? null
                        : key === 'pendingPayment'
                          ? 'PENDING'
                          : key === 'refunded'
                            ? 'REFUNDED'
                            : 'SUCCEEDED';
                if (status) {
                    const insertPayment = () =>
                        tx.insert(payments).values({
                            subscriptionId: row.id,
                            amount: 1000,
                            currency: 'ARS',
                            status,
                            provider: 'fake',
                            providerFactId: crypto.randomUUID(),
                            factAt: now
                        });
                    await insertPayment();
                    if (options.duplicate) await insertPayment();
                }
            }
            const rows = await findCreditedPendingAuthorizations({ now, limit: 100, tx });
            expect(rows.map((row) => row.subscription.id).sort()).toEqual(
                [ids.yes, ids.duplicate, ids.nullWindow].sort()
            );
            expect(rows.every((row) => row.providerLink !== null)).toBe(true);
            expect(await findCreditedPendingAuthorizations({ now, limit: 0, tx })).toEqual([]);
        });
    });
});
