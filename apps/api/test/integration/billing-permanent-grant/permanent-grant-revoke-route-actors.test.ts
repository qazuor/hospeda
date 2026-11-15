import { addonInstances, eq, getDb } from '@repo/db';
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
    spyingProvider
} from '../billing-subscription/revocation-route-fixtures';
import {
    cleanupPermanentGrantRows,
    grantState,
    retireGrantRevokeAddons,
    seedGrantPlan,
    seedGrantRevokeAddon,
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
    PermissionEnum.USER_UPDATE_ROLES,
    PermissionEnum.PARTNER_MANAGE
] as const;
const clock = routeClock();
const fake = routeFake(clock);
const providerSpy = spyingProvider(fake);
let app: ReturnType<typeof initApp>;

type Actor = { id: string; role: string; permissions: readonly PermissionEnum[] };

function post(path: string, body: Record<string, unknown>, actor?: Actor) {
    return app.request(path, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

function makeActor(id: string): Actor {
    return { id, role: 'SUPER_ADMIN', permissions: PERMISSIONS };
}

async function liveGrant() {
    const actorId = await seedGrantUser('revoke-actors-admin');
    const beneficiaryId = await seedGrantUser('revoke-actors-beneficiary');
    const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
    const addon = await seedGrantRevokeAddon({
        fake,
        userId: beneficiaryId,
        vertical: VerticalEnum.ACCOMMODATION,
        compatibleVerticals: [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE]
    });
    const response = await post(
        '/api/v1/admin/billing-permanent-grants',
        {
            beneficiaryUserId: beneficiaryId,
            reason: 'B9a.6 revoke actor grant',
            includesAddons: true,
            anchors: [anchor]
        },
        makeActor(actorId)
    );
    expect(response.status).toBe(201);
    const envelope = await response.json();
    return {
        actorId,
        beneficiaryId,
        grantId: envelope.data.permanentGrantId as string,
        instanceId: addon.instanceId
    };
}

async function instanceStatus(instanceId: string): Promise<string | undefined> {
    const [row] = await getDb()
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    return row?.status;
}

describe('TEST:B9a:9 — only SUPER_ADMIN revokes, through the route (AC:B9a:9)', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock, paymentProvider: providerSpy.provider });
    });
    beforeEach(() => audit.mockClear());
    afterAll(async () => {
        await retireGrantRevokeAddons();
        await cleanupPermanentGrantRows();
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it('refuses every foreign actor before writing, and a missing id is never 404 without the route permission', async () => {
        const grant = await liveGrant();
        const path = `/api/v1/admin/billing-permanent-grants/${grant.grantId}/revocation`;
        const body = { reason: 'Should not be written' };
        audit.mockClear();
        const baseline = await grantState(grant.beneficiaryId);
        const baselineCalls = providerSpy.calls.length;
        const portSpy = vi.spyOn(routePorts, 'buildPermanentGrantPorts');

        const noSession = await post(path, body);
        expect(noSession.status).toBe(401);
        expect(await grantState(grant.beneficiaryId)).toEqual(baseline);
        expect(await instanceStatus(grant.instanceId)).toBe('ACTIVE');
        expect(providerSpy.calls).toHaveLength(baselineCalls);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );

        const unprivileged = {
            id: await seedGrantUser('revoke-without-permission'),
            role: 'ADMIN',
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
        } satisfies Actor;
        const forbidden = await post(path, body, unprivileged);
        expect(forbidden.status).toBe(403);
        expect((await forbidden.json()).error.code).toBe('FORBIDDEN');
        expect(portSpy).not.toHaveBeenCalled();
        expect(await grantState(grant.beneficiaryId)).toEqual(baseline);
        expect(await instanceStatus(grant.instanceId)).toBe('ACTIVE');
        expect(providerSpy.calls).toHaveLength(baselineCalls);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );

        const neighbour = await post(path, body, {
            id: await seedGrantUser('revoke-neighbour-permission'),
            role: 'ADMIN',
            permissions: NEIGHBOUR_PERMISSIONS
        } satisfies Actor);
        expect(neighbour.status).toBe(403);
        expect((await neighbour.json()).error.code).toBe('FORBIDDEN');
        expect(await grantState(grant.beneficiaryId)).toEqual(baseline);
        expect(await instanceStatus(grant.instanceId)).toBe('ACTIVE');
        expect(providerSpy.calls).toHaveLength(baselineCalls);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );

        const missing = await post(
            `/api/v1/admin/billing-permanent-grants/${crypto.randomUUID()}/revocation`,
            body,
            {
                id: await seedGrantUser('revoke-neighbour-missing'),
                role: 'ADMIN',
                permissions: NEIGHBOUR_PERMISSIONS
            } satisfies Actor
        );
        expect(missing.status).toBe(403);
        expect((await missing.json()).error.code).toBe('FORBIDDEN');
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );

        const self = await post(path, body, {
            id: grant.beneficiaryId,
            role: 'SUPER_ADMIN',
            permissions: PERMISSIONS
        });
        expect(self.status).toBe(403);
        expect((await self.json()).error).toMatchObject({
            code: 'FORBIDDEN',
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect(await grantState(grant.beneficiaryId)).toEqual(baseline);
        expect(await instanceStatus(grant.instanceId)).toBe('ACTIVE');
        expect(providerSpy.calls).toHaveLength(baselineCalls);
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );
        expect(portSpy).toHaveBeenCalledTimes(1); // only the beneficiary reaches the service
        portSpy.mockRestore();
    });
});
