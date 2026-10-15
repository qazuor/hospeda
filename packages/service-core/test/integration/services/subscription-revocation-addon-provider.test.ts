/** TEST:B5:12 (f): A5 notice and provider half after S36 commits. */

import {
    addonInstances,
    emailOutbox,
    eq,
    getDb,
    inArray,
    providerLinks,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { seedVerticalAddon } from './support/addon-orphan-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';
import {
    retireRevocationRows,
    revocationFixture,
    seedRevocationActor,
    trackSubscription
} from './support/revocation-fixtures';

const created: { instanceId: string }[] = [];
const createdSubscriptions: string[] = [];

afterAll(closeServiceTestPool);
afterEach(async () => {
    const db = getDb();
    const ids = createdSubscriptions.splice(0);
    if (ids.length > 0) {
        const marks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, ids));
        if (marks.length > 0)
            await db.delete(reconciliationMarkPayments).where(
                inArray(
                    reconciliationMarkPayments.markId,
                    marks.map(({ id }) => id)
                )
            );
        await db
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, ids));
    }
    for (const { instanceId } of created.splice(0))
        await db
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(eq(addonInstances.id, instanceId));
    await retireRevocationRows();
});

describe.skipIf(!isServiceTestDbAvailable())('TEST:B5:12 A5 provider half from S36', () => {
    it('TEST:B5:12 (f) sends addon notice before one provider call; pending notice defers it', async () => {
        const f = await revocationFixture();
        const addon = await seedVerticalAddon(getDb(), {
            userId: f.userId,
            targetId: f.subscriptionId
        });
        trackSubscription(addon.complementId);
        createdSubscriptions.push(addon.complementId);
        created.push({ instanceId: addon.instanceId });
        const auth = await f.fixture.provider.authorize({
            reference: `b56-addon-${crypto.randomUUID()}`,
            amount: { amountMinor: 500000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'TEST:B5:12 addon provider fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `addon-${crypto.randomUUID()}@example.test`
        });
        await f.fixture.provider.approve({ authorizationId: auth.authorizationId });
        await getDb()
            .update(providerLinks)
            .set({ providerId: auth.authorizationId })
            .where(eq(providerLinks.subscriptionId, addon.complementId));
        f.at(f.day(5));
        let noticeAtCancel = false;
        let addonCancels = 0;
        const provider = new Proxy(f.ports.provider, {
            get(target, property, receiver) {
                if (property === 'cancel')
                    return async (input: { authorizationId: string }) => {
                        if (input.authorizationId === auth.authorizationId) {
                            addonCancels++;
                            noticeAtCancel =
                                (
                                    await getDb()
                                        .select({ id: emailOutbox.id })
                                        .from(emailOutbox)
                                        .where(eq(emailOutbox.template, 'billing.addon-cancelled'))
                                ).length > 0;
                        }
                        return target.cancel(input);
                    };
                const value = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
        const sent = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: f.subscriptionId,
                expectedPaymentId: f.payment?.id
            },
            {
                ...f.ports,
                provider,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
            }
        );
        expect(noticeAtCancel).toBe(true);
        expect(addonCancels).toBe(1);
        expect(f.cancel).toHaveBeenCalledTimes(2);
        expect(sent.addonCancelCalls).toHaveLength(1);
        expect(sent.addonCancelCalls[0]?.cancelCall).toBe('SENT');

        const pending = await revocationFixture();
        const pendingAddon = await seedVerticalAddon(getDb(), {
            userId: pending.userId,
            targetId: pending.subscriptionId
        });
        trackSubscription(pendingAddon.complementId);
        createdSubscriptions.push(pendingAddon.complementId);
        created.push({ instanceId: pendingAddon.instanceId });
        const pendingAuth = await pending.fixture.provider.authorize({
            reference: `b56-addon-${crypto.randomUUID()}`,
            amount: { amountMinor: 500000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'TEST:B5:12 pending addon provider fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `addon-${crypto.randomUUID()}@example.test`
        });
        await pending.fixture.provider.approve({ authorizationId: pendingAuth.authorizationId });
        await getDb()
            .update(providerLinks)
            .set({ providerId: pendingAuth.authorizationId })
            .where(eq(providerLinks.subscriptionId, pendingAddon.complementId));
        pending.at(pending.day(5));
        let pendingCancels = 0;
        const pendingProvider = new Proxy(pending.ports.provider, {
            get(target, property, receiver) {
                if (property === 'cancel')
                    return async (input: { authorizationId: string }) => {
                        if (input.authorizationId === pendingAuth.authorizationId) pendingCancels++;
                        return target.cancel(input);
                    };
                const value = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
        const deferred = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: pending.subscriptionId,
                expectedPaymentId: pending.payment?.id
            },
            {
                ...pending.ports,
                provider: pendingProvider,
                beforeCancelNotice: outboxBeforeCancelNotice()
            }
        );
        expect(pendingCancels).toBe(0);
        expect(pending.cancel).not.toHaveBeenCalled();
        expect(deferred.cancelCall).toBe('NOTICE_PENDING');
        expect(deferred.addonCancelCalls).toHaveLength(1);
        expect(deferred.addonCancelCalls[0]?.cancelCall).toBe('NOTICE_PENDING');
        expect(
            (
                await getDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, pendingAddon.complementId))
            )[0]?.status
        ).toBe('CANCELLED');
    });
});
