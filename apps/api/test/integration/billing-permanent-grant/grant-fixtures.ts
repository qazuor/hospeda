import {
    accommodationMedia,
    accommodations,
    addonInstances,
    addonProducts,
    addons,
    addonVersions,
    buildEmailDedupKey,
    buildEventOccurrence,
    destinations,
    domainEventModel,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    inArray,
    or,
    permanentGrants,
    permanentGrantVerticals,
    plans,
    planVersions,
    providerLinks,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { PublicationStatusEnum } from '@repo/schemas';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';
import {
    createListing,
    createVerticalDestination
} from '../listing-publication/publication-routes.helpers';

const own = {
    users: [] as string[],
    planIds: [] as string[],
    versionIds: [] as string[],
    grantIds: [] as string[]
};

/** Seed a test account owned by this fixture. */
export async function seedGrantUser(label: string): Promise<string> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b9a2-${label}-${crypto.randomUUID()}@example.test`,
            displayName: `B9a.2 ${label}`,
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected permanent-grant route user');
    own.users.push(user.id);
    return user.id;
}

/** Seed a plan and non-sellable floor reference for one vertical. */
export async function seedGrantPlan(
    vertical: string,
    options: { readonly current?: boolean } = {}
) {
    const [plan] = await getDb()
        .insert(plans)
        .values({
            vertical,
            slug: `b9a2-${crypto.randomUUID()}`,
            name: 'B9a.2 route plan'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected permanent-grant route plan');
    own.planIds.push(plan.id);
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: false,
            current: options.current ?? true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected permanent-grant route floor');
    own.versionIds.push(version.id);
    return { vertical, planId: plan.id, floorPlanVersionId: version.id };
}

/** Seed a permanent grant row and optionally its first vertical anchor. */
export async function seedGrant(input: {
    readonly beneficiaryUserId: string;
    readonly grantedBy: string;
    readonly anchor?: Awaited<ReturnType<typeof seedGrantPlan>>;
    readonly revoked?: boolean;
}) {
    const [grant] = await getDb()
        .insert(permanentGrants)
        .values({
            beneficiaryUserId: input.beneficiaryUserId,
            grantedBy: input.grantedBy,
            reason: 'B9a.2 route fixture',
            includesAddons: false,
            ...(input.revoked
                ? {
                      revokedAt: new Date('2026-10-01T00:00:00.000Z'),
                      revokedBy: input.grantedBy,
                      revocationReason: 'Fixture revoked grant'
                  }
                : {})
        })
        .returning({ id: permanentGrants.id });
    if (!grant) throw new Error('Expected permanent-grant route row');
    own.grantIds.push(grant.id);
    let anchorId: string | undefined;
    if (input.anchor) {
        const [anchor] = await getDb()
            .insert(permanentGrantVerticals)
            .values({
                permanentGrantId: grant.id,
                ...input.anchor
            })
            .returning({ id: permanentGrantVerticals.id });
        if (!anchor) throw new Error('Expected permanent-grant route anchor');
        anchorId = anchor.id;
    }
    return { grantId: grant.id, anchorId };
}

/** Snapshot only this beneficiary's grant and anchor state. */
export async function grantState(beneficiaryUserId: string) {
    const grants = await getDb()
        .select({ id: permanentGrants.id, revokedAt: permanentGrants.revokedAt })
        .from(permanentGrants)
        .where(eq(permanentGrants.beneficiaryUserId, beneficiaryUserId));
    const anchors = grants.length
        ? await getDb()
              .select({ id: permanentGrantVerticals.id })
              .from(permanentGrantVerticals)
              .where(
                  inArray(
                      permanentGrantVerticals.permanentGrantId,
                      grants.map(({ id }) => id)
                  )
              )
        : [];
    return { grants, anchors };
}

/** Read the principal status for a narrowly scoped no-write assertion. */
export async function principalStatus(subscriptionId: string) {
    const [row] = await getDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row?.status;
}

/** Seed the sent pre-cancellation notice S13 requires before contacting the provider. */
export async function markPermanentGrantNoticeSent(input: {
    readonly ownerId: string;
    readonly subscriptionId: string;
}) {
    const template = BEFORE_CANCEL_TEMPLATE_BY_KIND.PERMANENT_GRANT;
    const dedupKey = buildEmailDedupKey({
        recipient: input.ownerId,
        template,
        occurrence: buildEventOccurrence({ eventId: input.subscriptionId })
    });
    await emailOutboxModel.enqueue({
        recipientUserId: input.ownerId,
        recipientEmail: `b9a2-notice-${crypto.randomUUID()}@example.test`,
        template,
        payload: { subscriptionId: input.subscriptionId },
        dedupKey
    });
    await getDb()
        .update(emailOutbox)
        .set({ status: 'sent', lastError: null })
        .where(eq(emailOutbox.dedupKey, dedupKey));
}

/** Delete this fixture's rows by tracked identifiers; never truncates shared tables. */
export async function cleanupPermanentGrantRows() {
    const grants = own.users.length
        ? await getDb()
              .select({ id: permanentGrants.id })
              .from(permanentGrants)
              .where(
                  or(
                      inArray(permanentGrants.beneficiaryUserId, own.users),
                      inArray(permanentGrants.grantedBy, own.users)
                  )
              )
        : [];
    const grantIds = grants.map(({ id }) => id);
    if (grantIds.length) {
        await getDb()
            .delete(permanentGrantVerticals)
            .where(inArray(permanentGrantVerticals.permanentGrantId, grantIds));
        await getDb().delete(permanentGrants).where(inArray(permanentGrants.id, grantIds));
    }
    // Plan versions are immutable by database trigger; leave these private, non-sellable rows.
    if (own.users.length) await getDb().delete(users).where(inArray(users.id, own.users));
    own.grantIds.length = 0;
    own.versionIds.length = 0;
    own.planIds.length = 0;
    own.users.length = 0;
}

const revokeOwn = {
    addonInstanceIds: [] as string[],
    complementIds: [] as string[],
    productIds: [] as string[],
    versionIds: [] as string[],
    addonIds: [] as string[],
    listingIds: [] as string[],
    destinationIds: [] as string[]
};

/**
 * Seed one ACTIVE USER or LISTING addon instance with a live complement subscription, in
 * the same row order as `@repo/service-core`'s S20 fixtures (that helper is not
 * importable from `apps/api`). The grant's S20 conversion titles it.
 */
export async function seedGrantRevokeAddon(input: {
    readonly fake: FakePaymentProvider;
    readonly userId: string;
    readonly vertical: string;
    readonly compatibleVerticals: readonly string[];
    readonly scopeType?: 'USER' | 'LISTING';
    readonly targetId?: string;
}): Promise<{ readonly instanceId: string; readonly complementId: string }> {
    if (input.scopeType === 'LISTING' && !input.targetId)
        throw new Error('LISTING addon requires targetId');
    const authorization = await input.fake.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 500000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'permanent grant revoke fixture',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    await input.fake.approve({ authorizationId: authorization.authorizationId });
    const db = getDb();
    const [complement] = await db
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: input.vertical,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'COMPLEMENTO',
            serviceEndsAt: null,
            graceStartedAt: null,
            graceEndsAt: null,
            updatedAt: new Date('2026-10-01T10:00:00.000Z')
        })
        .returning({ id: subscriptions.id });
    if (!complement) throw new Error('Expected addon complement subscription');
    await db.insert(providerLinks).values({
        subscriptionId: complement.id,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    const [addon] = await db
        .insert(addons)
        .values({ slug: `b9a6-${crypto.randomUUID()}`, name: 'B9a.6 revoke addon' })
        .returning({ id: addons.id });
    if (!addon) throw new Error('Expected revoke addon');
    const [version] = await db
        .insert(addonVersions)
        .values({
            addonId: addon.id,
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: input.scopeType ?? 'USER'
        })
        .returning({ id: addonVersions.id });
    if (!version) throw new Error('Expected revoke addon version');
    const [product] = await db
        .insert(addonProducts)
        .values({
            addonId: addon.id,
            versionId: version.id,
            price: 5000,
            currency: 'ARS',
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            compatibleVerticals: [...input.compatibleVerticals]
        })
        .returning({ id: addonProducts.id });
    if (!product) throw new Error('Expected revoke addon product');
    const [instance] = await db
        .insert(addonInstances)
        .values({
            productId: product.id,
            addonVersionId: version.id,
            ownerId: input.userId,
            targetId: input.scopeType === 'LISTING' ? input.targetId : null,
            status: 'ACTIVE',
            complementSubscriptionId: complement.id,
            startsAt: new Date('2026-10-03T10:00:00.000Z')
        })
        .returning({ id: addonInstances.id });
    if (!instance) throw new Error('Expected revoke addon instance');
    revokeOwn.addonInstanceIds.push(instance.id);
    revokeOwn.complementIds.push(complement.id);
    revokeOwn.productIds.push(product.id);
    revokeOwn.versionIds.push(version.id);
    revokeOwn.addonIds.push(addon.id);
    return { instanceId: instance.id, complementId: complement.id };
}

/** Create an owned, published accommodation for the production listing inverse. */
export async function seedOwnedAccommodationListing(userId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    revokeOwn.destinationIds.push(destinationId);
    const listingId = await createListing({
        ownerId: userId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED,
        complete: true
    });
    revokeOwn.listingIds.push(listingId);
    return listingId;
}

/**
 * Bootstrap the accommodation activation event the trial's T8 reads (an owner
 * that published once). The trial itself is consumed by the real listener on
 * the grant's coverage notice, never by this helper.
 */
export async function seedPublishedAccommodationActivation(userId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    revokeOwn.destinationIds.push(destinationId);
    const listingId = await createListing({
        ownerId: userId,
        destinationId,
        status: PublicationStatusEnum.DRAFT,
        complete: false
    });
    revokeOwn.listingIds.push(listingId);
    await domainEventModel.insert({
        eventType: 'listing.status_changed',
        entityType: 'accommodation',
        entityId: listingId,
        actorId: userId,
        actorType: 'owner',
        correlationId: crypto.randomUUID(),
        changes: [{ field: 'publicationStatus', old: 'DRAFT', new: 'PUBLISHED' }]
    });
    return listingId;
}

/**
 * Delete the rows this revoke fixture created, children first. Users and their
 * trial rows are kept: extras 042 rejects deleting a trial, so a beneficiary
 * stays as the suite's fixtures already do.
 */
export async function retireGrantRevokeAddons(): Promise<void> {
    const db = getDb();
    const instanceIds = revokeOwn.addonInstanceIds.splice(0);
    const complementIds = revokeOwn.complementIds.splice(0);
    const productIds = revokeOwn.productIds.splice(0);
    const versionIds = revokeOwn.versionIds.splice(0);
    const addonIds = revokeOwn.addonIds.splice(0);
    const listingIds = revokeOwn.listingIds.splice(0);
    const destinationIds = revokeOwn.destinationIds.splice(0);
    if (complementIds.length) {
        await db
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, complementIds));
        await db.delete(providerLinks).where(inArray(providerLinks.subscriptionId, complementIds));
        await db
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, complementIds));
    }
    if (instanceIds.length)
        await db.delete(addonInstances).where(inArray(addonInstances.id, instanceIds));
    // addon, addon_version and addon_product are immutable catalog rows: leave
    // them private, exactly like the service-core S20 fixtures.
    productIds.length = 0;
    versionIds.length = 0;
    addonIds.length = 0;
    if (complementIds.length)
        await db.delete(subscriptions).where(inArray(subscriptions.id, complementIds));
    if (listingIds.length)
        await db
            .delete(accommodationMedia)
            .where(inArray(accommodationMedia.accommodationId, listingIds));
    if (listingIds.length)
        await db.delete(accommodations).where(inArray(accommodations.id, listingIds));
    if (destinationIds.length)
        await db.delete(destinations).where(inArray(destinations.id, destinationIds));
}
