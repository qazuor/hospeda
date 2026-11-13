/** TEST:B5:13 AC:B5:26 — the real grant act reaches A5's third clause in every scope. */
import { addonInstances, addonProducts, eq, subscriptions } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { isAddonInstanceOrphaned } from '../../../src/services/billing/addon/addon-orphanhood.js';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';
import {
    createScopeRevokeScenario,
    retireScopeRevokeScenarios
} from './support/permanent-grant-revoke-scope-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireScopeRevokeScenarios);

const scopes = ['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL'] as const;

async function instance(instanceId: string) {
    const [row] = await getServiceTestDb()
        .select({
            id: addonInstances.id,
            ownerId: addonInstances.ownerId,
            targetId: addonInstances.targetId,
            status: addonInstances.status,
            titleAnchorId: addonInstances.titleAnchorId,
            compatibleVerticals: addonProducts.compatibleVerticals
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .where(eq(addonInstances.id, instanceId));
    if (!row) throw new Error(`addon ${instanceId} missing`);
    return row;
}

async function status(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row?.status;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B5:13 AC:B5:26 — revoking a grant turns off the addon its anchor titled, in every scope',
    () => {
        it.each(scopes)('%s: the titled addon is cancelled by revocation', async (scopeType) => {
            const s = await createScopeRevokeScenario({
                scopeType,
                withPayingPrincipalIn:
                    scopeType === 'USER' || scopeType === 'GLOBAL' ? VerticalEnum.VENUE : undefined
            });
            const before = await instance(s.addon.instanceId);
            expect(before).toMatchObject({
                status: 'ACTIVE',
                titleAnchorId: s.grant.anchorIds[0]
            });
            expect(await status(s.addon.complementId)).toBe('CANCELLED');
            if (scopeType === 'VERTICAL_SUBSCRIPTION') {
                expect(s.targetPrincipalId).toBeDefined();
                expect(await status(s.targetPrincipalId!)).toBe('CANCELLED');
                expect(before.status).toBe('ACTIVE');
            }
            if (scopeType === 'USER' || scopeType === 'GLOBAL') {
                expect(s.payingPrincipalId).toBeDefined();
                expect(await status(s.payingPrincipalId!)).toBe('ACTIVE');
                expect(
                    await isAddonInstanceOrphaned(
                        { tx: getServiceTestDb(), instance: before, scopeType },
                        {
                            ...s.ports.orphanhood,
                            liveAnchors: { hasLiveAnchor: async () => false }
                        }
                    )
                ).toBe(false);
            }
            const cancelsAtGrant = s.cancel.mock.calls.filter(
                ([call]) => call.authorizationId === s.addon.authorizationId
            );
            expect(cancelsAtGrant).toHaveLength(1);
            const authorize = vi.spyOn(s.fake, 'authorize');
            const resume = vi.spyOn(s.fake, 'resume');
            const result = await revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: 'scope revocation',
                    actor: grantSignerActor(s.signerId)
                },
                s.ports
            );
            expect(result.cancelledAddonInstanceIds).toEqual([s.addon.instanceId]);
            expect(result.addonProviderCalls).toEqual([]);
            expect((await instance(s.addon.instanceId)).status).toBe('CANCELLED');
            const addonNotices = s.emitCoverageChanged.mock.calls
                .map(([event]) => event)
                .filter((event) => event.userId === s.userId && event.sourceType === 'ADDON');
            expect(addonNotices.map(({ vertical }) => vertical).sort()).toEqual(
                (scopeType === 'USER' || scopeType === 'GLOBAL'
                    ? [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE]
                    : [VerticalEnum.ACCOMMODATION]
                ).sort()
            );
            expect(addonNotices.every((event) => event.change === 'REMOVED')).toBe(true);
            if (scopeType === 'LISTING') {
                expect(s.targetId).toBeDefined();
                expect(await s.listing({ listingId: s.targetId! })).toEqual({
                    vertical: VerticalEnum.ACCOMMODATION,
                    ownerId: s.userId,
                    acceptsFeature: true
                });
            }
            if (s.payingPrincipalId) expect(await status(s.payingPrincipalId)).toBe('ACTIVE');
            expect(
                s.cancel.mock.calls.filter(
                    ([call]) => call.authorizationId === s.addon.authorizationId
                )
            ).toHaveLength(1);
            expect(authorize.mock.calls).toEqual([]);
            expect(resume.mock.calls).toEqual([]);
        });

        it('USER: an incompatible untitled addon keeps charging after revocation', async () => {
            const s = await createScopeRevokeScenario({
                scopeType: 'USER',
                withUntitledAddon: true
            });
            if (!s.untitledAddon) throw new Error('untitled fixture missing');
            expect(await instance(s.addon.instanceId)).toMatchObject({
                status: 'ACTIVE',
                titleAnchorId: s.grant.anchorIds[0]
            });
            expect(await status(s.addon.complementId)).toBe('CANCELLED');
            expect(await instance(s.untitledAddon.instanceId)).toMatchObject({
                status: 'ACTIVE',
                titleAnchorId: null
            });
            expect(await status(s.untitledAddon.complementId)).toBe('ACTIVE');
            const result = await revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: 'scope revocation',
                    actor: grantSignerActor(s.signerId)
                },
                s.ports
            );
            expect(result.cancelledAddonInstanceIds).toEqual([s.addon.instanceId]);
            expect((await instance(s.addon.instanceId)).status).toBe('CANCELLED');
            expect(await instance(s.untitledAddon.instanceId)).toMatchObject({
                status: 'ACTIVE',
                titleAnchorId: null
            });
            expect(await status(s.untitledAddon.complementId)).toBe('ACTIVE');
        });
    }
);
