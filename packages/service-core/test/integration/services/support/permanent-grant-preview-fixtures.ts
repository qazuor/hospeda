import {
    courtesyGrants,
    eq,
    inArray,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { getServiceTestDb } from '../helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './coverage-fixtures.js';
import { namespaceFake } from './payment-provider.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './permanent-grant-fixtures.js';
import { retireS20Rows } from './permanent-grant-s20-fixtures.js';

export const previewNow = new Date('2026-10-14T12:00:00.000Z');
export const previewVertical = VerticalEnum.ACCOMMODATION;
export const otherPreviewVertical = VerticalEnum.VENUE;
const users: string[] = [];
const principals: string[] = [];

/** A beneficiary, signer and real act ports for grant preview integration. */
export async function createPreviewScenario() {
    const db = getServiceTestDb();
    const beneficiary = await seedCoverageUser(db);
    const signer = await seedCoverageUser(db);
    users.push(beneficiary.userId, signer.userId);
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => previewNow }
    });
    const ports = {
        planPolicy: currentFloorPolicy,
        clock: { now: () => previewNow },
        provider: namespaceFake(fake),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(db),
            listing: async () => {
                throw new Error('no listing addon in preview fixture');
            }
        }
    };
    const plan = await seedGrantPlan(db, previewVertical);
    const otherPlan = await seedGrantPlan(db, otherPreviewVertical);
    return {
        userId: beneficiary.userId,
        adminId: signer.userId,
        actor: grantSignerActor(signer.userId),
        fake,
        ports,
        plan,
        otherPlan
    };
}

/** Seed a principal with a live authorization when card funded. */
export async function seedPreviewPrincipal(input: {
    readonly userId: string;
    readonly fake: FakePaymentProvider;
    readonly vertical?: string;
    readonly status?: 'ACTIVE' | 'PAUSED';
    readonly paymentMethod?: 'CARD' | 'MANUAL';
}): Promise<{ readonly subscriptionId: string; readonly authorizationId: string | null }> {
    const db = getServiceTestDb();
    const vertical = input.vertical ?? previewVertical;
    const plan = await seedCoveragePlanVersion(db, vertical);
    const { subscriptionId } = await seedCoverageSubscription(db, {
        userId: input.userId,
        vertical,
        ...plan,
        status: input.status ?? 'ACTIVE'
    });
    principals.push(subscriptionId);
    if (input.paymentMethod === 'MANUAL') {
        await db
            .update(subscriptions)
            .set({ paymentMethod: 'MANUAL' })
            .where(eq(subscriptions.id, subscriptionId));
        return { subscriptionId, authorizationId: null };
    }
    const authorization = await input.fake.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 1000000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'preview principal',
        returnUrl: 'https://example.test/return',
        payerEmail: `preview-${crypto.randomUUID()}@example.test`
    });
    await input.fake.approve({ authorizationId: authorization.authorizationId });
    await db.insert(providerLinks).values({
        subscriptionId,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    return { subscriptionId, authorizationId: authorization.authorizationId };
}

/** Replicate S9's persisted courtesy order when no reachable succession exists in this fixture. */
export async function seedPreviewCourtesy(input: {
    readonly userId: string;
    readonly adminId: string;
    readonly subscriptionId: string;
    readonly fake: FakePaymentProvider;
    readonly authorizationId: string | null;
    readonly reason?: 'COURTESY' | 'CUSTOMER_REQUEST';
}): Promise<{ readonly courtesyGrantId: string | null; readonly endsAt: Date }> {
    const db = getServiceTestDb();
    const startsAt = new Date(previewNow.getTime() - 86_400_000);
    const endsAt = new Date(previewNow.getTime() + 86_400_000);
    if (input.authorizationId) await input.fake.pause({ authorizationId: input.authorizationId });
    // A customer-request pause may coexist with a historical, already-ended courtesy row.
    const [courtesy] = await db
        .insert(courtesyGrants)
        .values({
            beneficiaryUserId: input.userId,
            grantedBy: input.adminId,
            subscriptionId: input.subscriptionId,
            months: 1,
            startsAt:
                input.reason === 'CUSTOMER_REQUEST'
                    ? new Date(startsAt.getTime() - 86_400_000)
                    : startsAt,
            endsAt: input.reason === 'CUSTOMER_REQUEST' ? startsAt : endsAt,
            reason: 'preview courtesy'
        })
        .returning({ id: courtesyGrants.id });
    const courtesyGrantId = courtesy?.id ?? null;
    await db
        .update(subscriptions)
        .set({ status: 'PAUSED' })
        .where(eq(subscriptions.id, input.subscriptionId));
    await db.insert(subscriptionPauses).values({
        subscriptionId: input.subscriptionId,
        reason: input.reason ?? 'COURTESY',
        startsAt,
        expectedEndAt: endsAt
    });
    return { courtesyGrantId, endsAt };
}

/** The spec explicitly permits seeding an open deferred balance. */
export async function seedPreviewDeferred(input: {
    readonly userId: string;
    readonly adminId: string;
    readonly vertical: string;
    readonly balanceMonths: number;
}): Promise<string> {
    const db = getServiceTestDb();
    const plan = await seedCoveragePlanVersion(db, input.vertical);
    const { subscriptionId } = await seedCoverageSubscription(db, {
        userId: input.userId,
        vertical: input.vertical,
        ...plan,
        status: 'CANCELLED'
    });
    principals.push(subscriptionId);
    const [courtesy] = await db
        .insert(courtesyGrants)
        .values({
            beneficiaryUserId: input.userId,
            grantedBy: input.adminId,
            subscriptionId,
            months: input.balanceMonths,
            startsAt: new Date(previewNow.getTime() - 86_400_000),
            endsAt: new Date(previewNow.getTime() + 86_400_000),
            reason: 'deferred preview',
            balanceMonths: input.balanceMonths
        })
        .returning({ id: courtesyGrants.id });
    if (!courtesy) throw new Error('deferred courtesy fixture missing');
    return courtesy.id;
}

/** Remove only this file's committed fixture rows. */
export async function retirePreviewScenarios(): Promise<void> {
    await retireS20Rows();
    const ids = users.splice(0);
    await retirePermanentGrantRows(ids);
    const subscriptionIds = principals.splice(0);
    if (subscriptionIds.length) {
        const db = getServiceTestDb();
        await db
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, subscriptionIds));
        await db.delete(subscriptions).where(inArray(subscriptions.id, subscriptionIds));
    }
}
