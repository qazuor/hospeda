import {
    emailOutbox,
    eq,
    idempotencyKeys,
    providerLinks,
    reconciliationMarks,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdjustableClock } from '../../../../test-clock/src/adjustable-clock.js';
import {
    CREATION_GRACE_MS,
    CREATION_RECREATE_AFTER_MS,
    runCreationsSweep
} from '../../../src/services/billing/reconciliation/creations/creations-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import {
    createReconciliationFake,
    resetSeededReconciliationInventory,
    seedPendingCreation,
    seedSubscription,
    withSeededPendingCreations
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);

describe('TEST:B11:23 creations sweep over the fake', () => {
    it('links the newest matching pending, cancels older duplicates, and ignores another row', async () => {
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const other = await seedPendingCreation();
        const input = {
            reference: row.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' as const },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://example.test',
            payerEmail: row.userEmail!
        };
        const old = await fake.authorize(input);
        time.advance({ ms: 1000 });
        const newest = await fake.authorize(input);
        const foreign = await fake.authorize({ ...input, reference: other.subscription.id });
        const cancel = vi.spyOn(fake, 'cancel');
        const search = vi.spyOn(fake, 'searchAuthorizations');
        const summary = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, row.subscription.id));
        expect(link?.providerId).toBe(newest.authorizationId);
        expect(cancel).toHaveBeenCalledExactlyOnceWith({ authorizationId: old.authorizationId });
        expect(
            (await fake.readAuthorization({ authorizationId: foreign.authorizationId })).snapshot
                .status
        ).toBe('pending');
        expect(search).toHaveBeenCalledWith({ payerEmail: row.userEmail });
        expect(summary.rowsFailed).toBe(0);
        expect(
            (
                await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, row.subscription.id))
            )[0]?.status
        ).toBe('PENDING_AUTHORIZATION');
        expect(
            await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, row.subscription.userId!))
        ).toHaveLength(0);
        expect(
            await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, row.subscription.id))
        ).toHaveLength(0);
    });

    it('uses only payerEmail and cancels a late pending on later runs once', async () => {
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const input = {
            reference: row.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' as const },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://example.test',
            payerEmail: row.userEmail!
        };
        const original = await fake.authorize(input);
        await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        const late = await fake.authorize({ ...input, reason: 'late' });
        const cancel = vi.spyOn(fake, 'cancel');
        const search = vi.spyOn(fake, 'searchAuthorizations');
        await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(cancel).toHaveBeenCalledExactlyOnceWith({ authorizationId: late.authorizationId });
        search.mockResolvedValueOnce({
            authorizations: [
                {
                    authorizationId: late.authorizationId,
                    createdAt: time.now().toISOString(),
                    reference: row.subscription.id,
                    status: 'pending'
                }
            ]
        });
        const repeated = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(repeated.alreadyCancelled).toBe(1);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(search).toHaveBeenCalledWith({ payerEmail: row.userEmail });
        expect(
            search.mock.calls.every(([arg]) => Object.keys(arg).join(',') === 'payerEmail')
        ).toBe(true);
        expect(original.authorizationId).toBeDefined();
    });

    it('waits through the creation grace period and skips rows without a usable email', async () => {
        const time = createAdjustableClock({ start: new Date(Date.now() + 60_000) });
        const { fake } = createReconciliationFake(time);
        const fresh = await seedPendingCreation();
        const search = vi.spyOn(fake, 'searchAuthorizations');
        const summary = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(summary.skippedTooFresh).toBe(1);
        expect(search).not.toHaveBeenCalled();
        time.advance({ ms: CREATION_GRACE_MS + 1 });
        await getServiceTestPool().query("UPDATE users SET email = '' WHERE id = $1", [
            fresh.subscription.userId
        ]);
        const noEmail = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(noEmail.skippedNoEmail).toBe(1);
        expect(search).not.toHaveBeenCalled();
    });

    it('does not cancel when an id re-read no longer names the searched row', async () => {
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const linked = await fake.authorize({
            reference: row.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test linked creation',
            returnUrl: 'https://example.test',
            payerEmail: row.userEmail!
        });
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: row.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: linked.authorizationId
        });
        time.advance({ ms: CREATION_GRACE_MS + 1 });
        const unrelated = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const authId = unrelated.providerId!;
        vi.spyOn(fake, 'searchAuthorizations').mockResolvedValue({
            authorizations: [
                {
                    authorizationId: authId,
                    createdAt: time.now().toISOString(),
                    reference: row.subscription.id,
                    status: 'pending'
                }
            ]
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const summary = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(cancel).not.toHaveBeenCalled();
        expect(summary).toMatchObject({ linked: 0, skippedRaced: 1 });
    });

    it('does not recreate while a different live provider state names the row', async () => {
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const pending = await fake.authorize({
            reference: row.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://example.test',
            payerEmail: row.userEmail!
        });
        await fake.approve({ authorizationId: pending.authorizationId });
        const authorize = vi.spyOn(fake, 'authorize');
        const cancel = vi.spyOn(fake, 'cancel');
        const summary = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(summary.skippedLiveElsewhere).toBe(1);
        expect(authorize).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, row.subscription.id))
        ).toHaveLength(0);
    });

    it('falls back to the next newest candidate when the first is cancelled on re-read', async () => {
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        const input = {
            reference: row.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' as const },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://example.test',
            payerEmail: row.userEmail!
        };
        const older = await fake.authorize(input);
        time.advance({ ms: 1000 });
        const newer = await fake.authorize(input);
        await fake.cancel({ authorizationId: newer.authorizationId });
        vi.spyOn(fake, 'searchAuthorizations').mockResolvedValue({
            authorizations: [
                {
                    authorizationId: older.authorizationId,
                    createdAt: new Date(time.now().getTime() - 1000).toISOString(),
                    reference: row.subscription.id,
                    status: 'pending'
                },
                {
                    authorizationId: newer.authorizationId,
                    createdAt: time.now().toISOString(),
                    reference: row.subscription.id,
                    status: 'pending'
                }
            ]
        });
        const summary = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, row.subscription.id));
        expect(link?.providerId).toBe(older.authorizationId);
        expect(summary.linked).toBe(1);
    });

    it('recreates only after the latest key ages past the retry threshold', async () => {
        const time = createAdjustableClock({ start: new Date(Date.now() + 60_000) });
        const { fake } = createReconciliationFake(time);
        const row = await seedPendingCreation();
        vi.spyOn(fake, 'searchAuthorizations').mockResolvedValue({ authorizations: [] });
        const recent = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(recent.recreated).toBe(0);
        await getServiceTestPool().query(
            "UPDATE idempotency_key SET created_at = $1 WHERE subject_id = $2 AND operation = 'PREAPPROVAL_CREATE'",
            [new Date(time.now().getTime() - CREATION_RECREATE_AFTER_MS), row.subscription.id]
        );
        time.advance({ ms: CREATION_RECREATE_AFTER_MS + 1 });
        let durableBeforeCall = false;
        const authorize = fake.authorize.bind(fake);
        vi.spyOn(fake, 'authorize').mockImplementation(async (input) => {
            const keys = await getServiceTestDb()
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, row.subscription.id));
            durableBeforeCall = keys.some((key) => key.key !== row.key && key.completedAt === null);
            return authorize(input);
        });
        const result = await withSeededPendingCreations(() =>
            runCreationsSweep(
                {},
                { provider: fake, clock: time, returnUrl: 'https://example.test' }
            )
        );
        expect(result.recreated).toBe(1);
        expect(
            (
                await getServiceTestDb()
                    .select()
                    .from(providerLinks)
                    .where(eq(providerLinks.subscriptionId, row.subscription.id))
            ).length
        ).toBe(1);
        expect(durableBeforeCall).toBe(true);
        const keys = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, row.subscription.id));
        expect(keys).toHaveLength(2);
        expect(keys.find((key) => key.key === row.key)?.completedAt).toBeNull();
        const newest = keys.find((key) => key.key !== row.key);
        expect(newest?.completedAt).toBeInstanceOf(Date);
        expect(
            (
                await subscriptionModel.findLiveCommitment({
                    userId: row.subscription.userId!,
                    vertical: 'accommodation'
                })
            )?.idempotencyKey?.key
        ).toBe(newest?.key);
    });
});
