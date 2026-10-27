import { eq, reconciliationMarkModel, subscriptions } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import {
    ensureBillingDeadlineVersion1,
    seedPredecessor,
    seedSuccessionChoice,
    successionPorts,
    successionReturnUrl
} from './support/succession-fixtures';

afterAll(closeServiceTestPool);
beforeAll(ensureBillingDeadlineVersion1);

describe('TEST:B3:39 S1 succession branch refusals', () => {
    it('refuses every state outside the admitted predecessor set before provider calls', async () => {
        for (const status of [
            'PENDING_AUTHORIZATION',
            'ABANDONED',
            'GRACE_PERIOD',
            'PAUSED',
            'CANCELLED',
            'CHARGE_DECLINED'
        ]) {
            const choice = await seedSuccessionChoice();
            const seeded = await seedPredecessor({
                userId: choice.user.id,
                planVersionId: choice.planVersionId,
                billingOptionId: choice.predecessorBillingOptionId,
                status,
                honestAboutM1: true
            });
            const read = vi.spyOn(seeded.fake, 'readAuthorization');
            const authorize = vi.spyOn(seeded.fake, 'authorize');
            await expect(
                startSuccession(
                    {
                        userId: choice.user.id,
                        predecessorSubscriptionId: seeded.predecessor.id,
                        billingOptionId: choice.targetBillingOptionId,
                        returnUrl: successionReturnUrl
                    },
                    successionPorts(seeded.provider)
                )
            ).rejects.toMatchObject({ reason: 'PREDECESSOR_STATUS_NOT_ADMITTED' });
            expect(read).not.toHaveBeenCalled();
            expect(authorize).not.toHaveBeenCalled();
            const rows = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, choice.user.id));
            expect(rows).toHaveLength(1);
        }
    });

    it('rejects MANUAL payer succession for ACTIVE and SUSPENDED before provider calls', async () => {
        for (const status of ['ACTIVE', 'SUSPENDED']) {
            const choice = await seedSuccessionChoice();
            const seeded = await seedPredecessor({
                userId: choice.user.id,
                planVersionId: choice.planVersionId,
                billingOptionId: choice.predecessorBillingOptionId,
                status,
                paymentMethod: 'MANUAL',
                honestAboutM1: true
            });
            const read = vi.spyOn(seeded.fake, 'readAuthorization');
            const authorize = vi.spyOn(seeded.fake, 'authorize');
            await expect(
                startSuccession(
                    {
                        userId: choice.user.id,
                        predecessorSubscriptionId: seeded.predecessor.id,
                        billingOptionId: choice.targetBillingOptionId,
                        returnUrl: successionReturnUrl
                    },
                    successionPorts(seeded.provider)
                )
            ).rejects.toMatchObject({ reason: 'MANUAL_PAYER_SUCCESSION_NOT_AVAILABLE' });
            expect(read).not.toHaveBeenCalled();
            expect(authorize).not.toHaveBeenCalled();
        }
    });

    it('rejects a SUSPENDED card predecessor while its preapproval remains live', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'SUSPENDED',
            providerState: 'active',
            honestAboutM1: true
        });
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        await expect(
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: choice.targetBillingOptionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'SUSPENDED_PREAPPROVAL_STILL_LIVE' });
        expect(authorize).not.toHaveBeenCalled();
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toHaveLength(1);
    });

    it('rejects a predecessor that is already a successor', async () => {
        const choice = await seedSuccessionChoice();
        const rootChoice = await seedSuccessionChoice();
        const root = await seedPredecessor({
            userId: rootChoice.user.id,
            planVersionId: rootChoice.planVersionId,
            billingOptionId: rootChoice.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ succeedsId: root.predecessor.id })
            .where(eq(subscriptions.id, seeded.predecessor.id));
        await expect(
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: choice.targetBillingOptionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'PREDECESSOR_IS_A_SUCCESSOR' });
    });

    it('refuses a marked ACTIVE row through checkSuccessionTarget', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.predecessor.id },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: { type: 'admin', id: choice.user.id },
            correlationId: crypto.randomUUID()
        });
        await expect(
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: choice.targetBillingOptionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'PREDECESSOR_MARKED_NOT_SUCCEEDABLE' });
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toHaveLength(1);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.predecessor.id }
            })
        ).toHaveLength(1);
    });

    it('AC:B3:2 rejects a destination plan that is no longer for sale', async () => {
        const choice = await seedSuccessionChoice({ targetSellable: false });
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        await expect(
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: choice.targetBillingOptionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'PLAN_NOT_FOR_SALE' });
        expect(authorize).not.toHaveBeenCalled();
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toHaveLength(1);
    });

    it('rejects a destination from a different vertical', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        const planId = (
            await getServiceTestPool().query<{ id: string }>(
                'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
                ['venue', `succession-gastro-${crypto.randomUUID()}`, 'Gastronomy plan']
            )
        ).rows[0]?.id;
        const versionId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'venue', $2, true, true, 0, false) RETURNING id",
                [planId, Math.floor(Math.random() * 100000000) + 1]
            )
        ).rows[0]?.id;
        const optionId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
                [versionId]
            )
        ).rows[0]?.id;
        if (!optionId) throw new Error('Could not seed alternate vertical option');
        await expect(
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: optionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'SUCCESSION_VERTICAL_MISMATCH' });
    });

    it('returns not found for another user’s predecessor', async () => {
        const choice = await seedSuccessionChoice();
        const owner = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: owner.user.id,
            planVersionId: owner.planVersionId,
            billingOptionId: owner.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        await expect(
            startSuccession(
                {
                    userId: choice.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: choice.targetBillingOptionId,
                    returnUrl: successionReturnUrl
                },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'PREDECESSOR_NOT_FOUND' });
    });

    it('allows one live successor and maps a repeated insert to SUCCESSION_IN_PROGRESS', async () => {
        const choice = await seedSuccessionChoice();
        const seeded = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        const input = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        const first = await startSuccession(input, successionPorts(seeded.provider));
        await expect(
            startSuccession(input, successionPorts(seeded.provider))
        ).rejects.toMatchObject({
            reason: 'SUCCESSION_IN_PROGRESS'
        });
        const successors = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        expect(successors).toHaveLength(1);
        expect(successors[0]?.id).toBe(first.subscriptionId);
    });
});
