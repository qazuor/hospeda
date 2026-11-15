import { addonInstances, eq, permanentGrants } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';
import {
    createRevokeScenario,
    retireRevokeScenarios
} from './support/permanent-grant-revoke-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireRevokeScenarios);

async function expectForbidden(input: {
    readonly actor: Actor;
    readonly id?: string;
    readonly reason?: string;
    readonly scenario: Awaited<ReturnType<typeof createRevokeScenario>>;
}) {
    const s = input.scenario;
    if (!s.addon) throw new Error('fixture missing addon');
    s.emitCoverageChanged.mockClear();
    const authorize = vi.spyOn(s.fake, 'authorize');
    const approve = vi.spyOn(s.fake, 'approve');
    const resume = vi.spyOn(s.fake, 'resume');
    const cancel = vi.spyOn(s.fake, 'cancel');
    await expect(
        revokePermanentGrant(
            {
                permanentGrantId: input.id ?? s.grant.permanentGrantId,
                reason: input.reason ?? 'not allowed',
                actor: input.actor
            },
            s.ports
        )
    ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
    });
    const [grant] = await getServiceTestDb()
        .select({
            revokedAt: permanentGrants.revokedAt,
            revokedBy: permanentGrants.revokedBy,
            revocationReason: permanentGrants.revocationReason
        })
        .from(permanentGrants)
        .where(eq(permanentGrants.id, s.grant.permanentGrantId));
    expect(grant).toEqual({ revokedAt: null, revokedBy: null, revocationReason: null });
    const [addon] = await getServiceTestDb()
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.id, s.addon.instanceId));
    expect(addon?.status).toBe('ACTIVE');
    expect(
        s.emitCoverageChanged.mock.calls.filter(([event]) => event.userId === s.userId)
    ).toHaveLength(0);
    expect(authorize).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:9 — revoking authorizes ACC_2 inside the service (AC:B9a:9)',
    () => {
        it('a — neighbouring permissions receive 403 for existing and missing IDs', async () => {
            const s = await createRevokeScenario({});
            const actor: Actor = {
                id: s.otherId,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
            };
            await expectForbidden({ actor, scenario: s });
            await expectForbidden({ actor, id: crypto.randomUUID(), scenario: s });
        });
        it('b — the system actor is forbidden', async () => {
            const s = await createRevokeScenario({});
            const actor: Actor = {
                id: s.otherId,
                roles: [RoleEnum.SYSTEM],
                permissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
                _isSystemActor: true
            };
            await expectForbidden({ actor, scenario: s });
        });
        it('c — a beneficiary with ACC_2 cannot revoke themself', async () => {
            const s = await createRevokeScenario({});
            await expectForbidden({ actor: grantSignerActor(s.userId), scenario: s });
        });
        it('d — permission precedes even an empty reason', async () => {
            const s = await createRevokeScenario({});
            const actor: Actor = { id: s.otherId, roles: [RoleEnum.ADMIN], permissions: [] };
            await expectForbidden({ actor, reason: '', scenario: s });
        });
    }
);
