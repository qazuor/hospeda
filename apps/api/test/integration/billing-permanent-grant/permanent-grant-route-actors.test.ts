import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import * as routePorts from '../../../src/routes/billing-permanent-grant/admin/ports';
import { AuditEventType } from '../../../src/utils/audit-logger';
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
    principalStatus,
    seedGrant,
    seedGrantPlan,
    seedGrantUser
} from './grant-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_GRANT_COMPLIMENTARY
] as const;
const NEIGHBOUR_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_SETTLE_EXTERNAL,
    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
    PermissionEnum.USER_UPDATE_ROLES,
    PermissionEnum.PARTNER_MANAGE,
    PermissionEnum.TRIAL_EXTEND
] as const;
const clock = routeClock();
const fake = routeFake(clock);
const providerSpy = spyingProvider(fake);
let app: ReturnType<typeof initApp>;

type RouteCase = {
    name: 'grant' | 'anchor';
    path: string;
    body: Record<string, unknown>;
    beneficiaryId: string;
};
type Actor = { id: string; role: string; permissions: readonly PermissionEnum[] };

function post(route: RouteCase, body = route.body, actor?: Actor) {
    return app.request(route.path, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

async function routeCase(name: 'grant' | 'anchor', actorId?: string): Promise<RouteCase> {
    const beneficiaryId = actorId ?? (await seedGrantUser(`beneficiary-${name}`));
    const accommodation = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
    if (name === 'grant')
        return {
            name,
            path: '/api/v1/admin/billing-permanent-grants',
            body: {
                beneficiaryUserId: beneficiaryId,
                reason: 'B9a route test',
                includesAddons: false,
                anchors: [accommodation]
            },
            beneficiaryId
        };
    const signer = await seedGrantUser('signer');
    const grant = await seedGrant({
        beneficiaryUserId: beneficiaryId,
        grantedBy: signer,
        anchor: accommodation
    });
    const gastronomy = await seedGrantPlan(VerticalEnum.GASTRONOMY);
    return {
        name,
        path: `/api/v1/admin/billing-permanent-grants/${grant.grantId}/anchors`,
        body: gastronomy,
        beneficiaryId
    };
}

describe('TEST:B9a:9 admin action 2 routes refuse every foreign actor (AC:B9a:9)', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock, paymentProvider: providerSpy.provider });
    });
    beforeEach(() => audit.mockClear());
    afterAll(async () => {
        await cleanupPermanentGrantRows();
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it.each([
        'grant',
        'anchor'
    ] as const)('%s route refuses every foreign actor before writes', async (name) => {
        const principal = await seedCardRevocable({ fake, clock });
        providerSpy.calls.length = 0;
        const route = await routeCase(name, principal.ownerId);
        const baseline = await grantState(route.beneficiaryId);
        const callCount = providerSpy.calls.length;
        const portSpy = vi.spyOn(routePorts, 'buildPermanentGrantPorts');

        const noSession = await post(route);
        expect(noSession.status).toBe(401);
        expect(await grantState(route.beneficiaryId)).toEqual(baseline);

        const unprivileged = {
            id: await seedGrantUser('without-permission'),
            role: 'ADMIN',
            permissions: NEIGHBOUR_PERMISSIONS
        } satisfies Actor;
        const forbidden = await post(route, route.body, unprivileged);
        expect(forbidden.status).toBe(403);
        expect((await forbidden.json()).error.code).toBe('FORBIDDEN');
        expect(portSpy).not.toHaveBeenCalled();
        expect(await grantState(route.beneficiaryId)).toEqual(baseline);
        expect(await principalStatus(principal.subscriptionId)).toBe('ACTIVE');
        expect(providerSpy.calls).toHaveLength(callCount);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );

        const host = await post(route, route.body, {
            id: await seedGrantUser('host'),
            role: 'HOST',
            permissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
        });
        expect(host.status).toBe(403);
        expect(await grantState(route.beneficiaryId)).toEqual(baseline);
        expect(await principalStatus(principal.subscriptionId)).toBe('ACTIVE');
        expect(providerSpy.calls).toHaveLength(callCount);

        const self = await post(route, route.body, {
            id: route.beneficiaryId,
            role: 'SUPER_ADMIN',
            permissions: PERMISSIONS
        });
        expect(self.status).toBe(403);
        expect((await self.json()).error).toMatchObject({
            code: 'FORBIDDEN',
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect(await grantState(route.beneficiaryId)).toEqual(baseline);
        expect(await principalStatus(principal.subscriptionId)).toBe('ACTIVE');
        expect(providerSpy.calls).toHaveLength(callCount);

        const malformedBodies =
            name === 'grant'
                ? [
                      { ...route.body, anchors: [] },
                      { ...route.body, beneficiaryUserId: 'bad' },
                      { ...route.body, grantedBy: await seedGrantUser('foreign-signer') }
                  ]
                : [
                      { ...route.body, planId: 'bad' },
                      { ...route.body, grantedBy: await seedGrantUser('foreign-signer') }
                  ];
        for (const body of malformedBodies) {
            const invalid = await post(route, body, {
                id: await seedGrantUser('permitted-malformed'),
                role: 'SUPER_ADMIN',
                permissions: PERMISSIONS
            });
            expect(invalid.status).toBe(400);
            expect((await invalid.json()).error.code).toBe('VALIDATION_ERROR');
        }
        expect(await grantState(route.beneficiaryId)).toEqual(baseline);
        expect(portSpy).toHaveBeenCalledTimes(1); // only self reaches the service/port builder
        portSpy.mockRestore();
    });
});
