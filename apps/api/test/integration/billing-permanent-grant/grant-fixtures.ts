import {
    buildEmailDedupKey,
    buildEventOccurrence,
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
    subscriptions,
    users
} from '@repo/db';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';

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
