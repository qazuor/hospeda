import { reconciliationMarkModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { liftReconciliationMarkByAdmin } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark-by-admin.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool } from './helpers.js';
import { seedLiftAdmin } from './support/admin-lift-fixtures.js';
import {
    markPaymentClock as clock,
    markPaymentFixture,
    retireMarkPaymentFixtures
} from './support/mark-payment-fixtures.js';
import { retirePaidOrderFixtures, seedOrderInstance } from './support/paid-order-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(async () => {
    await retireMarkPaymentFixtures();
    await retirePaidOrderFixtures();
});

async function mark(
    subscriptionId: string,
    userId: string,
    reason: 'DIVERGENCIA_DE_MONTO' | 'TRANSICION_NO_DECLARADA' = 'DIVERGENCIA_DE_MONTO'
) {
    return openReconciliationMark({
        subject: { kind: 'SUBSCRIPTION', subscriptionId },
        reason,
        actor: { type: 'admin', id: userId },
        correlationId: crypto.randomUUID()
    });
}

function actor(id: string, permissions: readonly PermissionEnum[]): Actor {
    return { id, roles: [RoleEnum.ADMIN], permissions };
}

async function lift(markId: string, expectedVersion: number, who?: Actor) {
    return liftReconciliationMarkByAdmin(
        {
            actor: who ?? (await seedLiftAdmin()),
            markId,
            expectedVersion,
            resolveWithoutRefund: []
        },
        { clock }
    );
}

describe('TEST:1697:5 AC:1697:2 admin action 7 authorization and S15', () => {
    it('(a) lifts one of two open reasons and returns the complete result', async () => {
        const f = await markPaymentFixture();
        const one = await mark(f.subscriptionId, f.userId);
        const two = await mark(f.subscriptionId, f.userId, 'TRANSICION_NO_DECLARADA');
        const admin = await seedLiftAdmin();
        const result = await lift(one.mark.id, one.mark.version, admin);
        expect(result).toEqual({
            markId: one.mark.id,
            reason: 'DIVERGENCIA_DE_MONTO',
            subjectId: f.userId,
            liftedAt: clock.now(),
            liftedBy: admin.id,
            version: one.mark.version + 1,
            resolvedWithoutRefund: []
        });
        expect(
            (await reconciliationMarkModel.findById({ markId: two.mark.id }))?.liftedAt
        ).toBeNull();
        expect((await reconciliationMarkModel.findById({ markId: two.mark.id }))?.version).toBe(
            two.mark.version
        );
    });

    it('(b) rejects an old version and lifts after rereading', async () => {
        const f = await markPaymentFixture();
        const opened = await mark(f.subscriptionId, f.userId);
        const admin = await seedLiftAdmin();
        await expect(lift(opened.mark.id, opened.mark.version - 1, admin)).rejects.toMatchObject({
            reason: 'MARK_VERSION_CONFLICT'
        });
        expect(
            (await reconciliationMarkModel.findById({ markId: opened.mark.id }))?.liftedAt
        ).toBeNull();
        expect((await reconciliationMarkModel.findById({ markId: opened.mark.id }))?.version).toBe(
            opened.mark.version
        );
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        await expect(lift(opened.mark.id, reread!.version, admin)).resolves.toMatchObject({
            version: opened.mark.version + 1
        });
    });

    it('(c) rejects an already lifted mark without changing its version', async () => {
        const f = await markPaymentFixture();
        const opened = await mark(f.subscriptionId, f.userId);
        await reconciliationMarkModel.lift({
            markId: opened.mark.id,
            expectedVersion: opened.mark.version,
            liftedBy: f.userId,
            now: clock.now()
        });
        await expect(
            lift(opened.mark.id, opened.mark.version, await seedLiftAdmin())
        ).rejects.toMatchObject({ reason: 'MARK_ALREADY_LIFTED' });
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        expect(reread?.liftedAt).toEqual(clock.now());
        expect(reread?.version).toBe(opened.mark.version + 1);
    });

    it('(d) returns not found before permission checks', async () => {
        await expect(lift(crypto.randomUUID(), 1)).rejects.toMatchObject({
            reason: 'MARK_NOT_FOUND'
        });
    });

    it('(e) forbids the subscription owner even with the action permission', async () => {
        const f = await markPaymentFixture();
        const opened = await mark(f.subscriptionId, f.userId);
        await expect(
            lift(
                opened.mark.id,
                opened.mark.version,
                actor(f.userId, [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK])
            )
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(opened.mark.version);
    });

    it('(f) does not accept neighboring billing permissions', async () => {
        const f = await markPaymentFixture();
        const opened = await mark(f.subscriptionId, f.userId);
        const permissions = [
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
            PermissionEnum.BILLING_SETTLE_EXTERNAL,
            PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
        ];
        await expect(
            lift(opened.mark.id, opened.mark.version, actor(crypto.randomUUID(), permissions))
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(opened.mark.version);
    });

    it('(g) forbids a marked system actor that carries the action permission', async () => {
        const f = await markPaymentFixture();
        const opened = await mark(f.subscriptionId, f.userId);
        const admin = await seedLiftAdmin();
        const system = actor(admin.id, [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK]);
        await expect(
            lift(opened.mark.id, opened.mark.version, {
                ...system,
                roles: [RoleEnum.SYSTEM],
                _isSystemActor: true
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(opened.mark.version);
    });

    it('(h) uses the add-on owner as subject for reason 23', async () => {
        const instance = await seedOrderInstance({ status: 'ACTIVE', key: null });
        const opened = await openReconciliationMark({
            subject: { kind: 'ADDON_INSTANCE', addonInstanceId: instance.instanceId },
            reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
            actor: { type: 'admin', id: instance.ownerId },
            correlationId: crypto.randomUUID()
        });
        const owner = actor(instance.ownerId, [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK]);
        await expect(lift(opened.mark.id, opened.mark.version, owner)).rejects.toMatchObject({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(opened.mark.version);
        const admin = await seedLiftAdmin();
        await expect(lift(opened.mark.id, opened.mark.version, admin)).resolves.toMatchObject({
            subjectId: instance.ownerId,
            liftedBy: admin.id
        });
    });
});
