import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { readLivePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-preview.js';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';
import {
    createRevokeScenario,
    retireRevokeScenarios
} from './support/permanent-grant-revoke-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireRevokeScenarios);

describe.skipIf(!isServiceTestDbAvailable())('AC:B13a:6 (support) — live grant read', () => {
    it('returns null without a grant and the anchors of an existing live grant', async () => {
        const s = await createRevokeScenario({ withAddon: false });
        const actor = grantSignerActor(s.adminId);
        const absent = await readLivePermanentGrant({ actor, beneficiaryUserId: s.otherId });
        expect(absent).toEqual({ grant: null });
        const live = await readLivePermanentGrant({ actor, beneficiaryUserId: s.userId });
        expect(live.grant).toMatchObject({
            permanentGrantId: s.grant.permanentGrantId,
            includesAddons: false,
            createdAt: expect.any(Date),
            anchors: [
                {
                    vertical: s.vertical,
                    planId: expect.any(String),
                    floorPlanVersionId: expect.any(String)
                }
            ]
        });
        await revokePermanentGrant(
            { permanentGrantId: s.grant.permanentGrantId, reason: 'finished', actor },
            s.ports
        );
        expect(await readLivePermanentGrant({ actor, beneficiaryUserId: s.userId })).toEqual({
            grant: null
        });
    });

    it('checks ACC_2 before reading the beneficiary', async () => {
        const s = await createRevokeScenario({ withAddon: false });
        await expect(
            readLivePermanentGrant({
                actor: grantSignerActor(s.adminId, []),
                beneficiaryUserId: s.userId
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
    });
});
