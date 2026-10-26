import {
    PermanentGrantProviderCancelCallSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import type { S13CancelCall } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType, auditLog } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    failingCancel,
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedCardRevocable,
    spyingProvider
} from '../billing-subscription/revocation-route-fixtures';
import {
    cleanupPermanentGrantRows,
    grantState,
    markPermanentGrantNoticeSent,
    principalStatus,
    seedGrant,
    seedGrantPlan,
    seedGrantUser
} from './grant-fixtures';

const PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_GRANT_COMPLIMENTARY
] as const;
let app: ReturnType<typeof initApp>;
const defaultClock = routeClock();
const defaultFake = routeFake(defaultClock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

type Actor = {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
};

function makeActor(id: string): Actor {
    return { id, role: 'SUPER_ADMIN', permissions: PERMISSIONS };
}

function post(path: string, body: Record<string, unknown>, actor: Actor) {
    return app.request(path, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

function grantBody(beneficiaryUserId: string, anchor: Awaited<ReturnType<typeof seedGrantPlan>>) {
    return {
        beneficiaryUserId,
        reason: 'B9a route grant',
        includesAddons: false,
        anchors: [anchor]
    };
}

async function createGrant(input: {
    readonly actorId: string;
    readonly beneficiaryId: string;
    readonly anchor: Awaited<ReturnType<typeof seedGrantPlan>>;
    readonly provider: ReturnType<typeof spyingProvider>['provider'];
    readonly clock?: ReturnType<typeof routeClock>;
}) {
    const requestClock = input.clock ?? defaultClock;
    app = initApp({ clock: requestClock, paymentProvider: input.provider });
    const response = await post(
        '/api/v1/admin/billing-permanent-grants',
        grantBody(input.beneficiaryId, input.anchor),
        makeActor(input.actorId)
    );
    const envelope = await response.json();
    return { response, body: envelope.data ?? envelope };
}

describe('TEST:B9a:9 admin action 2 routes (AC:B9a:8, AC:B9a:9)', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock: defaultClock, paymentProvider: defaultFake });
    });
    beforeEach(() => {
        audit.mockClear();
    });
    afterAll(async () => {
        await cleanupPermanentGrantRows();
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it('g — creates a grant, cancels the live principal and audits ACC_2 after the service succeeds', async () => {
        const clock = routeClock();
        const fake = routeFake(clock);
        const observed = spyingProvider(fake);
        const principal = await seedCardRevocable({ fake, clock });
        await markPermanentGrantNoticeSent(principal);
        const actorId = await seedGrantUser('grant-actor');
        const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const { response, body } = await createGrant({
            actorId,
            beneficiaryId: principal.ownerId,
            anchor,
            provider: observed.provider,
            clock
        });

        expect(response.status).toBe(201);
        expect(body).toMatchObject({
            permanentGrantId: expect.any(String),
            anchorIds: [expect.any(String)],
            cancelledSubscriptionIds: [principal.subscriptionId],
            releasedRetentionIds: [],
            closedCourtesyIds: [],
            providerCalls: [{ subscriptionId: principal.subscriptionId, cancelCall: 'SENT' }],
            anchoredAddonInstanceIds: [],
            addonProviderCalls: []
        });
        expect(await principalStatus(principal.subscriptionId)).toBe('CANCELLED');
        expect(observed.calls.filter((call) => call === 'cancel')).toHaveLength(1);
        expect(auditLog).toHaveBeenCalledTimes(1);
        expect(auditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_2',
                    transition: 'S13',
                    subjectId: principal.ownerId
                })
            })
        );
    });

    it('h — anchors a second vertical and cancels that vertical principal', async () => {
        const clock = routeClock();
        const fake = routeFake(clock);
        const observed = spyingProvider(fake);
        const principal = await seedCardRevocable({ fake, clock });
        await markPermanentGrantNoticeSent(principal);
        const actorId = await seedGrantUser('anchor-actor');
        const firstVertical = await seedGrantPlan(VerticalEnum.VENUE);
        const grant = await seedGrant({
            beneficiaryUserId: principal.ownerId,
            grantedBy: actorId,
            anchor: firstVertical
        });
        const secondVertical = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        app = initApp({ clock, paymentProvider: observed.provider });
        const response = await post(
            `/api/v1/admin/billing-permanent-grants/${grant.grantId}/anchors`,
            secondVertical,
            makeActor(actorId)
        );
        expect(response.status).toBe(201);
        expect((await response.json()).data).toMatchObject({
            anchorId: expect.any(String),
            cancelledSubscriptionIds: [principal.subscriptionId],
            providerCalls: [{ subscriptionId: principal.subscriptionId, cancelCall: 'SENT' }]
        });
        expect(await principalStatus(principal.subscriptionId)).toBe('CANCELLED');
        expect(observed.calls.filter((call) => call === 'cancel')).toHaveLength(1);
        expect(await grantState(principal.ownerId)).toMatchObject({
            anchors: [{ id: grant.anchorId }, { id: expect.any(String) }]
        });
    });

    it('i — a second live grant is 409 while two revoked grants do not block the first', async () => {
        const beneficiary = await seedGrantUser('unique-beneficiary');
        const actorId = await seedGrantUser('unique-actor');
        const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        await seedGrant({ beneficiaryUserId: beneficiary, grantedBy: actorId, revoked: true });
        await seedGrant({ beneficiaryUserId: beneficiary, grantedBy: actorId, revoked: true });
        const first = await createGrant({
            actorId,
            beneficiaryId: beneficiary,
            anchor,
            provider: routeFake(routeClock())
        });
        expect(first.response.status).toBe(201);
        const snapshot = await grantState(beneficiary);
        const second = await createGrant({
            actorId,
            beneficiaryId: beneficiary,
            anchor,
            provider: routeFake(routeClock())
        });
        expect(second.response.status).toBe(409);
        expect(second.body.error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'PERMANENT_GRANT_ALREADY_LIVE'
        });
        expect(second.body.error.code).not.toBe('INTERNAL_ERROR');
        expect(await grantState(beneficiary)).toEqual(snapshot);
    });

    it('j — anchor references return their typed missing, revoked, duplicate and cross-vertical rejections', async () => {
        const actorId = await seedGrantUser('reference-actor');
        const beneficiary = await seedGrantUser('reference-beneficiary');
        const accommodation = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const grant = await seedGrant({
            beneficiaryUserId: beneficiary,
            grantedBy: actorId,
            anchor: accommodation
        });
        const gastronomy = await seedGrantPlan(VerticalEnum.VENUE);
        const revokedBeneficiary = await seedGrantUser('revoked-beneficiary');
        const revoked = await seedGrant({
            beneficiaryUserId: revokedBeneficiary,
            grantedBy: actorId,
            anchor: accommodation,
            revoked: true
        });
        const otherVerticalBeneficiary = await seedGrantUser('other-vertical-beneficiary');
        const otherVerticalGrant = await seedGrant({
            beneficiaryUserId: otherVerticalBeneficiary,
            grantedBy: actorId,
            anchor: gastronomy
        });
        const missingPath = `/api/v1/admin/billing-permanent-grants/${crypto.randomUUID()}/anchors`;
        const path = (id: string) => `/api/v1/admin/billing-permanent-grants/${id}/anchors`;
        const answers = [
            [missingPath, gastronomy, 404, 'NOT_FOUND', 'PERMANENT_GRANT_NOT_FOUND'],
            [
                path(revoked.grantId),
                gastronomy,
                422,
                'VALIDATION_ERROR',
                'PERMANENT_GRANT_NOT_LIVE'
            ],
            [
                path(grant.grantId),
                accommodation,
                409,
                'ALREADY_EXISTS',
                'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED'
            ],
            [
                path(otherVerticalGrant.grantId),
                { ...gastronomy, vertical: VerticalEnum.ACCOMMODATION },
                422,
                'VALIDATION_ERROR',
                'PERMANENT_GRANT_REFERENCE_NOT_FOUND'
            ]
        ] as const;
        for (const [url, body, status, code, reason] of answers) {
            const response = await post(url, body, makeActor(actorId));
            expect(response.status).toBe(status);
            expect((await response.json()).error).toMatchObject({ code, reason });
        }
        const nonexistent = await post(
            '/api/v1/admin/billing-permanent-grants',
            grantBody(crypto.randomUUID(), accommodation),
            makeActor(actorId)
        );
        expect(nonexistent.status).toBe(422);
        const nonexistentError = (await nonexistent.json()).error;
        expect(nonexistentError).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'PERMANENT_GRANT_REFERENCE_NOT_FOUND'
        });
        expect(nonexistentError.code).not.toBe('INTERNAL_ERROR');
    });

    it('k — accepts NOT_NEEDED, FAILED, and empty provider result lists without turning committed writes into 500', async () => {
        const clock = routeClock();
        const fake = routeFake(clock);
        const alreadyCancelled = await seedCardRevocable({ fake, clock });
        await fake.cancel({ authorizationId: alreadyCancelled.authorizationId });
        const actor1 = await seedGrantUser('not-needed-actor');
        const plan1 = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const notNeeded = await createGrant({
            actorId: actor1,
            beneficiaryId: alreadyCancelled.ownerId,
            anchor: plan1,
            provider: fake,
            clock
        });
        expect(notNeeded.response.status).toBe(201);
        expect(notNeeded.body.providerCalls).toContainEqual(
            expect.objectContaining({ cancelCall: 'NOT_NEEDED' })
        );

        const clock2 = routeClock();
        const fake2 = routeFake(clock2);
        const failing = await seedCardRevocable({ fake: fake2, clock: clock2 });
        await markPermanentGrantNoticeSent(failing);
        const actor2 = await seedGrantUser('failed-actor');
        const plan2 = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const failed = await createGrant({
            actorId: actor2,
            beneficiaryId: failing.ownerId,
            anchor: plan2,
            provider: failingCancel(fake2),
            clock: clock2
        });
        expect(failed.response.status).toBe(201);
        expect(failed.body.providerCalls).toContainEqual(
            expect.objectContaining({ cancelCall: 'FAILED' })
        );
        expect(await principalStatus(failing.subscriptionId)).toBe('CANCELLED');

        const actor3 = await seedGrantUser('empty-actor');
        const beneficiary3 = await seedGrantUser('empty-beneficiary');
        const plan3 = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const empty = await createGrant({
            actorId: actor3,
            beneficiaryId: beneficiary3,
            anchor: plan3,
            provider: routeFake(routeClock()),
            clock: routeClock()
        });
        expect(empty.response.status).toBe(201);
        expect(empty.body).toMatchObject({
            cancelledSubscriptionIds: [],
            providerCalls: [],
            anchoredAddonInstanceIds: [],
            addonProviderCalls: []
        });
    });

    it('l — response cancelCall options match the service S13CancelCall union', () => {
        const serviceCalls = {
            SENT: true,
            NOT_NEEDED: true,
            NOTICE_PENDING: true,
            FAILED: true,
            NOT_APPLICABLE: true
        } satisfies Record<S13CancelCall, true>;
        expect([...PermanentGrantProviderCancelCallSchema.options].sort()).toEqual(
            Object.keys(serviceCalls).sort()
        );
    });
});
