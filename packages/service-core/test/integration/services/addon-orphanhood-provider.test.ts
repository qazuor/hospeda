/**
 * TEST:B5:13 (AC:B5:27), the provider half of A5 (HOS-1545, corrida 2): over COMMITTED rows,
 * `runOrphanhood` runs in a transaction that commits, and only then
 * `cancelAddonComplementsAtProvider` sends our notice first and one call per preapproval.
 */
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    type DrizzleClient,
    emailOutbox,
    eq,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    cancelAddonComplementsAtProvider,
    runOrphanhood
} from '../../../src/services/billing/addon/addon-instance-a5';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import {
    orphanNow,
    orphanPorts,
    readDecisions,
    readInstance,
    readSubscription,
    retireCommittedOrphanRows,
    seedCommittedOrphans
} from './support/addon-orphan-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';

const TEMPLATE = 'billing.addon-cancelled';
const clock = { now: () => orphanNow };

afterEach(retireCommittedOrphanRows);
afterAll(closeServiceTestPool);

/**
 * The fake behind a Proxy whose `cancel` first reads OUR outbox row of the complement by its
 * dedup key (what existed before the call) and can fail; `readAuthorization` can fail too.
 */
function providerHarness(
    options: { readonly cancelThrows?: boolean; readonly readThrows?: boolean } = {}
) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const owners = new Map<string, { readonly userId: string; readonly complementId: string }>();
    const outboxAtCancel = new Map<string, readonly string[]>();
    const cancel = vi.fn<PaymentProvider['cancel']>(async (input) => {
        const owner = owners.get(input.authorizationId);
        if (owner) {
            const dedupKey = buildEmailDedupKey({
                recipient: owner.userId,
                template: TEMPLATE,
                occurrence: buildEventOccurrence({ eventId: owner.complementId })
            });
            const rows = await getServiceTestDb()
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupKey, dedupKey));
            outboxAtCancel.set(
                input.authorizationId,
                rows.map(({ template }) => template)
            );
        }
        if (options.cancelThrows) throw new Error('provider cancel down');
        return fake.cancel(input);
    });
    const provider = new Proxy(fake as unknown as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            if (property === 'readAuthorization' && options.readThrows)
                return async () => {
                    throw new Error('provider read down');
                };
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
    return { fake, provider, cancel, owners, outboxAtCancel };
}

/** Seeds committed orphans, runs `runOrphanhood` in a transaction that COMMITS, returns both. */
async function orphanAndCommit(h: ReturnType<typeof providerHarness>, count = 1) {
    const seeded = await seedCommittedOrphans({ fake: h.fake, count });
    for (const addon of seeded.addons)
        h.owners.set(addon.authorizationId, {
            userId: seeded.userId,
            complementId: addon.complementId
        });
    const { cancelled } = await getServiceTestDb().transaction(async (raw) => {
        const tx = raw as unknown as DrizzleClient;
        return runOrphanhood(
            { tx, subscriptionId: seeded.principalId, now: orphanNow },
            orphanPorts(tx).ports
        );
    });
    return { seeded, cancelled };
}

async function authorizationStatus(fake: FakePaymentProvider, authorizationId: string) {
    return (await fake.readAuthorization({ authorizationId })).snapshot.status;
}

async function expectLocallyCancelled(addon: {
    readonly instanceId: string;
    readonly complementId: string;
}) {
    const db = getServiceTestDb();
    expect((await readInstance(db, addon.instanceId)).status).toBe('CANCELLED');
    expect((await readSubscription(db, addon.complementId)).status).toBe('CANCELLED');
    const decisions = await readDecisions(db, addon.complementId);
    expect(decisions.map(({ reason }) => reason)).toEqual(['A5']);
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1545 TEST:B5:13 AC:B5:27 the provider half of A5: our notice first, one call, after the commit',
    () => {
        it('(a) a delivered notice: the billing.addon-cancelled row exists before the ONE call; preapproval cancelled; SENT', async () => {
            // Arrange
            const h = providerHarness();
            const { seeded, cancelled } = await orphanAndCommit(h);
            const [addon] = seeded.addons;
            if (!addon) throw new Error('no seeded addon');

            // Act
            const { results } = await cancelAddonComplementsAtProvider(
                { cancelled },
                {
                    provider: h.provider,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
                }
            );

            // Assert
            expect(results).toStrictEqual([
                { subscriptionId: addon.complementId, cancelCall: 'SENT' }
            ]);
            expect(h.cancel).toHaveBeenCalledTimes(1);
            expect(h.cancel).toHaveBeenCalledWith({ authorizationId: addon.authorizationId });
            expect(h.outboxAtCancel.get(addon.authorizationId)).toEqual([TEMPLATE]);
            expect(await authorizationStatus(h.fake, addon.authorizationId)).toBe('cancelled');
            await expectLocallyCancelled(addon);
        });

        it('(b) a notice not sent yet: ZERO calls, NOTICE_PENDING, the rows stay CANCELLED with the decision A5 for the sweep', async () => {
            // Arrange
            const h = providerHarness();
            const { seeded, cancelled } = await orphanAndCommit(h);
            const [addon] = seeded.addons;
            if (!addon) throw new Error('no seeded addon');

            // Act
            const { results } = await cancelAddonComplementsAtProvider(
                { cancelled },
                { provider: h.provider, clock, beforeCancelNotice: outboxBeforeCancelNotice() }
            );

            // Assert
            expect(results).toStrictEqual([
                { subscriptionId: addon.complementId, cancelCall: 'NOTICE_PENDING' }
            ]);
            expect(h.cancel).not.toHaveBeenCalled();
            expect(await authorizationStatus(h.fake, addon.authorizationId)).toBe('active');
            await expectLocallyCancelled(addon);
        });

        it.each([
            ['an undeliverable address', 'BOUNCE'],
            ['a deleted owner', 'DELETED']
        ] as const)('(c) without a recipient (%s) the call goes anyway, escalated NO_RECIPIENT', async (_label, kind) => {
            // Arrange
            const h = providerHarness();
            const { seeded, cancelled } = await orphanAndCommit(h);
            const [addon] = seeded.addons;
            if (!addon) throw new Error('no seeded addon');
            if (kind === 'DELETED')
                await getServiceTestDb()
                    .update(users)
                    .set({ deletedAt: orphanNow })
                    .where(eq(users.id, seeded.userId));
            const beforeCancelNotice =
                kind === 'BOUNCE'
                    ? outboxBeforeCancelNotice({ failWith: 'undeliverable:hard_bounce' })
                    : outboxBeforeCancelNotice();

            // Act
            const { results } = await cancelAddonComplementsAtProvider(
                { cancelled },
                { provider: h.provider, clock, beforeCancelNotice }
            );

            // Assert
            expect(results).toStrictEqual([
                {
                    subscriptionId: addon.complementId,
                    cancelCall: 'SENT',
                    escalated: 'NO_RECIPIENT'
                }
            ]);
            expect(h.cancel).toHaveBeenCalledTimes(1);
            expect(await authorizationStatus(h.fake, addon.authorizationId)).toBe('cancelled');
        });

        it('(d) a preapproval already cancelled at the provider: ZERO calls, NOT_NEEDED', async () => {
            // Arrange
            const h = providerHarness();
            const { seeded, cancelled } = await orphanAndCommit(h);
            const [addon] = seeded.addons;
            if (!addon) throw new Error('no seeded addon');
            await h.fake.cancel({ authorizationId: addon.authorizationId });

            // Act
            const { results } = await cancelAddonComplementsAtProvider(
                { cancelled },
                {
                    provider: h.provider,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
                }
            );

            // Assert
            expect(results).toStrictEqual([
                { subscriptionId: addon.complementId, cancelCall: 'NOT_NEEDED' }
            ]);
            expect(h.cancel).not.toHaveBeenCalled();
        });

        it.each([
            ['the call', { cancelThrows: true }],
            ['the re-read', { readThrows: true }]
        ] as const)('(e) %s failing at the provider: FAILED, never throws, the rows stay CANCELLED', async (_label, failure) => {
            // Arrange
            const h = providerHarness(failure);
            const { seeded, cancelled } = await orphanAndCommit(h);
            const [addon] = seeded.addons;
            if (!addon) throw new Error('no seeded addon');

            // Act
            const run = cancelAddonComplementsAtProvider(
                { cancelled },
                {
                    provider: h.provider,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
                }
            );

            // Assert
            await expect(run).resolves.toStrictEqual({
                results: [{ subscriptionId: addon.complementId, cancelCall: 'FAILED' }]
            });
            await expectLocallyCancelled(addon);
        });

        it('(f) two orphaned instances of the same owner with different complements: exactly one call per preapproval', async () => {
            // Arrange
            const h = providerHarness();
            const { seeded, cancelled } = await orphanAndCommit(h, 2);
            expect(cancelled).toHaveLength(2);

            // Act
            const { results } = await cancelAddonComplementsAtProvider(
                { cancelled },
                {
                    provider: h.provider,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
                }
            );

            // Assert
            const called = h.cancel.mock.calls.map(([input]) => input.authorizationId).sort();
            expect(called).toEqual(
                seeded.addons.map(({ authorizationId }) => authorizationId).sort()
            );
            expect(results.map(({ cancelCall }) => cancelCall)).toEqual(['SENT', 'SENT']);
            for (const addon of seeded.addons) {
                expect(h.outboxAtCancel.get(addon.authorizationId)).toEqual([TEMPLATE]);
                await expectLocallyCancelled(addon);
            }
        });
    }
);
