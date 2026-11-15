import { courtesyGrants, eq, getDb } from '@repo/db';
import {
    LivePermanentGrantResponseSchema,
    PermanentGrantPreviewResponseSchema,
    PermanentGrantRevocationPreviewResponseSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
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
    seedGrantPlan,
    seedGrantUser
} from './grant-fixtures';
import { retireRoutePreviewCourtesies, seedRouteDeferredCourtesy } from './preview-fixtures';

const BASE = '/api/v1/admin/billing-permanent-grants';
const clock = routeClock();
const fake = routeFake(clock);
const observed = spyingProvider(fake);
let app: ReturnType<typeof initApp>;
type Actor = {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
};

function actor(id: string): Actor {
    return {
        id,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
    };
}

function request(path: string, method: 'GET' | 'POST', who: Actor, body?: Record<string, unknown>) {
    return app.request(path, {
        method,
        headers: actorHeaders(who),
        ...(body ? { body: JSON.stringify(body) } : {})
    });
}

async function data(response: Response) {
    const envelope = await response.json();
    return envelope.data;
}

async function grant(who: Actor, beneficiaryUserId: string, vertical: VerticalEnum) {
    const anchor = await seedGrantPlan(vertical);
    const body = {
        beneficiaryUserId,
        reason: 'Permanent grant route preview scenario',
        includesAddons: false,
        anchors: [anchor]
    };
    const response = await request(BASE, 'POST', who, body);
    expect(response.status).toBe(201);
    return { id: (await data(response)).permanentGrantId as string, anchor, body };
}

describe('AC:B13a:6 (support) — grant confirmation reads over real routes', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock, paymentProvider: observed.provider });
    });
    afterAll(async () => {
        await retireRoutePreviewCourtesies();
        await cleanupPermanentGrantRows();
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it('previews a card charge without writes or provider calls, then the act applies it', async () => {
        const principal = await seedCardRevocable({ fake, clock });
        await markPermanentGrantNoticeSent(principal);
        const who = actor(await seedGrantUser('preview-route-signer'));
        const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const body = {
            beneficiaryUserId: principal.ownerId,
            reason: 'Grant preview',
            includesAddons: false,
            anchors: [anchor]
        };
        const absent = await request(`${BASE}/by-beneficiary/${principal.ownerId}`, 'GET', who);
        expect(absent.status).toBe(200);
        expect(LivePermanentGrantResponseSchema.safeParse(await data(absent)).success).toBe(true);
        expect(
            await data(await request(`${BASE}/by-beneficiary/${principal.ownerId}`, 'GET', who))
        ).toEqual({ grant: null });
        const before = await grantState(principal.ownerId);
        const callsBefore = observed.calls.length;
        const previewResponse = await request(`${BASE}/preview`, 'POST', who, body);
        expect(await grantState(principal.ownerId)).toEqual(before);
        expect(await principalStatus(principal.subscriptionId)).toBe('ACTIVE');
        expect(observed.calls.slice(callsBefore)).toEqual([]);
        expect(previewResponse.status).toBe(200);
        const preview = await data(previewResponse);
        expect(PermanentGrantPreviewResponseSchema.safeParse(preview).success).toBe(true);
        expect(preview.stoppedCharges).toEqual([
            {
                subscriptionId: principal.subscriptionId,
                vertical: VerticalEnum.ACCOMMODATION,
                status: 'ACTIVE',
                providerEmail: true
            }
        ]);
        expect(preview.convertedAddons).toEqual([]);
        const act = await request(BASE, 'POST', who, body);
        expect(act.status).toBe(201);
        const result = await data(act);
        expect(result.cancelledSubscriptionIds).toEqual(
            preview.stoppedCharges.map((row: { subscriptionId: string }) => row.subscriptionId)
        );
        const liveResponse = await request(
            `${BASE}/by-beneficiary/${principal.ownerId}`,
            'GET',
            who
        );
        expect(liveResponse.status).toBe(200);
        const live = await data(liveResponse);
        expect(LivePermanentGrantResponseSchema.safeParse(live).success).toBe(true);
        expect(live.grant).toMatchObject({
            permanentGrantId: result.permanentGrantId,
            anchors: [anchor]
        });
        const beforeRevoke = await grantState(principal.ownerId);
        const callsBeforeRevoke = observed.calls.length;
        const revokePreviewResponse = await request(
            `${BASE}/${result.permanentGrantId}/revocation`,
            'GET',
            who
        );
        expect(await grantState(principal.ownerId)).toEqual(beforeRevoke);
        expect(observed.calls.slice(callsBeforeRevoke)).toEqual([]);
        expect(revokePreviewResponse.status).toBe(200);
        const revokePreview = await data(revokePreviewResponse);
        expect(PermanentGrantRevocationPreviewResponseSchema.safeParse(revokePreview).success).toBe(
            true
        );
        expect(revokePreview).toEqual({
            permanentGrantId: result.permanentGrantId,
            verticalsLosingService: [VerticalEnum.ACCOMMODATION],
            addonsTurnedOff: [],
            trialReturns: false,
            oldDebitResumes: false
        });
        expect(
            beforeRevoke.grants.find(({ id }) => id === result.permanentGrantId)?.revokedAt
        ).toBeNull();
        const revoke = await request(`${BASE}/${result.permanentGrantId}/revocation`, 'POST', who, {
            reason: 'Confirmed after preview'
        });
        expect(revoke.status).toBe(200);
        const revoked = await data(revoke);
        expect(revoked.revokedVerticals).toEqual(revokePreview.verticalsLosingService);
        expect(revoked.cancelledAddonInstanceIds).toEqual([]);
        expect(
            (await data(await request(`${BASE}/by-beneficiary/${principal.ownerId}`, 'GET', who)))
                .grant
        ).toBeNull();
    });

    it('previews an anchor and closes a seeded deferred balance only in the act', async () => {
        const who = actor(await seedGrantUser('preview-anchor-signer'));
        const activePrincipal = await seedCardRevocable({ fake, clock });
        await markPermanentGrantNoticeSent(activePrincipal);
        const beneficiaryId = activePrincipal.ownerId;
        const first = await grant(who, beneficiaryId, VerticalEnum.VENUE);
        const accommodation = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const before = await grantState(beneficiaryId);
        const callsBefore = observed.calls.length;
        const previewResponse = await request(
            `${BASE}/${first.id}/anchors/preview`,
            'POST',
            who,
            accommodation
        );
        expect(previewResponse.status).toBe(200);
        const preview = await data(previewResponse);
        expect(PermanentGrantPreviewResponseSchema.safeParse(preview).success).toBe(true);
        expect(preview.stoppedCharges).toEqual([
            {
                subscriptionId: activePrincipal.subscriptionId,
                vertical: VerticalEnum.ACCOMMODATION,
                status: 'ACTIVE',
                providerEmail: true
            }
        ]);
        expect(preview.convertedAddons).toEqual([]);
        expect(await grantState(beneficiaryId)).toEqual(before);
        expect(await principalStatus(activePrincipal.subscriptionId)).toBe('ACTIVE');
        expect(observed.calls.slice(callsBefore)).toEqual([]);
        const act = await request(`${BASE}/${first.id}/anchors`, 'POST', who, accommodation);
        expect(act.status).toBe(201);
        expect((await data(act)).cancelledSubscriptionIds).toEqual(
            preview.stoppedCharges.map((row: { subscriptionId: string }) => row.subscriptionId)
        );

        const principal = await seedCardRevocable({ fake, clock });
        await markPermanentGrantNoticeSent(principal);
        const secondSigner = actor(await seedGrantUser('preview-deferred-signer'));
        const old = await grant(secondSigner, principal.ownerId, VerticalEnum.ACCOMMODATION);
        expect(
            (
                await request(`${BASE}/${old.id}/revocation`, 'POST', secondSigner, {
                    reason: 'Prepare deferred scenario'
                })
            ).status
        ).toBe(200);
        const courtesyId = await seedRouteDeferredCourtesy({
            beneficiaryUserId: principal.ownerId,
            grantedBy: secondSigner.id,
            subscriptionId: principal.subscriptionId,
            balanceMonths: 4
        });
        const current = await grant(secondSigner, principal.ownerId, VerticalEnum.VENUE);
        const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const snapshot = await grantState(principal.ownerId);
        const deferredPreviewResponse = await request(
            `${BASE}/${current.id}/anchors/preview`,
            'POST',
            secondSigner,
            anchor
        );
        expect(deferredPreviewResponse.status).toBe(200);
        const deferredPreview = await data(deferredPreviewResponse);
        expect(PermanentGrantPreviewResponseSchema.safeParse(deferredPreview).success).toBe(true);
        expect(deferredPreview.closedDeferredBalances).toEqual([
            { courtesyGrantId: courtesyId, vertical: VerticalEnum.ACCOMMODATION, balanceMonths: 4 }
        ]);
        expect(await grantState(principal.ownerId)).toEqual(snapshot);
        const [balance] = await getDb()
            .select({ balanceClosedAt: courtesyGrants.balanceClosedAt })
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, courtesyId));
        expect(balance?.balanceClosedAt).toBeNull();
        const anchorAct = await request(
            `${BASE}/${current.id}/anchors`,
            'POST',
            secondSigner,
            anchor
        );
        expect(anchorAct.status).toBe(201);
        expect((await data(anchorAct)).closedCourtesyIds).toEqual([courtesyId]);
    });
});
