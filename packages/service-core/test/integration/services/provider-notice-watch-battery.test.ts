// HOS-1512 (owner decision on the webhook noise, option 1): the notice of an authorization the
// provider watch battery created and RECORDED is dropped, with no receipt tombstone and no
// reconciliation mark. A watch-looking reference alone is not enough, and a real subscription is
// never affected. Every case goes through `processProviderNotice`, as the webhook does.
//
// Cleanup: the marks these notices open are lifted, the seeded rows are taken to CANCELLED and the
// battery runs are deleted. Receipt tombstones are born CANCELLED and stay, as in the sibling suite.
import {
    and,
    eq,
    inArray,
    isNull,
    providerLinks,
    providerWatchRunModel,
    providerWatchRuns,
    reconciliationMarks,
    subscriptions,
    users
} from '@repo/db';
import { type ProviderNotice, WATCH_REFERENCE_PREFIX } from '@repo/payments';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    type ProcessProviderNoticePorts,
    processProviderNotice
} from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { reconciliationClock, seedSubscription } from './reconciliation-sweep-fixtures.js';
import { createChargingFake, tombstoneRows } from './reconciliation-tombstone-fixtures.js';

const runs = new Set<string>();
const subjects = new Set<string>();
const seeded = new Set<string>();
let lifterId: string;

beforeAll(async () => {
    const [lifter] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `watch-notice-lifter-${crypto.randomUUID()}@example.test`,
            displayName: 'Watch notice lifter',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!lifter) throw new Error('missing lifter');
    lifterId = lifter.id;
});
afterAll(closeServiceTestPool);
afterEach(async () => {
    vi.restoreAllMocks();
    const db = getServiceTestDb();
    const ids = [...subjects, ...seeded];
    subjects.clear();
    if (ids.length > 0)
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: lifterId })
            .where(
                and(
                    inArray(reconciliationMarks.subscriptionId, ids),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    if (seeded.size > 0)
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(inArray(subscriptions.id, [...seeded]));
    seeded.clear();
    if (runs.size > 0)
        await db.delete(providerWatchRuns).where(inArray(providerWatchRuns.id, [...runs]));
    runs.clear();
});

function webhook(notice: ProviderNotice) {
    return {
        channel: 'WEBHOOKS' as const,
        delivery: {
            headers: { 'content-type': 'application/json' },
            body: encodeFakeNotice({ notice, format: 'json' }).body
        }
    };
}

function receiverPorts(
    provider: ProcessProviderNoticePorts['provider']
): ProcessProviderNoticePorts {
    return {
        provider,
        clock: reconciliationClock,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' }
    };
}

/** A pending preapproval as the battery creates it: a watch reference, no card. */
async function authorization(
    fake: ReturnType<typeof createChargingFake>['fake'],
    reference: string
) {
    const { authorizationId } = await fake.authorize({
        reference,
        amount: { amountMinor: 1500, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Hospeda provider watch',
        returnUrl: 'https://example.test/return',
        payerEmail: `watch-${crypto.randomUUID()}@example.test`
    });
    return authorizationId;
}

/** A battery run that recorded `providerId`, as `appendProgress` records it. */
async function recordedByRun(providerId: string): Promise<string> {
    const { runId } = await providerWatchRunModel.open({
        account: 'sandbox',
        startedAt: reconciliationClock.now()
    });
    runs.add(runId);
    await providerWatchRunModel.appendProgress({
        runId,
        measurementId: 'lifecycle-sbx',
        providerIds: [providerId]
    });
    return runId;
}

async function linkOf(authorizationId: string) {
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.providerId, authorizationId));
    return link;
}

const watchReference = () => `${WATCH_REFERENCE_PREFIX}${crypto.randomUUID()}-lifecycle`;

describe('HOS-1512 notices of the provider watch battery', () => {
    it('drops the notice of an id a battery run recorded: no tombstone, no mark, no cancel', async () => {
        const { fake, provider } = createChargingFake();
        const authorizationId = await authorization(fake, watchReference());
        await recordedByRun(authorizationId);
        const cancel = vi.spyOn(fake, 'cancel');
        const read = vi.spyOn(provider, 'readAuthorization');

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: authorizationId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'WATCH_BATTERY_DROPPED' });
        // Re-read by id, never trusting the notice body.
        expect(read).toHaveBeenCalledWith({ authorizationId });
        expect(await linkOf(authorizationId)).toBeUndefined();
        expect(cancel).not.toHaveBeenCalled();
    });

    it('writes the tombstone and the mark for a watch-looking id no battery run recorded', async () => {
        const { fake, provider } = createChargingFake();
        const authorizationId = await authorization(fake, watchReference());

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: authorizationId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'TOMBSTONE_WRITTEN' });
        const link = await linkOf(authorizationId);
        if (!link) throw new Error('Expected the tombstone link');
        subjects.add(link.subscriptionId);
        const rows = await tombstoneRows(link.subscriptionId);
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['TRANSICION_NO_DECLARADA']);
    });

    it('leaves a real subscription unaffected', async () => {
        const { fake, provider } = createChargingFake();
        const owned = await seedSubscription({ status: 'ACTIVE' });
        seeded.add(owned.subscription.id);
        subjects.add(owned.subscription.id);
        const authorizationId = await authorization(fake, owned.subscription.id);

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: authorizationId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'RELINKED' });
        expect(await linkOf(authorizationId)).toMatchObject({
            subscriptionId: owned.subscription.id
        });
    });

    it('does not drop a recorded id whose re-read reference is not the battery’s', async () => {
        const { fake, provider } = createChargingFake();
        const owned = await seedSubscription({ status: 'ACTIVE' });
        seeded.add(owned.subscription.id);
        subjects.add(owned.subscription.id);
        const authorizationId = await authorization(fake, owned.subscription.id);
        await recordedByRun(authorizationId);

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: authorizationId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'RELINKED' });
    });
});
