import { addonInstances, eq, permanentGrantVerticals, subscriptions } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveAddonSources } from '../../../src/services/billing/coverage/addon-sources.js';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';
import {
    createRevokeScenario,
    retireRevokeScenarios
} from './support/permanent-grant-revoke-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireRevokeScenarios);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:6 — the USER/GLOBAL leak stays and turns off with the grant (AC:B9a:6)',
    () => {
        it.each([
            'USER',
            'GLOBAL'
        ] as const)('%s stays free in two verticals, then disappears in both', async (scopeType) => {
            const otherVertical = VerticalEnum.VENUE;
            const s = await createRevokeScenario({
                scopeType,
                compatibleVerticals: [VerticalEnum.ACCOMMODATION, otherVertical]
            });
            if (!s.addon) throw new Error('fixture missing addon');
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, s.addon.instanceId));
            const [complement] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, s.addon.complementId));
            expect(instance).toMatchObject({
                status: 'ACTIVE',
                titleAnchorId: s.grant.anchorIds[0]
            });
            expect(complement?.status).toBe('CANCELLED');
            const anchors = await getServiceTestDb()
                .select({ vertical: permanentGrantVerticals.vertical })
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.permanentGrantId, s.grant.permanentGrantId));
            expect(anchors.map(({ vertical }) => vertical)).toEqual([s.vertical]);
            const sourcePorts = {
                clock: s.ports.clock,
                addonPolicy: s.ports.orphanhood.addonPolicy,
                listing: s.ports.orphanhood.listing
            };
            for (const vertical of [s.vertical, otherVertical]) {
                const { sources } = await resolveAddonSources({
                    userId: s.userId,
                    vertical,
                    ports: sourcePorts
                });
                expect(sources).toHaveLength(1);
                expect(sources[0]).toMatchObject({
                    type: 'ADDON',
                    scope: scopeType,
                    charged: null
                });
            }
            s.emitCoverageChanged.mockClear();
            const revoked = await revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: 'stop leak with grant',
                    actor: grantSignerActor(s.otherId)
                },
                s.ports
            );
            expect(revoked.cancelledAddonInstanceIds).toEqual([s.addon.instanceId]);
            const [after] = await getServiceTestDb()
                .select({ status: addonInstances.status })
                .from(addonInstances)
                .where(eq(addonInstances.id, s.addon.instanceId));
            expect(after?.status).toBe('CANCELLED');
            for (const vertical of [s.vertical, otherVertical]) {
                const { sources } = await resolveAddonSources({
                    userId: s.userId,
                    vertical,
                    ports: sourcePorts
                });
                expect(sources).toEqual([]);
            }
            const removed = s.emitCoverageChanged.mock.calls
                .map(([event]) => event)
                .filter(
                    (event) =>
                        event.userId === s.userId &&
                        event.sourceType === 'ADDON' &&
                        event.change === 'REMOVED'
                )
                .map((event) => event.vertical)
                .sort();
            expect(removed).toEqual([s.vertical, otherVertical].sort());
        });
    }
);
