import { eq, inArray, permanentGrants, permanentGrantVerticals, users } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant
} from '../../../../src/services/billing/grant/permanent-grant.service.js';
import { revokePermanentGrant } from '../../../../src/services/billing/grant/permanent-grant-revoke.js';
import { getServiceTestDb } from '../helpers.js';
import { providerHarness } from './complement-fixtures.js';
import { addonPolicyFromTx, seedCoverageUser } from './coverage-fixtures.js';
import { retirePauseRows, seedPausePrincipal } from './pause-fixtures.js';
import { currentFloorPolicy, grantSignerActor, seedGrantPlan } from './permanent-grant-fixtures.js';

export const courtesyNow = new Date('2026-10-14T12:00:00.000Z');
const grantIds: string[] = [];
const actorIds: string[] = [];

/** Creates an isolated principal and the fake provider used by the real courtesy service. */
export async function seedCourtesyPrincipal(
    input: {
        readonly manual?: boolean;
        readonly annual?: boolean;
        readonly pauseAcknowledgesOnly?: boolean;
        readonly userId?: string;
    } = {}
) {
    const harness = providerHarness({ pauseAcknowledgesOnly: input.pauseAcknowledgesOnly });
    const principal = await seedPausePrincipal({
        harness,
        cycle: input.annual ? 'annual' : 'monthly',
        paymentMethod: input.manual ? 'MANUAL' : 'CARD',
        userId: input.userId
    });
    const calls: string[] = [];
    const provider = new Proxy(harness.provider, {
        get(target, property, receiver) {
            if (property === 'pause')
                return async (input: { readonly authorizationId: string }) => {
                    calls.push(`pause:${input.authorizationId}`);
                    return target.pause(input);
                };
            if (property === 'readAuthorization')
                return async (input: { readonly authorizationId: string }) => {
                    calls.push(`read:${input.authorizationId}`);
                    return target.readAuthorization(input);
                };
            const method = Reflect.get(target, property, receiver);
            return typeof method === 'function' ? method.bind(target) : method;
        }
    });
    return {
        ...principal,
        harness: { ...harness, calls },
        ports: {
            provider,
            clock: { now: () => courtesyNow },
            coverageNotices: { emitCoverageChanged: async () => undefined }
        }
    };
}

/** Creates a real permanent grant before the test creates its active principal. */
export async function createPermanentAnchor(
    input: { readonly vertical?: 'accommodation' | 'venue'; readonly revoked?: boolean } = {}
) {
    const db = getServiceTestDb();
    const { userId } = await seedCoverageUser(db);
    const { userId: actorId } = await seedCoverageUser(db);
    actorIds.push(actorId);
    const vertical = input.vertical ?? 'accommodation';
    const plan = await seedGrantPlan(db, vertical);
    const initialPlan = await seedGrantPlan(db, 'tourist');
    const clock = { now: () => courtesyNow };
    const ports = {
        planPolicy: currentFloorPolicy,
        clock,
        provider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(db),
            listing: async () => {
                throw new Error('No listing addon seeded');
            }
        }
    };
    const actor = grantSignerActor(actorId);
    const grant = await grantPermanentGrant(
        {
            beneficiaryUserId: userId,
            actor,
            reason: 'courtesy test anchor',
            includesAddons: false,
            anchors: [{ vertical: 'tourist', ...initialPlan }]
        },
        ports
    );
    grantIds.push(grant.permanentGrantId);
    await anchorPermanentGrantVertical(
        {
            permanentGrantId: grant.permanentGrantId,
            actor,
            vertical,
            ...plan
        },
        ports
    );
    if (input.revoked)
        await revokePermanentGrant(
            {
                permanentGrantId: grant.permanentGrantId,
                actor,
                reason: 'courtesy test revoked anchor'
            },
            ports
        );
    return { userId, actorId, grantId: grant.permanentGrantId };
}

/** Removes rows created by courtesy fixtures without changing other test populations. */
export async function retireCourtesyFixtures(): Promise<void> {
    await retirePauseRows();
    const ids = grantIds.splice(0);
    if (ids.length) {
        await getServiceTestDb()
            .delete(permanentGrantVerticals)
            .where(inArray(permanentGrantVerticals.permanentGrantId, ids));
        await getServiceTestDb().delete(permanentGrants).where(inArray(permanentGrants.id, ids));
    }
    const admins = actorIds.splice(0);
    for (const actorId of admins)
        await getServiceTestDb().delete(users).where(eq(users.id, actorId));
}
