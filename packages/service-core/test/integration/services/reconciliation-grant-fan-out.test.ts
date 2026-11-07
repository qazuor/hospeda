import {
    domainEventModel,
    emailOutbox,
    eq,
    inArray,
    providerLinks,
    reconciliationMarks,
    reconciliationZeroCallModel,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    grantPermanentGrant,
    resumePermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import { runGrantFanOutCheck } from '../../../src/services/billing/reconciliation/sweep/grant-fan-out-check.js';
import { runZeroCallChecks } from '../../../src/services/billing/reconciliation/sweep/zero-call-checks.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { namespaceFake } from './support/payment-provider.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';
import { retireS20Rows, seedS20Addon } from './support/permanent-grant-s20-fixtures.js';

const V = VerticalEnum.ACCOMMODATION;
const OTHER = VerticalEnum.VENUE;
const clock = { now: () => new Date('2026-10-14T12:00:00.000Z') };
const users: string[] = [];
const principals: string[] = [];
const subjects: string[] = [];
let listingVertical: typeof V | typeof OTHER = V;
let providerCalls = 0;

function fakePorts(fake: FakePaymentProvider) {
    const provider = new Proxy(namespaceFake(fake), {
        get(target, key, receiver) {
            const value: unknown = Reflect.get(target, key, receiver);
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
                providerCalls++;
                return value.apply(target, args);
            };
        }
    });
    return {
        planPolicy: currentFloorPolicy,
        clock,
        provider,
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => ({
                vertical: listingVertical,
                ownerId: users[0]!,
                acceptsFeature: true
            })
        }
    };
}

async function setup(includesAddons = false) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const { userId } = await seedCoverageUser(getServiceTestDb());
    const { userId: signerId } = await seedCoverageUser(getServiceTestDb());
    users.push(userId, signerId);
    const ports = fakePorts(fake);
    const floor = await seedGrantPlan(getServiceTestDb(), V);
    const grant = await grantPermanentGrant(
        {
            beneficiaryUserId: userId,
            actor: grantSignerActor(signerId),
            reason: 'TEST:B9a:14 incomplete fan-out',
            includesAddons,
            anchors: [{ vertical: V, ...floor }]
        },
        ports
    );
    providerCalls = 0;
    return { fake, userId, signerId, ports, grant };
}

async function principal(userId: string, vertical = V) {
    const plan = await seedCoveragePlanVersion(getServiceTestDb(), vertical);
    const row = await seedCoverageSubscription(getServiceTestDb(), {
        userId,
        vertical,
        ...plan,
        status: 'ACTIVE'
    });
    principals.push(row.subscriptionId);
    subjects.push(row.subscriptionId);
    return row.subscriptionId;
}

async function marksOf(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
}

async function openedEventsOf(subscriptionId: string) {
    const events = await domainEventModel.findByEntity({
        entityType: 'subscription',
        entityId: subscriptionId,
        tx: getServiceTestDb()
    });
    return events.filter(({ eventType }) => eventType === 'reconciliation.mark_opened');
}

async function check(withPort = true, heartbeat?: () => Promise<void>) {
    return runZeroCallChecks(
        { correlationId: crypto.randomUUID(), pageSize: 1 },
        {
            retainedPayments: { listRetainedPayments: async () => [] },
            retainedPaymentBranches: {
                resolveByBranch: async () => ({ kind: 'NO_BRANCH' as const })
            },
            ...(withPort
                ? {
                      addonOrphanhood: {
                          addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                          listing: async () => ({
                              vertical: listingVertical,
                              ownerId: users[0]!,
                              acceptsFeature: true
                          }),
                          listingPurged: async () => ({ purged: false })
                      }
                  }
                : {}),
            ...(heartbeat ? { heartbeat } : {})
        }
    );
}

function grantResult(summary: Awaited<ReturnType<typeof check>>) {
    return summary.results.find(({ check: name }) => name === 'GRANT_FAN_OUT_INCOMPLETE');
}

afterAll(closeServiceTestPool);
beforeEach(() => {
    providerCalls = 0;
    listingVertical = V;
    const original = reconciliationZeroCallModel.listLiveRowsUnderLiveGrantAnchorsPage.bind(
        reconciliationZeroCallModel
    );
    vi.spyOn(
        reconciliationZeroCallModel,
        'listLiveRowsUnderLiveGrantAnchorsPage'
    ).mockImplementation(async (input) => {
        const candidates = await original({ ...input, limit: 10_000 });
        const ownIds = new Set(subjects);
        return candidates
            .filter(({ subscriptionId }) => ownIds.has(subscriptionId))
            .slice(0, input.limit);
    });
    vi.spyOn(
        reconciliationZeroCallModel,
        'listOpenSuccessionsOnDeadPredecessorsPage'
    ).mockResolvedValue([]);
    vi.spyOn(
        reconciliationZeroCallModel,
        'listDeferredCourtesiesWithActiveSuccessorPage'
    ).mockResolvedValue([]);
});
afterEach(async () => {
    await retireS20Rows();
    if (principals.length) {
        await getServiceTestDb()
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, principals));
        await getServiceTestDb()
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, principals));
        await getServiceTestDb().delete(subscriptions).where(inArray(subscriptions.id, principals));
    }
    principals.length = 0;
    subjects.length = 0;
    if (users.length)
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, users));
    await retirePermanentGrantRows(users.splice(0));
    vi.restoreAllMocks();
});

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:14 — the third zero-call check: incomplete grant fan-out (AC:B9a:14)',
    () => {
        it('E1: opens S13 mark, then resume cancels and next run does not reopen or accumulate', async () => {
            const s = await setup();
            const id = await principal(s.userId);
            const heartbeat = vi.fn(async () => undefined);
            const first = await check(true, heartbeat);
            expect(grantResult(first)?.marksOpened).toBeGreaterThanOrEqual(1);
            expect(heartbeat).toHaveBeenCalled();
            expect(
                (await marksOf(id)).filter(({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO')
            ).toHaveLength(1);
            const opened = (await openedEventsOf(id)).length;
            expect(opened).toBe(1);
            expect(providerCalls).toBe(0);
            await resumePermanentGrant(
                { permanentGrantId: s.grant.permanentGrantId, actor: grantSignerActor(s.signerId) },
                s.ports
            );
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, id));
            expect(row?.status).toBe('CANCELLED');
            const second = await check();
            expect(grantResult(second)?.marksOpened).toBe(0);
            expect(grantResult(second)?.marksAccumulated).toBe(0);
            expect(
                (await marksOf(id)).filter(({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO')
            ).toHaveLength(1);
            expect(await openedEventsOf(id)).toHaveLength(opened);
            const pageHeartbeat = vi.fn(async () => undefined);
            await runGrantFanOutCheck(
                { correlationId: crypto.randomUUID(), pageSize: 1 },
                { heartbeat: pageHeartbeat }
            );
            expect(pageHeartbeat).toHaveBeenCalled();
        });

        it('E2: repeats on the same mark without resuming', async () => {
            const s = await setup();
            const id = await principal(s.userId);
            await check();
            const second = await check();
            expect(grantResult(second)?.marksAccumulated).toBeGreaterThanOrEqual(1);
            expect(
                (await marksOf(id)).filter(({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO')
            ).toHaveLength(1);
            expect(await openedEventsOf(id)).toHaveLength(2);
        });

        it('E3: marks a live USER addon complement and stops after S20 resumes', async () => {
            const s = await setup(true);
            const addon = await seedS20Addon({
                fake: s.fake,
                userId: s.userId,
                vertical: V,
                targetId: null,
                scopeType: 'USER',
                compatibleVerticals: [V]
            });
            subjects.push(addon.complementId);
            const first = await check();
            expect(grantResult(first)?.marksOpened).toBeGreaterThanOrEqual(1);
            expect(
                (await marksOf(addon.complementId)).filter(
                    ({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO'
                )
            ).toHaveLength(1);
            await resumePermanentGrant(
                { permanentGrantId: s.grant.permanentGrantId, actor: grantSignerActor(s.signerId) },
                s.ports
            );
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, addon.complementId));
            expect(row?.status).toBe('CANCELLED');
            const second = await check();
            expect(grantResult(second)?.marksOpened).toBe(0);
            expect(grantResult(second)?.marksAccumulated).toBe(0);
        });

        it('E4: keeps a complement live when includesAddons is false', async () => {
            const s = await setup(false);
            const addon = await seedS20Addon({
                fake: s.fake,
                userId: s.userId,
                vertical: V,
                targetId: null,
                scopeType: 'USER',
                compatibleVerticals: [V]
            });
            subjects.push(addon.complementId);
            await check();
            expect(
                (await marksOf(addon.complementId)).filter(
                    ({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO'
                )
            ).toHaveLength(0);
        });

        it('E5: does not mark a LISTING targeting another vertical despite product compatibility', async () => {
            const s = await setup(true);
            listingVertical = OTHER;
            const addon = await seedS20Addon({
                fake: s.fake,
                userId: s.userId,
                vertical: OTHER,
                targetId: crypto.randomUUID(),
                scopeType: 'LISTING',
                compatibleVerticals: [V, OTHER]
            });
            subjects.push(addon.complementId);
            await check();
            expect(
                (await marksOf(addon.complementId)).filter(
                    ({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO'
                )
            ).toHaveLength(0);
        });

        it('E6: ignores a principal beneath a revoked grant', async () => {
            const s = await setup();
            await revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: 'test revocation',
                    actor: grantSignerActor(s.signerId)
                },
                s.ports
            );
            const id = await principal(s.userId);
            await check();
            expect(
                (await marksOf(id)).filter(({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO')
            ).toHaveLength(0);
        });

        it('E7: ignores a principal in another vertical', async () => {
            const s = await setup();
            const id = await principal(s.userId, OTHER);
            await check();
            expect(
                (await marksOf(id)).filter(({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO')
            ).toHaveLength(0);
        });

        it('E8: scans S13 without orphanhood and skips S20 without failure', async () => {
            const s = await setup(true);
            const id = await principal(s.userId);
            const addon = await seedS20Addon({
                fake: s.fake,
                userId: s.userId,
                vertical: V,
                targetId: null,
                scopeType: 'USER',
                compatibleVerticals: [V]
            });
            subjects.push(addon.complementId);
            const summary = await check(false);
            expect(
                (await marksOf(id)).filter(({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO')
            ).toHaveLength(1);
            expect(
                (await marksOf(addon.complementId)).filter(
                    ({ reason }) => reason === 'FAN_OUT_DE_GRANT_INCOMPLETO'
                )
            ).toHaveLength(0);
            expect(
                summary.failures.filter(({ check: name }) => name === 'GRANT_FAN_OUT_INCOMPLETE')
            ).toHaveLength(0);
        });
    }
);
