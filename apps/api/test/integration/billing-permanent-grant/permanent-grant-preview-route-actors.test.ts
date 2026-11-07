import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    retireRevocationRouteRows,
    routeClock,
    routeFake
} from '../billing-subscription/revocation-route-fixtures';
import {
    cleanupPermanentGrantRows,
    grantState,
    seedGrantPlan,
    seedGrantUser
} from './grant-fixtures';

const BASE = '/api/v1/admin/billing-permanent-grants';
const clock = routeClock();
const fake = routeFake(clock);
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

function request(
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
    who?: Actor
) {
    return app.request(path, {
        method,
        headers: actorHeaders(who),
        ...(body ? { body: JSON.stringify(body) } : {})
    });
}

async function createGrant(signer: Actor, beneficiaryUserId: string) {
    const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
    const body = {
        beneficiaryUserId,
        reason: 'Preview route actor fixture',
        includesAddons: false,
        anchors: [anchor]
    };
    const response = await request(BASE, 'POST', body, signer);
    expect(response.status).toBe(201);
    const grantId = (await response.json()).data.permanentGrantId as string;
    return { grantId, body, anchor };
}

describe('AC:B13a:6 (support) — preview route actors and refusals', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock, paymentProvider: fake });
    });
    afterAll(async () => {
        await cleanupPermanentGrantRows();
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it('checks 401 and route 403 before reading on all four routes, without writing', async () => {
        const signer = actor(await seedGrantUser('preview-auth-signer'));
        const beneficiaryId = await seedGrantUser('preview-auth-beneficiary');
        const { grantId, body } = await createGrant(signer, beneficiaryId);
        const venue = await seedGrantPlan(VerticalEnum.VENUE);
        const cases = [
            { path: `${BASE}/preview`, method: 'POST' as const, body },
            { path: `${BASE}/${grantId}/anchors/preview`, method: 'POST' as const, body: venue },
            { path: `${BASE}/${grantId}/revocation`, method: 'GET' as const },
            { path: `${BASE}/by-beneficiary/${beneficiaryId}`, method: 'GET' as const }
        ];
        const baseline = await grantState(beneficiaryId);
        const unprivileged: Actor = {
            id: await seedGrantUser('preview-auth-unprivileged'),
            role: 'ADMIN',
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
        };
        for (const route of cases) {
            expect((await request(route.path, route.method, route.body)).status).toBe(401);
            const forbidden = await request(route.path, route.method, route.body, unprivileged);
            expect(forbidden.status).toBe(403);
            expect((await forbidden.json()).error.code).toBe('FORBIDDEN');
            expect(await grantState(beneficiaryId)).toEqual(baseline);
        }
        for (const route of [
            {
                path: `${BASE}/${crypto.randomUUID()}/anchors/preview`,
                method: 'POST' as const,
                body: venue
            },
            { path: `${BASE}/${crypto.randomUUID()}/revocation`, method: 'GET' as const },
            { path: `${BASE}/by-beneficiary/${crypto.randomUUID()}`, method: 'GET' as const }
        ]) {
            expect((await request(route.path, route.method, route.body, unprivileged)).status).toBe(
                403
            );
        }
        expect(await grantState(beneficiaryId)).toEqual(baseline);
    });

    it('keeps service subject, UUID, existence, live and uniqueness rejections in act order', async () => {
        const signer = actor(await seedGrantUser('preview-refusal-signer'));
        const beneficiaryId = await seedGrantUser('preview-refusal-beneficiary');
        const { grantId, body, anchor } = await createGrant(signer, beneficiaryId);
        const venue = await seedGrantPlan(VerticalEnum.VENUE);
        const self = actor(beneficiaryId);
        const baseline = await grantState(beneficiaryId);
        const checks = [
            [
                await request(
                    `${BASE}/preview`,
                    'POST',
                    { ...body, beneficiaryUserId: beneficiaryId },
                    self
                ),
                403,
                'ADMINISTRATIVE_ACTION_FORBIDDEN'
            ],
            [
                await request(`${BASE}/${grantId}/anchors/preview`, 'POST', venue, self),
                403,
                'ADMINISTRATIVE_ACTION_FORBIDDEN'
            ],
            [
                await request(`${BASE}/${grantId}/revocation`, 'GET', undefined, self),
                403,
                'ADMINISTRATIVE_ACTION_FORBIDDEN'
            ],
            [
                await request(
                    `${BASE}/preview`,
                    'POST',
                    { ...body, beneficiaryUserId: 'bad' },
                    signer
                ),
                400,
                undefined
            ],
            [await request(`${BASE}/bad/anchors/preview`, 'POST', venue, signer), 400, undefined],
            [await request(`${BASE}/bad/revocation`, 'GET', undefined, signer), 400, undefined],
            [await request(`${BASE}/by-beneficiary/bad`, 'GET', undefined, signer), 400, undefined],
            [
                await request(
                    `${BASE}/${crypto.randomUUID()}/anchors/preview`,
                    'POST',
                    venue,
                    signer
                ),
                404,
                'PERMANENT_GRANT_NOT_FOUND'
            ],
            [
                await request(
                    `${BASE}/${crypto.randomUUID()}/revocation`,
                    'GET',
                    undefined,
                    signer
                ),
                404,
                'PERMANENT_GRANT_NOT_FOUND'
            ],
            [
                await request(`${BASE}/${grantId}/anchors/preview`, 'POST', anchor, signer),
                409,
                'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED'
            ],
            [
                await request(`${BASE}/preview`, 'POST', body, signer),
                409,
                'PERMANENT_GRANT_ALREADY_LIVE'
            ]
        ] as const;
        for (const [response, status, reason] of checks) {
            expect(response.status).toBe(status);
            if (reason) expect((await response.json()).error.reason).toBe(reason);
            expect(await grantState(beneficiaryId)).toEqual(baseline);
        }
        const revoked = await request(
            `${BASE}/${grantId}/revocation`,
            'POST',
            { reason: 'Route preview refusal fixture' },
            signer
        );
        expect(revoked.status).toBe(200);
        const revokedBaseline = await grantState(beneficiaryId);
        for (const response of [
            await request(`${BASE}/${grantId}/anchors/preview`, 'POST', venue, signer),
            await request(`${BASE}/${grantId}/revocation`, 'GET', undefined, signer)
        ]) {
            expect(response.status).toBe(422);
            expect((await response.json()).error.reason).toBe('PERMANENT_GRANT_NOT_LIVE');
            expect(await grantState(beneficiaryId)).toEqual(revokedBaseline);
        }
    });
});
