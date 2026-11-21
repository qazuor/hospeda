import { and, desc, eq, idempotencyKeys, providerLinks, subscriptions } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    ensureBillingDeadlineVersion1,
    seedPredecessor,
    seedSuccessionChoice,
    successionPorts,
    successionReturnUrl
} from './support/succession-fixtures';

afterAll(closeServiceTestPool);
beforeAll(ensureBillingDeadlineVersion1);

/**
 * HOS-2218 / HOS-2238: a plan change must send MercadoPago a payer email
 * (MP answers 400 "payer_email is required" otherwise), the successor must
 * store what was declared, and a provider rejection must not leave a pending
 * successor that blocks the next attempt.
 */
async function seedActivePredecessor(declaredPayerEmail: string | null) {
    const choice = await seedSuccessionChoice();
    const seeded = await seedPredecessor({
        userId: choice.user.id,
        planVersionId: choice.planVersionId,
        billingOptionId: choice.predecessorBillingOptionId,
        status: 'ACTIVE',
        providerState: 'active',
        honestAboutM1: true
    });
    await getServiceTestDb()
        .update(subscriptions)
        .set({ declaredPayerEmail })
        .where(eq(subscriptions.id, seeded.predecessor.id));
    return { choice, seeded };
}

function rejectAuthorizeOnce(seeded: Awaited<ReturnType<typeof seedPredecessor>>) {
    return vi.spyOn(seeded.fake, 'authorize').mockRejectedValueOnce(
        new PaymentProviderError({
            code: 'REJECTED',
            capability: 'authorize',
            message: 'payer_email is required'
        })
    );
}

async function readSuccessors(predecessorId: string) {
    return getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.succeedsId, predecessorId));
}

describe('HOS-2218 succession payer email', () => {
    it('sends and stores the payer email declared on the request', async () => {
        const { choice, seeded } = await seedActivePredecessor('old-payer@example.test');
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        const result = await startSuccession(
            {
                userId: choice.user.id,
                predecessorSubscriptionId: seeded.predecessor.id,
                billingOptionId: choice.targetBillingOptionId,
                returnUrl: successionReturnUrl,
                payerEmail: 'new-payer@example.test'
            },
            successionPorts(seeded.provider)
        );
        expect(authorize.mock.calls.at(-1)?.[0].payerEmail).toBe('new-payer@example.test');
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.declaredPayerEmail).toBe('new-payer@example.test');
    });

    it("falls back to the predecessor's declared payer email when the request has none", async () => {
        const { choice, seeded } = await seedActivePredecessor('declared@example.test');
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        const result = await startSuccession(
            {
                userId: choice.user.id,
                predecessorSubscriptionId: seeded.predecessor.id,
                billingOptionId: choice.targetBillingOptionId,
                returnUrl: successionReturnUrl
            },
            successionPorts(seeded.provider)
        );
        expect(authorize.mock.calls.at(-1)?.[0].payerEmail).toBe('declared@example.test');
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.declaredPayerEmail).toBe('declared@example.test');
    });

    it('refuses with PAYER_EMAIL_UNDECLARED before writing when no email is known', async () => {
        const { choice, seeded } = await seedActivePredecessor(null);
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
        ).rejects.toMatchObject({ reason: 'PAYER_EMAIL_UNDECLARED' });
        expect(authorize).not.toHaveBeenCalled();
        expect(await readSuccessors(seeded.predecessor.id)).toHaveLength(0);
        const [predecessor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(predecessor?.succeededById).toBeNull();
    });

    it('retries on the same successor with a new key after a provider rejection', async () => {
        const { choice, seeded } = await seedActivePredecessor('declared@example.test');
        rejectAuthorizeOnce(seeded);
        const input = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl,
            payerEmail: 'first@example.test'
        };
        await expect(
            startSuccession(input, successionPorts(seeded.provider))
        ).rejects.toMatchObject({ code: 'REJECTED', capability: 'authorize' });
        const [rejected] = await readSuccessors(seeded.predecessor.id);
        expect(rejected?.status).toBe('PENDING_AUTHORIZATION');

        const authorize = vi.spyOn(seeded.fake, 'authorize');
        const result = await startSuccession(
            { ...input, payerEmail: 'second@example.test' },
            successionPorts(seeded.provider)
        );

        expect(result.subscriptionId).toBe(rejected?.id);
        expect(await readSuccessors(seeded.predecessor.id)).toHaveLength(1);
        const sent = authorize.mock.calls.at(-1)?.[0];
        expect(sent?.reference).toBe(rejected?.id);
        expect(sent?.payerEmail).toBe('second@example.test');
        expect(sent?.firstChargeAt).toBe(rejected?.firstChargeAt?.toISOString());
        const keys = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(
                and(
                    eq(idempotencyKeys.subjectId, result.subscriptionId),
                    eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
                )
            )
            .orderBy(desc(idempotencyKeys.createdAt));
        expect(keys).toHaveLength(2);
        expect(keys[0]?.completedAt).not.toBeNull();
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, result.subscriptionId));
        expect(link?.providerId).toBe(result.authorizationId);
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.declaredPayerEmail).toBe('second@example.test');
        const [predecessor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(predecessor?.status).toBe('ACTIVE');
        // HOS-2351: S1 leaves the pointer to S18.
        expect(predecessor?.succeededById).toBeNull();
    });

    it('keeps SUCCESSION_IN_PROGRESS when the rejected successor was for another option', async () => {
        const { choice, seeded } = await seedActivePredecessor('declared@example.test');
        rejectAuthorizeOnce(seeded);
        const input = {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl
        };
        await expect(
            startSuccession(input, successionPorts(seeded.provider))
        ).rejects.toMatchObject({ code: 'REJECTED' });
        await expect(
            startSuccession(
                { ...input, billingOptionId: choice.predecessorBillingOptionId },
                successionPorts(seeded.provider)
            )
        ).rejects.toMatchObject({ reason: 'SUCCESSION_IN_PROGRESS' });
    });
});
