/**
 * HOS-1725: when the original checkout dies after the provider created the
 * authorization, the creations sweep recovers the row by linking it. The
 * `PREAPPROVAL_CREATE` key that S1's reuse reads must be completed with the
 * applied result in that same recovery, or the person's retry answers 409
 * `COMMITMENT_TAKEN` until the authorization window closes (~72h).
 */
import {
    eq,
    idempotencyKeys,
    providerLinks,
    reconciliationInventoryModel,
    subscriptionModel
} from '@repo/db';
import { sanitizeApprovalUrl } from '@repo/payments';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdjustableClock } from '../../../../test-clock/src/adjustable-clock.js';
import {
    CREATION_GRACE_MS,
    runCreationsSweep
} from '../../../src/services/billing/reconciliation/creations/creations-sweep.service.js';
import { resolveLiveCommitmentReuse } from '../../../src/services/billing/subscription/resolve-live-commitment.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    resetSeededReconciliationInventory,
    seedPendingCreation,
    withSeededPendingCreations
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);

type Clock = ReturnType<typeof createAdjustableClock>;
type Row = Awaited<ReturnType<typeof seedPendingCreation>>;

/** The provider creation the dead checkout left behind, named after the row. */
function authorizeFor(fake: FakePaymentProvider, row: Row) {
    return fake.authorize({
        reference: row.subscription.id,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'test',
        returnUrl: 'https://example.test',
        payerEmail: row.userEmail!
    });
}

function sweep(fake: FakePaymentProvider, time: Clock) {
    return withSeededPendingCreations(() =>
        runCreationsSweep({}, { provider: fake, clock: time, returnUrl: 'https://example.test' })
    );
}

/** What S1 answers to the retry: the stored reuse, or the 409 it throws. */
async function retry(row: Row, time: Clock) {
    const commitment = await subscriptionModel.findLiveCommitment({
        userId: row.subscription.userId!,
        vertical: 'accommodation'
    });
    if (!commitment) throw new Error('The live commitment disappeared');
    return resolveLiveCommitmentReuse({
        commitment,
        billingOptionId: row.subscription.billingOptionId!,
        clock: time
    });
}

async function createKeys(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.subjectId, subscriptionId));
}

/** Makes every by-id read report no approval link, as an absent `init_point` would. */
function readsWithoutApprovalLink(fake: FakePaymentProvider) {
    const read = fake.readAuthorization.bind(fake);
    vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
        const result = await read(input);
        return { ...result, snapshot: { ...result.snapshot, approvalUrl: null } };
    });
}

describe('HOS-1725 the creations sweep completes the creation key it recovers', () => {
    it('lets the retry reuse the stored checkout after the sweep links the creation', async () => {
        // Arrange
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const created = await authorizeFor(fake, row);

        // Act
        const summary = await sweep(fake, time);
        const reused = await retry(row, time);

        // Assert
        expect(summary.linked).toBe(1);
        expect(reused).toEqual({
            subscriptionId: row.subscription.id,
            authorizationId: created.authorizationId,
            checkoutUrl: sanitizeApprovalUrl(created).url
        });
        const [key] = (await createKeys(row.subscription.id)).filter((k) => k.key === row.key);
        expect(key?.completedAt).toEqual(time.now());
    });

    it('heals a row already linked whose creation key was never completed', async () => {
        // Arrange
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const created = await authorizeFor(fake, row);
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: row.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId
        });
        await expect(retry(row, time)).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });

        // Act
        const summary = await sweep(fake, time);
        const reused = await retry(row, time);

        // Assert
        expect(summary.rowsFailed).toBe(0);
        expect(summary.keysCompleted).toBe(1);
        expect(reused.checkoutUrl).toBe(sanitizeApprovalUrl(created).url);
        expect(reused.authorizationId).toBe(created.authorizationId);
    });

    it('does not heal when the linked authorization is no longer pending', async () => {
        // Arrange
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const created = await authorizeFor(fake, row);
        await fake.approve({ authorizationId: created.authorizationId });
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: row.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId
        });

        // Act
        const summary = await sweep(fake, time);

        // Assert
        expect(summary.keysCompleted).toBe(0);
        const keys = await createKeys(row.subscription.id);
        expect(keys.every((key) => key.completedAt === null)).toBe(true);
    });

    it('does not heal when, under the lock, the row is linked to another creation', async () => {
        // Arrange
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const created = await authorizeFor(fake, row);
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: row.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId
        });
        const lock = reconciliationInventoryModel.lockSubscriptionForLink.bind(
            reconciliationInventoryModel
        );
        const relinked = vi
            .spyOn(reconciliationInventoryModel, 'lockSubscriptionForLink')
            .mockImplementation(async (input) => {
                const locked = await lock(input);
                return locked?.providerLink
                    ? { ...locked, providerLink: { ...locked.providerLink, providerId: 'other' } }
                    : locked;
            });

        // Act
        let lockCalls = 0;
        const summary = await sweep(fake, time).finally(() => {
            lockCalls = relinked.mock.calls.length;
            relinked.mockRestore();
        });

        // Assert
        expect(lockCalls).toBeGreaterThan(0);
        expect(summary.keysCompleted).toBe(0);
        const keys = await createKeys(row.subscription.id);
        expect(keys.every((key) => key.completedAt === null)).toBe(true);
    });

    it('never overwrites a creation key that is already completed', async () => {
        // Arrange
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const created = await authorizeFor(fake, row);
        const notApplied = {
            authorizationId: created.authorizationId,
            applied: false,
            fields: ['amount']
        };
        await subscriptionModel.recordAuthorizationResult({
            idempotencyKey: row.key!,
            subscriptionId: row.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId,
            result: notApplied,
            completedAt: new Date('2026-01-01T00:00:00.000Z')
        });

        // Act
        const summary = await sweep(fake, time);

        // Assert
        expect(summary.keysCompleted).toBe(0);
        const [key] = await createKeys(row.subscription.id);
        expect(key?.result).toEqual(notApplied);
        expect(key?.completedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    });

    it('links but leaves the key incomplete when the provider gives no checkout link', async () => {
        // Arrange
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const created = await authorizeFor(fake, row);
        readsWithoutApprovalLink(fake);

        // Act
        const summary = await sweep(fake, time);

        // Assert
        expect(summary.linked).toBe(1);
        expect(summary.keysCompleted).toBe(0);
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, row.subscription.id));
        expect(link?.providerId).toBe(created.authorizationId);
        const keys = await createKeys(row.subscription.id);
        expect(keys).toHaveLength(1);
        expect(keys[0]?.completedAt).toBeNull();
        await expect(retry(row, time)).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
    });

    it('leaves an already-linked key incomplete when the provider gives no checkout link', async () => {
        // Arrange
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const created = await authorizeFor(fake, row);
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: row.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId
        });
        time.advance({ ms: CREATION_GRACE_MS + 1 });
        readsWithoutApprovalLink(fake);

        // Act
        const summary = await sweep(fake, time);

        // Assert
        expect(summary.rowsFailed).toBe(0);
        expect(summary.keysCompleted).toBe(0);
        await expect(retry(row, time)).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
    });
});
