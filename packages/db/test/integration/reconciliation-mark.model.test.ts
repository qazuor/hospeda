import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationMarkModel as model } from '../../src/models/reconciliation-mark/reconciliation-mark.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { addons, addonVersions } from '../../src/schemas/vertical/addon-catalog.dbschema.ts';
import {
    addonInstances,
    addonProducts
} from '../../src/schemas/vertical/addon-product.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

function postgresCause(error: unknown): { code?: string; constraint?: string } | null {
    const seen = new Set<unknown>();
    let current = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const candidate = current as { code?: string; constraint?: string; cause?: unknown };
        if (candidate.code) return candidate;
        current = candidate.cause;
    }
    return null;
}

async function fixture(tx: DrizzleClient) {
    const id = crypto.randomUUID();
    const [user] = await tx
        .insert(users)
        .values({ id, slug: `b34-model-${id}`, email: `b34-model-${id}@example.test` })
        .returning();
    const [subscription] = await tx
        .insert(subscriptions)
        .values({ status: 'CANCELLED', class: 'LAPIDA' })
        .returning();
    const [addon] = await tx
        .insert(addons)
        .values({ slug: `b34-model-${crypto.randomUUID()}`, name: 'B3.4 addon' })
        .returning();
    const [version] = await tx
        .insert(addonVersions)
        .values({
            addonId: addon?.id as string,
            validity: 'FIXED_DAYS',
            validityDays: 30,
            scopeType: 'USER'
        })
        .returning();
    const [product] = await tx
        .insert(addonProducts)
        .values({
            addonId: addon?.id as string,
            versionId: version?.id as string,
            price: 100,
            currency: 'ARS',
            chargeKind: 'UNA_VEZ',
            compatibleVerticals: ['accommodation']
        })
        .returning();
    const [instance] = await tx
        .insert(addonInstances)
        .values({
            productId: product?.id as string,
            addonVersionId: version?.id as string,
            ownerId: user?.id as string,
            status: 'ACTIVE'
        })
        .returning();
    return {
        userId: user?.id as string,
        subscription: subscription!,
        instanceId: instance?.id as string
    };
}

describe('support for TEST:B3:14 and TEST:B3:15 — reconciliation mark model', () => {
    it('inserts and finds open marks by subject and reason without changing subscription', async () => {
        await withTestTransaction(async (tx) => {
            const subject = await fixture(tx);
            const subscriptionSubject = {
                kind: 'SUBSCRIPTION' as const,
                subscriptionId: subject.subscription.id
            };
            const instanceSubject = {
                kind: 'ADDON_INSTANCE' as const,
                addonInstanceId: subject.instanceId
            };
            const first = await model.insertOpen({
                subject: subscriptionSubject,
                reason: 'REEMBOLSO_POR_CONFIRMAR',
                placedAt: new Date('2026-10-10T10:00:00.000Z'),
                tx
            });
            const second = await model.insertOpen({
                subject: subscriptionSubject,
                reason: 'COBRO_POSTERIOR_A_LA_BAJA',
                placedAt: new Date('2026-10-10T11:00:00.000Z'),
                tx
            });
            const order = await model.insertOpen({
                subject: instanceSubject,
                reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
                tx
            });
            expect((await model.findById({ markId: first.id, tx }))?.id).toBe(first.id);
            expect(
                (
                    await model.findOpen({
                        subject: subscriptionSubject,
                        reason: 'REEMBOLSO_POR_CONFIRMAR',
                        tx
                    })
                )?.id
            ).toBe(first.id);
            expect(
                (
                    await model.findOpen({
                        subject: instanceSubject,
                        reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
                        tx
                    })
                )?.id
            ).toBe(order.id);
            expect(
                await model.findOpen({
                    subject: subscriptionSubject,
                    reason: 'DIVERGENCIA_DE_MONTO',
                    tx
                })
            ).toBeNull();
            expect(
                (await model.listOpen({ subject: subscriptionSubject, tx })).map((mark) => mark.id)
            ).toEqual([first.id, second.id]);
            expect(
                (await model.listOpen({ subject: instanceSubject, tx })).map((mark) => mark.id)
            ).toEqual([order.id]);
            const [after] = await tx.select().from(subscriptions);
            expect(after).toEqual(subject.subscription);
        });
    });

    it('passes an open duplicate unique violation through its Drizzle cause chain', async () => {
        await withTestTransaction(async (tx) => {
            const subject = await fixture(tx);
            const markSubject = {
                kind: 'SUBSCRIPTION' as const,
                subscriptionId: subject.subscription.id
            };
            await model.insertOpen({ subject: markSubject, reason: 'REEMBOLSO_POR_CONFIRMAR', tx });
            let failure: unknown;
            try {
                await tx.transaction(async (savepoint) => {
                    await model.insertOpen({
                        subject: markSubject,
                        reason: 'REEMBOLSO_POR_CONFIRMAR',
                        tx: savepoint as DrizzleClient
                    });
                });
            } catch (error) {
                failure = error;
            }
            expect(postgresCause(failure)).toMatchObject({
                code: '23505',
                constraint: 'uq_reconciliation_mark_open_subscription_reason'
            });
        });
    });

    it('bumps only an open mark, lifts only the requested mark and rejects stale versions', async () => {
        await withTestTransaction(async (tx) => {
            const subject = await fixture(tx);
            const markSubject = {
                kind: 'SUBSCRIPTION' as const,
                subscriptionId: subject.subscription.id
            };
            const first = await model.insertOpen({
                subject: markSubject,
                reason: 'REEMBOLSO_POR_CONFIRMAR',
                tx
            });
            const other = await model.insertOpen({
                subject: markSubject,
                reason: 'COBRO_POSTERIOR_A_LA_BAJA',
                tx
            });
            expect(await model.bumpOpenVersion({ markId: first.id, tx })).toBe(true);
            expect((await model.findById({ markId: first.id, tx }))?.version).toBe(2);
            const now = new Date('2026-10-10T12:00:00.000Z');
            expect(
                await model.lift({
                    markId: first.id,
                    expectedVersion: 1,
                    liftedBy: subject.userId,
                    now,
                    tx
                })
            ).toEqual({ outcome: 'VERSION_CONFLICT' });
            expect((await model.findById({ markId: first.id, tx }))?.liftedAt).toBeNull();
            const lifted = await model.lift({
                markId: first.id,
                expectedVersion: 2,
                liftedBy: subject.userId,
                now,
                tx
            });
            expect(lifted.outcome).toBe('LIFTED');
            if (lifted.outcome === 'LIFTED')
                expect(lifted.mark).toMatchObject({
                    liftedAt: now,
                    liftedBy: subject.userId,
                    version: 3
                });
            expect(await model.bumpOpenVersion({ markId: first.id, tx })).toBe(false);
            expect(
                await model.lift({
                    markId: first.id,
                    expectedVersion: 3,
                    liftedBy: subject.userId,
                    now,
                    tx
                })
            ).toEqual({ outcome: 'NOT_OPEN' });
            expect(
                await model.findOpen({
                    subject: markSubject,
                    reason: 'REEMBOLSO_POR_CONFIRMAR',
                    tx
                })
            ).toBeNull();
            expect(
                (await model.listOpen({ subject: markSubject, tx })).map((mark) => mark.id)
            ).toEqual([other.id]);
            const [after] = await tx.select().from(subscriptions);
            expect(after).toEqual(subject.subscription);
        });
    });
});
