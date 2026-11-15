/**
 * TEST:B5:13 and TEST:B5:14 (migration from scratch: the service-core integration base is
 * migrated from empty by its global setup), AC:B5:26. A5's third clause on seeded rows
 * (HOS-1630), each within a rolled-back transaction and asserted by its own ids.
 */
import {
    type DrizzleClient,
    domainEventModel,
    eq,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { applyA5 } from '../../../src/services/billing/addon/addon-instance-a5.js';
import { isAddonInstanceOrphaned } from '../../../src/services/billing/addon/addon-orphanhood.js';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers.js';
import {
    orphanNow,
    orphanPorts,
    readDecisions,
    readInstance,
    readSubscription,
    seedComplement,
    seedComplementCharge,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './support/addon-orphan-fixtures.js';
import { seedCoveragePayment } from './support/coverage-fixtures.js';

afterAll(closeServiceTestPool);
const scopes = ['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL'] as const;
type Scope = (typeof scopes)[number];

async function seedCase(
    tx: DrizzleClient,
    scopeType: Scope,
    origin: 'ACTIVE' | 'PENDING_AUTHORIZATION' = 'ACTIVE'
) {
    const { userId } = await seedOrphanOwner(tx);
    const fixture = orphanPorts(tx);
    let targetId: string | null = null;
    if (scopeType === 'LISTING') {
        targetId = crypto.randomUUID();
        fixture.setListing(targetId, {
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId: userId,
            acceptsFeature: true
        });
        await seedPrincipal(tx, {
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            status: 'ACTIVE'
        });
    } else if (scopeType === 'VERTICAL_SUBSCRIPTION') {
        const principal = await seedPrincipal(tx, {
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            status: 'ACTIVE'
        });
        targetId = principal.subscriptionId;
    } else {
        const principal = await seedPrincipal(tx, {
            userId,
            vertical: VerticalEnum.VENUE,
            status: 'ACTIVE'
        });
        await seedCoveragePayment(tx, {
            subscriptionId: principal.subscriptionId,
            status: 'SUCCEEDED'
        });
    }
    const complement = await seedComplement(tx, {
        userId,
        vertical: VerticalEnum.ACCOMMODATION,
        status: 'ACTIVE'
    });
    const compatibleVerticals =
        scopeType === 'USER' || scopeType === 'GLOBAL'
            ? [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE]
            : [VerticalEnum.ACCOMMODATION];
    const addon = await seedOrphanInstance(tx, {
        ownerId: userId,
        scopeType,
        compatibleVerticals,
        targetId,
        status: origin,
        complementSubscriptionId: complement.subscriptionId,
        cycle: 'monthly'
    });
    const { paymentId } = await seedComplementCharge(tx, {
        subscriptionId: complement.subscriptionId,
        factAt: new Date(orphanNow.getTime() - 11 * 24 * 60 * 60 * 1000)
    });
    return {
        userId,
        targetId,
        compatibleVerticals,
        instanceId: addon.instanceId,
        complementId: complement.subscriptionId,
        authorizationId: complement.authorizationId,
        paymentId,
        fixture
    };
}

async function readTrail(tx: DrizzleClient, complementId: string, paymentId: string) {
    const marks = await tx
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, complementId));
    const hangs = await tx
        .select()
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.paymentId, paymentId));
    const refundRows = await tx.select().from(refunds).where(eq(refunds.paymentId, paymentId));
    return { marks, hangs, refunds: refundRows };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B5:13 TEST:B5:14 AC:B5:26 — A5 cancels by its third clause whatever the orphanhood says',
    () => {
        it.each([
            ['ORPHANED', 'ACTIVE'],
            ['ORPHANED', 'PENDING_AUTHORIZATION'],
            ['WITHDRAWN', 'ACTIVE'],
            ['WITHDRAWN', 'PENDING_AUTHORIZATION'],
            ['GRANT_REVOKED', 'ACTIVE'],
            ['GRANT_REVOKED', 'PENDING_AUTHORIZATION']
        ] as const)('%s from %s writes one status event in its transaction', async (clause, origin) => {
            await withServiceTestTransaction(async (tx) => {
                const s = await seedCase(tx, 'USER', origin);
                const insert = domainEventModel.insert.bind(domainEventModel);
                const spy = vi
                    .spyOn(domainEventModel, 'insert')
                    .mockImplementation(async (input) => {
                        if (input.entityId === s.instanceId) expect(input.tx).toBe(tx);
                        return insert(input);
                    });
                try {
                    const input = { tx, instanceId: s.instanceId, clause, now: orphanNow };
                    expect((await applyA5(input, s.fixture.ports)).outcome).toBe('CANCELLED');
                    const events = (
                        await domainEventModel.findByEntity({
                            entityType: 'addon_instance',
                            entityId: s.instanceId,
                            tx
                        })
                    ).filter((event) => event.eventType === 'addon_instance.status_changed');
                    expect(events).toHaveLength(1);
                    expect(events[0]).toMatchObject({
                        actorType: 'job',
                        changes: [{ field: 'status', old: origin, new: 'CANCELLED' }]
                    });
                    expect(await applyA5(input, s.fixture.ports)).toEqual({
                        outcome: 'NOT_APPLICABLE'
                    });
                    expect(
                        (
                            await domainEventModel.findByEntity({
                                entityType: 'addon_instance',
                                entityId: s.instanceId,
                                tx
                            })
                        ).filter((event) => event.eventType === 'addon_instance.status_changed')
                    ).toHaveLength(1);
                    expect(
                        spy.mock.calls.filter(([event]) => event.entityId === s.instanceId)
                    ).toHaveLength(1);
                } finally {
                    spy.mockRestore();
                }
            });
        });

        it.each(scopes)('%s ACTIVE: A5 and S21 write reason 15 in one act', async (scopeType) => {
            await withServiceTestTransaction(async (tx) => {
                const s = await seedCase(tx, scopeType);
                expect(
                    await isAddonInstanceOrphaned(
                        {
                            tx,
                            instance: {
                                id: s.instanceId,
                                ownerId: s.userId,
                                targetId: s.targetId,
                                compatibleVerticals: s.compatibleVerticals
                            },
                            scopeType
                        },
                        s.fixture.ports
                    )
                ).toBe(false);
                const result = await applyA5(
                    {
                        tx,
                        instanceId: s.instanceId,
                        clause: 'GRANT_REVOKED',
                        now: orphanNow,
                        s21Cause: 'GRANT_REVOKED'
                    },
                    s.fixture.ports
                );
                expect(result.outcome).toBe('CANCELLED');
                if (result.outcome !== 'CANCELLED') throw new Error('A5 did not cancel');
                expect(result.addon.clause).toBe('GRANT_REVOKED');
                expect(result.addon.coverageVerticals).toEqual(
                    scopeType === 'USER' || scopeType === 'GLOBAL'
                        ? [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE]
                        : [VerticalEnum.ACCOMMODATION]
                );
                expect(result.addon.providerCancellation).toMatchObject({
                    subscriptionId: s.complementId,
                    authorizationId: s.authorizationId
                });
                expect((await readInstance(tx, s.instanceId)).status).toBe('CANCELLED');
                expect((await readSubscription(tx, s.complementId)).status).toBe('CANCELLED');
                const trail = await readTrail(tx, s.complementId, s.paymentId);
                expect(trail.marks.map(({ reason }) => reason)).toEqual([
                    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION'
                ]);
                expect(trail.hangs.map(({ paymentId }) => paymentId)).toEqual([s.paymentId]);
                expect(trail.refunds).toEqual([]);
                expect(
                    (await readDecisions(tx, s.complementId)).map(({ reason }) => reason)
                ).toEqual(['A5']);
            });
        });

        it.each(
            scopes
        )('%s PENDING_AUTHORIZATION: no ADDON source was emitted', async (scopeType) => {
            await withServiceTestTransaction(async (tx) => {
                const s = await seedCase(tx, scopeType, 'PENDING_AUTHORIZATION');
                const result = await applyA5(
                    {
                        tx,
                        instanceId: s.instanceId,
                        clause: 'GRANT_REVOKED',
                        now: orphanNow,
                        s21Cause: 'GRANT_REVOKED'
                    },
                    s.fixture.ports
                );
                expect(result.outcome).toBe('CANCELLED');
                if (result.outcome !== 'CANCELLED') throw new Error('A5 did not cancel');
                expect(result.addon.coverageVerticals).toEqual([]);
                expect((await readInstance(tx, s.instanceId)).status).toBe('CANCELLED');
            });
        });

        it('USER ORPHANED: the same paid row opens reason 14', async () => {
            await withServiceTestTransaction(async (tx) => {
                const s = await seedCase(tx, 'USER');
                const result = await applyA5(
                    { tx, instanceId: s.instanceId, clause: 'ORPHANED', now: orphanNow },
                    s.fixture.ports
                );
                expect(result.outcome).toBe('CANCELLED');
                const trail = await readTrail(tx, s.complementId, s.paymentId);
                expect(trail.marks.map(({ reason }) => reason)).toEqual([
                    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
                ]);
            });
        });

        it('USER GRANT_REVOKED: rerunning A5 writes no second mark or decision', async () => {
            await withServiceTestTransaction(async (tx) => {
                const s = await seedCase(tx, 'USER');
                const input = {
                    tx,
                    instanceId: s.instanceId,
                    clause: 'GRANT_REVOKED' as const,
                    now: orphanNow,
                    s21Cause: 'GRANT_REVOKED' as const
                };
                expect((await applyA5(input, s.fixture.ports)).outcome).toBe('CANCELLED');
                expect(await applyA5(input, s.fixture.ports)).toEqual({
                    outcome: 'NOT_APPLICABLE'
                });
                const trail = await readTrail(tx, s.complementId, s.paymentId);
                expect(trail.marks).toHaveLength(1);
                expect(
                    (await readDecisions(tx, s.complementId)).map(({ reason }) => reason)
                ).toEqual(['A5']);
            });
        });
    }
);
