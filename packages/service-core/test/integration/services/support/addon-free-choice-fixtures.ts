import { addonInstances, eq } from '@repo/db';
import { grantPermanentGrant } from '../../../../src/services/billing/grant/permanent-grant.service';
import { revokePermanentGrant } from '../../../../src/services/billing/grant/permanent-grant-revoke';
import { getServiceTestDb } from '../helpers';
import { purchaseFixture, retirePurchaseFixtures } from './addon-purchase-fixtures';
import { seedCoverageUser } from './coverage-fixtures';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './permanent-grant-fixtures';

const users: string[] = [];

/** Creates a real permanent grant and a seeded addon product for A1-bis tests. */
export async function freeChoiceFixture(
    input: {
        readonly scopeType?: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
        readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO';
        readonly verticals?: readonly string[];
        readonly includesAddons?: boolean;
    } = {}
) {
    const f = await purchaseFixture({
        scopeType: input.scopeType,
        chargeKind: input.chargeKind,
        verticals: input.verticals
    });
    const db = getServiceTestDb();
    const admin = await seedCoverageUser(db);
    users.push(f.ownerId, admin.userId);
    const notices: { userId: string; vertical: string; sourceType: string; change: string }[] = [];
    const grantPorts = {
        planPolicy: currentFloorPolicy,
        clock: f.ports.clock,
        provider: f.fake,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: {
            emitCoverageChanged: async (notice: (typeof notices)[number]) => {
                notices.push(notice);
            }
        },
        orphanhood: { addonPolicy: f.ports.addonPolicy, listing: f.ports.listing }
    };
    const plan = await seedGrantPlan(db, 'accommodation');
    const grant = await grantPermanentGrant(
        {
            beneficiaryUserId: f.ownerId,
            actor: grantSignerActor(admin.userId),
            reason: 'Free addon choice integration test',
            includesAddons: input.includesAddons ?? true,
            anchors: [{ vertical: 'accommodation', ...plan }]
        },
        grantPorts
    );
    f.anchor('accommodation');
    return {
        ...f,
        grant,
        notices,
        freePorts: {
            clock: f.ports.clock,
            addonPolicy: f.ports.addonPolicy,
            listing: f.ports.listing,
            coverageNotices: grantPorts.coverageNotices
        },
        freeInput: (orderRequestId = crypto.randomUUID(), targetId: string | null = null) => ({
            ownerId: f.ownerId,
            productId: f.productId,
            targetId,
            orderRequestId,
            expectedAddonVersionId: f.versionId
        }),
        revoke: () =>
            revokePermanentGrant(
                {
                    permanentGrantId: grant.permanentGrantId,
                    reason: 'test revocation',
                    actor: grantSignerActor(admin.userId)
                },
                grantPorts
            ),
        instances: () =>
            db.select().from(addonInstances).where(eq(addonInstances.ownerId, f.ownerId))
    };
}

/** Removes only test-owned live rows and users after each test. */
export async function retireFreeChoiceFixtures(): Promise<void> {
    await retirePurchaseFixtures();
    await retirePermanentGrantRows(users.splice(0));
}
