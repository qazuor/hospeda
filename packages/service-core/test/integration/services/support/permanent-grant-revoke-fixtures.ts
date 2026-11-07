import { emailOutbox, inArray, providerLinks, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { vi } from 'vitest';
import { grantPermanentGrant } from '../../../../src/services/billing/grant/permanent-grant.service.js';
import { getServiceTestDb } from '../helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './coverage-fixtures.js';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice.js';
import { namespaceFake } from './payment-provider.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './permanent-grant-fixtures.js';
import { retireS20Rows, seedS20Addon } from './permanent-grant-s20-fixtures.js';

export const revokeNow = new Date('2026-10-14T12:00:00.000Z');

const users: string[] = [];
const principals: string[] = [];

/** Create a real grant over a seeded paid addon, optionally cancelling a paid principal. */
export async function createRevokeScenario(input: {
    readonly scopeType?: 'USER' | 'GLOBAL';
    readonly compatibleVerticals?: readonly string[];
    readonly withPrincipal?: boolean;
    readonly withAddon?: boolean;
}) {
    const db = getServiceTestDb();
    const user = await seedCoverageUser(db);
    const admin = await seedCoverageUser(db);
    const other = await seedCoverageUser(db);
    users.push(user.userId, admin.userId, other.userId);
    const vertical = VerticalEnum.ACCOMMODATION;
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => revokeNow }
    });
    let principalId: string | undefined;
    if (input.withPrincipal) {
        const plan = await seedCoveragePlanVersion(db, vertical);
        const principal = await seedCoverageSubscription(db, {
            userId: user.userId,
            vertical,
            ...plan,
            status: 'ACTIVE'
        });
        principalId = principal.subscriptionId;
        principals.push(principalId);
        const authorization = await fake.authorize({
            reference: crypto.randomUUID(),
            amount: { amountMinor: 1000000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'principal fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `principal-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        await db.insert(providerLinks).values({
            subscriptionId: principalId,
            provider: 'MERCADO_PAGO',
            providerId: authorization.authorizationId
        });
    }
    const addon =
        input.withAddon === false
            ? undefined
            : await seedS20Addon({
                  fake,
                  userId: user.userId,
                  vertical,
                  targetId: null,
                  scopeType: input.scopeType ?? 'USER',
                  compatibleVerticals: input.compatibleVerticals ?? [vertical]
              });
    const emitCoverageChanged = vi.fn(
        async (_event: {
            readonly userId: string;
            readonly vertical: string;
            readonly sourceType: string;
            readonly change: string;
        }) => undefined
    );
    const ports = {
        planPolicy: currentFloorPolicy,
        clock: { now: () => revokeNow },
        provider: namespaceFake(fake),
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
        coverageNotices: { emitCoverageChanged },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(db),
            listing: async () => {
                throw new Error('no listing addon seeded');
            }
        }
    };
    const plan = await seedGrantPlan(db, vertical);
    const grant = await grantPermanentGrant(
        {
            beneficiaryUserId: user.userId,
            actor: grantSignerActor(admin.userId),
            reason: 'grant fixture',
            includesAddons: input.withAddon !== false,
            anchors: [{ vertical, ...plan }]
        },
        ports
    );
    return {
        userId: user.userId,
        adminId: admin.userId,
        otherId: other.userId,
        vertical,
        fake,
        ports,
        grant,
        addon,
        principalId,
        emitCoverageChanged
    };
}

/** Retire only users and rows created by this fixture in the current worker. */
export async function retireRevokeScenarios(): Promise<void> {
    await retireS20Rows();
    const principalIds = principals.splice(0);
    if (principalIds.length) {
        await getServiceTestDb()
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, principalIds));
        await getServiceTestDb()
            .delete(subscriptions)
            .where(inArray(subscriptions.id, principalIds));
    }
    const ids = users.splice(0);
    if (ids.length) {
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, ids));
        await retirePermanentGrantRows(ids);
    }
}
