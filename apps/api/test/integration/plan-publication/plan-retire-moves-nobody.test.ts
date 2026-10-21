/**
 * TEST:B4:12 (AC:B4:12, INV:D13): retiring a plan moves nobody.
 *
 * "Retirado el plan con la acción 18, ninguna fila de suscripción, ningún monto
 * en el falso y ningún entitlement cambia; retirados todos los de una vertical,
 * `S1` rechaza el checkout y los de adentro siguen igual."
 *
 * A subscriber anchored to a version of their plan is photographed before and
 * after the retire with the SAME function: the whole `subscription` row (every
 * amount and date), the preapproval as the fake provider reads it, the
 * effective set as production reads it (the admin route over
 * `getListingAccessPorts().effectiveSet`) and the real `coverage()`, whose
 * SUBSCRIPTION source must keep pointing at the ANCHORED version. The retire
 * goes through action 18's route (publishing a non-sellable version), and the
 * retired version's keys differ from the anchored one's, so a read through the
 * current version would show up as a changed effective set.
 *
 * Retiring every plan of a vertical retires the three sellable accommodation
 * plans of migration 0144, so the file starts and ends with
 * `restoreProductionPlanCatalog()` (it truncates the catalog with CASCADE, so
 * the billing options and subscriptions written here go with it). Afterwards it
 * deletes only its own provider links and users; it never truncates anything
 * else nor counts global rows.
 */
import {
    and,
    billingOptions,
    eq,
    getDb,
    inArray,
    planVersions,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createApiBillingCoverage } from '../../../src/utils/listing-access/billing-coverage';
import { createBootstrapCoverageReader } from '../../../src/utils/listing-access/bootstrap-coverage-reader';
import { testDb } from '../../e2e/setup/test-database';
import {
    headers,
    insertPlan,
    insertVersion,
    publishBody,
    publishUrl,
    readVersionEffects,
    restoreProductionPlanCatalog,
    superAdmin
} from './plan-publication.helpers.js';

const clock = { now: () => new Date('2026-10-14T12:00:00.000Z') };
const S1_PATH = '/api/v1/protected/billing/subscriptions';
const ACCOMMODATION = VerticalEnum.ACCOMMODATION;

/** The sellable accommodation plans seeded by migration 0144. */
const PRODUCTION_ACCOMMODATION_PLAN_IDS = [
    '8c0403e4-872b-56c7-a6ea-cd517716cfcb', // owner-basico
    'd110a075-610b-5ab9-b0d4-9f6e0dd6d00c', // owner-pro
    '5d36fc97-5ae9-563c-8e56-70e17095cbac' // owner-premium
] as const;

/** Keys of the anchored version; the retired version publishes none of them. */
const ANCHORED_ENTITLEMENTS = [
    { key: 'respond_reviews' },
    { key: 'create_promotions' },
    { key: 'view_advanced_stats' }
];
const ANCHORED_LIMITS = [{ key: 'max_photos_per_accommodation', value: 37 }];

/** Admin headers allowed to read another account's effective set. */
const inspector = headers({
    role: RoleEnum.SUPER_ADMIN,
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
});

/** Mock USER actor headers for the protected S1 route. */
function userHeaders(args: { readonly userId: string }) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': args.userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

const createdUserIds: string[] = [];
const createdSubscriptionIds: string[] = [];

/** A fresh account, registered for cleanup. */
async function seedUser(): Promise<string> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b45-retire-${crypto.randomUUID()}@example.test`,
            displayName: 'B4.5 retire',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('No user');
    createdUserIds.push(user.id);
    return user.id;
}

/**
 * A subscriber anchored to a sellable, current version of a plan of their
 * own: the plan, its version with keys, a monthly option, a preapproval in a
 * fake provider and an `ACTIVE PRINCIPAL CARD` subscription with its link.
 */
async function arrangeAnchoredSubscriber() {
    const db = getDb();
    const userId = await seedUser();
    const planId = await insertPlan({
        vertical: ACCOMMODATION,
        slug: `b45-retire-${crypto.randomUUID()}`
    });
    const rank = Math.floor(Math.random() * 100000000) + 1000;
    const anchoredVersionId = await insertVersion({
        planId,
        vertical: ACCOMMODATION,
        rank,
        sellable: true,
        current: true,
        entitlements: ANCHORED_ENTITLEMENTS,
        limits: ANCHORED_LIMITS
    });
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: anchoredVersionId,
            cycle: 'monthly',
            amount: 180000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('No option');
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const { authorizationId } = await fake.authorize({
        reference: `b45-retire-${crypto.randomUUID()}`,
        amount: { amountMinor: 180000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'B4.5 retire',
        returnUrl: 'https://hospeda.example/account'
    });
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId,
            vertical: ACCOMMODATION,
            planVersionId: anchoredVersionId,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('No subscription');
    createdSubscriptionIds.push(subscription.id);
    await db.insert(providerLinks).values({
        subscriptionId: subscription.id,
        provider: 'MERCADO_PAGO',
        providerId: authorizationId
    });
    const spies = {
        changeAmount: vi.spyOn(fake, 'changeAmount'),
        cancel: vi.spyOn(fake, 'cancel'),
        pause: vi.spyOn(fake, 'pause')
    };
    const app = initApp({ clock, paymentProvider: fake });
    return {
        app,
        fake,
        spies,
        userId,
        planId,
        rank,
        anchoredVersionId,
        subscriptionId: subscription.id,
        authorizationId
    };
}

type Subscriber = Awaited<ReturnType<typeof arrangeAnchoredSubscriber>>;

/**
 * Everything a retire could move for the subscriber, read the same way before
 * and after: (a) the whole subscription row, (b) the preapproval in the fake,
 * (c) the effective set through production's admin route, (d) the real
 * `coverage()`.
 */
async function photograph(args: { readonly subscriber: Subscriber }) {
    const { subscriber } = args;
    const [row] = await getDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriber.subscriptionId));
    const authorization = await subscriber.fake.readAuthorization({
        authorizationId: subscriber.authorizationId
    });
    const response = await subscriber.app.request(
        `/api/v1/admin/users/${subscriber.userId}/effective-set?vertical=${ACCOMMODATION}`,
        { method: 'GET', headers: inspector }
    );
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    const { coverage } = createApiBillingCoverage({ reader: createBootstrapCoverageReader() });
    const covered = await coverage({ userId: subscriber.userId, vertical: ACCOMMODATION });
    return {
        row,
        authorization,
        effectiveSet: { entitlements: body.data.entitlements, limits: body.data.limits },
        coverage: covered
    };
}

type Photo = Awaited<ReturnType<typeof photograph>>;

/** The "before" photo is the one to keep: covered, through the ANCHORED version. */
function expectAnchoredCoverage(args: { readonly photo: Photo; readonly versionId: string }) {
    expect(args.photo.coverage.covered, 'the ACTIVE subscription covers').toBe(true);
    expect(
        args.photo.coverage.sources
            .filter((source) => source.type === 'SUBSCRIPTION')
            .map((source) => source.reference),
        'one SUBSCRIPTION source, referencing the anchored version'
    ).toEqual([{ kind: 'PLAN_VERSION', planVersionId: args.versionId }]);
    const { entitlements } = args.photo.effectiveSet;
    for (const { key } of ANCHORED_ENTITLEMENTS) {
        expect(entitlements[key], `the effective set carries the anchored key ${key}`).toBe(
            'Infinity'
        );
    }
}

/** Nothing moved: the four reads are deeply equal and the fake was never asked to change. */
function expectNothingMoved(args: {
    readonly subscriber: Subscriber;
    readonly before: Photo;
    readonly after: Photo;
}) {
    const { subscriber, before, after } = args;
    expect(after.row, 'the subscription row (amounts, dates, anchor) is unchanged').toEqual(
        before.row
    );
    expect(after.authorization, 'the preapproval in the fake is unchanged').toEqual(
        before.authorization
    );
    expect(after.effectiveSet, 'entitlements and limits are unchanged').toEqual(
        before.effectiveSet
    );
    expect(after.coverage, 'coverage() is unchanged').toEqual(before.coverage);
    expect(subscriber.spies.changeAmount, 'no amount change was sent').not.toHaveBeenCalled();
    expect(subscriber.spies.cancel, 'no cancellation was sent').not.toHaveBeenCalled();
    expect(subscriber.spies.pause, 'no pause was sent').not.toHaveBeenCalled();
}

/** Retires a plan through action 18: publishes a non-sellable current version. */
async function retire(args: {
    readonly app: Subscriber['app'];
    readonly planId: string;
}): Promise<string> {
    const response = await args.app.request(publishUrl({ planId: args.planId }), {
        method: 'POST',
        headers: superAdmin,
        body: publishBody({ overrides: { sellable: false, entitlements: [], limits: [] } })
    });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.data, 'the retire publishes a non-sellable current version').toMatchObject({
        sellable: false,
        current: true
    });
    return body.data.id;
}

/** The current version of a plan, with its keys. */
async function currentVersionOf(args: { readonly planId: string }) {
    const [row] = await getDb()
        .select({ id: planVersions.id, sellable: planVersions.sellable })
        .from(planVersions)
        .where(and(eq(planVersions.planId, args.planId), eq(planVersions.current, true)));
    return row;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    await restoreProductionPlanCatalog();
});

afterAll(async () => {
    await restoreProductionPlanCatalog();
    const db = getDb();
    if (createdSubscriptionIds.length > 0) {
        await db
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, createdSubscriptionIds));
    }
    if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await testDb.teardown();
});

describe('TEST:B4:12 (AC:B4:12) retiring a plan with action 18 moves no anchored subscription', () => {
    it('retiring the plan with action 18 moves nobody', async () => {
        // Arrange
        const subscriber = await arrangeAnchoredSubscriber();
        const before = await photograph({ subscriber });
        expectAnchoredCoverage({ photo: before, versionId: subscriber.anchoredVersionId });

        // Act
        const retiredVersionId = await retire({ app: subscriber.app, planId: subscriber.planId });
        const after = await photograph({ subscriber });

        // Assert
        expect(
            await currentVersionOf({ planId: subscriber.planId }),
            'the current version of the plan is now the retired, non-sellable one'
        ).toEqual({ id: retiredVersionId, sellable: false });
        expect(retiredVersionId, 'the retired version is another version').not.toBe(
            subscriber.anchoredVersionId
        );
        expect(after.row?.planVersionId, 'the subscription stays anchored to the old one').toBe(
            subscriber.anchoredVersionId
        );
        // Precondition of the case: a read through the current version would
        // drop the anchored keys, so the effective set could not stay equal.
        const retiredEffects = await readVersionEffects({ versionId: retiredVersionId });
        const anchoredEffects = await readVersionEffects({
            versionId: subscriber.anchoredVersionId
        });
        expect(
            retiredEffects,
            'the retired version keys differ from the anchored version keys'
        ).not.toEqual(anchoredEffects);
        expect(anchoredEffects.entitlements.length, 'the anchored version grants keys').toBe(3);
        expect(retiredEffects, 'the retired version grants none of them').toEqual({
            entitlements: [],
            limits: []
        });
        expectNothingMoved({ subscriber, before, after });
    });
});

describe('TEST:B4:12 (AC:B4:12) retiring every plan of a vertical: S1 rejects and those inside stay the same', () => {
    it('with no sellable version left in accommodation, S1 answers 422 PLAN_NOT_FOR_SALE and the subscriber is unchanged', async () => {
        // Arrange
        const subscriber = await arrangeAnchoredSubscriber();
        const before = await photograph({ subscriber });
        expectAnchoredCoverage({ photo: before, versionId: subscriber.anchoredVersionId });
        const authorize = vi.spyOn(subscriber.fake, 'authorize');

        // Act: retire the subscriber's plan and the three sellable plans of 0144.
        await retire({ app: subscriber.app, planId: subscriber.planId });
        const retiredProductionVersionIds: string[] = [];
        for (const planId of PRODUCTION_ACCOMMODATION_PLAN_IDS) {
            retiredProductionVersionIds.push(await retire({ app: subscriber.app, planId }));
        }

        // Assert: the vertical has no current and sellable version left.
        const sellable = await getDb()
            .select({ id: planVersions.id })
            .from(planVersions)
            .where(
                and(
                    eq(planVersions.vertical, ACCOMMODATION),
                    eq(planVersions.current, true),
                    eq(planVersions.sellable, true)
                )
            );
        expect(sellable, 'no current and sellable version left in accommodation').toEqual([]);

        // Assert: a new account cannot check out any of the retired plans.
        const newcomerId = await seedUser();
        for (const planVersionId of retiredProductionVersionIds) {
            const [option] = await getDb()
                .insert(billingOptions)
                .values({ planVersionId, cycle: 'monthly', amount: 180000, currency: 'ARS' })
                .returning({ id: billingOptions.id });
            if (!option) throw new Error('No option');
            const response = await subscriber.app.request(S1_PATH, {
                method: 'POST',
                headers: userHeaders({ userId: newcomerId }),
                body: JSON.stringify({
                    billingOptionId: option.id,
                    payerEmail: `mp-${crypto.randomUUID()}@example.test`
                })
            });
            const body = await response.json();
            expect(response.status, JSON.stringify(body)).toBe(422);
            expect(body.error.reason, 'S1 rejects: no sellable version').toBe('PLAN_NOT_FOR_SALE');
        }
        expect(authorize, 'S1 never reached the provider').not.toHaveBeenCalled();
        expect(
            await getDb()
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(eq(subscriptions.userId, newcomerId)),
            'S1 created no subscription row for the new account'
        ).toEqual([]);

        // Assert: the one already inside stays the same.
        const after = await photograph({ subscriber });
        expectNothingMoved({ subscriber, before, after });
    });
});
