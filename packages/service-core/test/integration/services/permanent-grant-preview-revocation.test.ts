import { addonInstances, eq, permanentGrants, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { applyA5 } from '../../../src/services/billing/addon/addon-instance-a5.js';
import { previewPermanentGrantRevocation } from '../../../src/services/billing/grant/permanent-grant-preview.js';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import { runS20InTransaction } from '../../../src/services/billing/grant/permanent-grant-s20.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';
import {
    createRevokeScenario,
    retireRevokeScenarios,
    revokeNow
} from './support/permanent-grant-revoke-fixtures.js';
import { retireS20Rows, seedS20Addon } from './support/permanent-grant-s20-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(async () => {
    await retireRevokeScenarios();
    await retireS20Rows();
});
const db = getServiceTestDb;

describe.skipIf(!isServiceTestDbAvailable())('AC:B13a:6 (support) — revocation preview', () => {
    it('lists only the live titled addons and the vertical losing service; revocation matches', async () => {
        const s = await createRevokeScenario({ withPrincipal: true });
        if (!s.addon) throw new Error('fixture addon missing');
        const extra = await seedS20Addon({
            fake: s.fake,
            userId: s.userId,
            vertical: s.vertical,
            targetId: null,
            scopeType: 'USER'
        });
        await db().transaction(async (tx) => {
            await runS20InTransaction(
                {
                    tx,
                    includesAddons: true,
                    permanentGrantId: s.grant.permanentGrantId,
                    beneficiaryUserId: s.userId,
                    anchors: [{ id: s.grant.anchorIds[0]!, vertical: s.vertical }],
                    now: revokeNow,
                    actorId: s.adminId
                },
                { orphanhood: s.ports.orphanhood }
            );
            await applyA5(
                {
                    tx,
                    instanceId: extra.instanceId,
                    clause: 'GRANT_REVOKED',
                    now: revokeNow,
                    s21Cause: 'GRANT_REVOKED'
                },
                s.ports.orphanhood
            );
        });
        const preview = await previewPermanentGrantRevocation({
            permanentGrantId: s.grant.permanentGrantId,
            actor: grantSignerActor(s.adminId)
        });
        expect(preview).toMatchObject({
            permanentGrantId: s.grant.permanentGrantId,
            verticalsLosingService: [s.vertical],
            trialReturns: false,
            oldDebitResumes: false
        });
        expect(preview.addonsTurnedOff).toEqual([
            {
                addonInstanceId: s.addon.instanceId,
                addonName: expect.any(String)
            }
        ]);
        const [grantBefore] = await db()
            .select({ revokedAt: permanentGrants.revokedAt })
            .from(permanentGrants)
            .where(eq(permanentGrants.id, s.grant.permanentGrantId));
        expect(grantBefore?.revokedAt).toBeNull();
        const [live] = await db()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, s.addon.instanceId));
        expect(live?.status).toBe('ACTIVE');
        const [dead] = await db()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, extra.instanceId));
        expect(dead?.status).toBe('CANCELLED');
        const act = await revokePermanentGrant(
            {
                permanentGrantId: s.grant.permanentGrantId,
                reason: 'admin confirmation reason',
                actor: grantSignerActor(s.adminId)
            },
            s.ports
        );
        expect(act.cancelledAddonInstanceIds).toEqual(
            preview.addonsTurnedOff.map(({ addonInstanceId }) => addonInstanceId)
        );
        const [complement] = await db()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, s.addon.complementId));
        expect(complement?.status).toBe('CANCELLED');
    });

    it('shows an explicit empty addon list when the grant contains none', async () => {
        const s = await createRevokeScenario({ withAddon: false });
        const preview = await previewPermanentGrantRevocation({
            permanentGrantId: s.grant.permanentGrantId,
            actor: grantSignerActor(s.adminId)
        });
        expect(preview.addonsTurnedOff).toEqual([]);
        expect(preview.verticalsLosingService).toEqual([s.vertical]);
        const [grant] = await db()
            .select({ revokedAt: permanentGrants.revokedAt })
            .from(permanentGrants)
            .where(eq(permanentGrants.id, s.grant.permanentGrantId));
        expect(grant?.revokedAt).toBeNull();
    });

    it('keeps the act rejection order for permission, subject, missing and revoked grants', async () => {
        const s = await createRevokeScenario({ withAddon: false });
        await expect(
            previewPermanentGrantRevocation({
                actor: grantSignerActor(s.adminId, []),
                permanentGrantId: crypto.randomUUID()
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        await expect(
            previewPermanentGrantRevocation({
                actor: grantSignerActor(s.userId),
                permanentGrantId: s.grant.permanentGrantId
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        await expect(
            previewPermanentGrantRevocation({
                actor: grantSignerActor(s.adminId),
                permanentGrantId: crypto.randomUUID()
            })
        ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_FOUND' });
        await revokePermanentGrant(
            {
                permanentGrantId: s.grant.permanentGrantId,
                reason: 'end',
                actor: grantSignerActor(s.adminId)
            },
            s.ports
        );
        await expect(
            previewPermanentGrantRevocation({
                actor: grantSignerActor(s.adminId),
                permanentGrantId: s.grant.permanentGrantId
            })
        ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_LIVE' });
    });
});
