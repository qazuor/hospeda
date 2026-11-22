import {
    accommodations,
    and,
    type DrizzleClient,
    eq,
    experiences,
    inArray,
    isNull,
    listingPublicationModel,
    listingRetentionModel,
    partners,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    touristVipModel,
    venues
} from '@repo/db';
import { EntitlementKeyEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS, type PublicationVertical } from '@repo/verticals';
import type { TouristVipInheritancePort } from './cancel-inherited-tourist-vip.service';
import type { ComplementPolicyPorts } from './complement-ports';
import { isResumableAtProvider } from './complement-resume-s33';
import { selectComplementTargets } from './complement-selection';
import {
    type ListingReturnItem,
    type PartnerReturnOutcome,
    planListingReturn,
    planPartnerReturn,
    planS7SideEffects,
    returnPresenceKind,
    type S7SideEffects
} from './late-manual-payment-return-plan';
import { findDueScheduledChange } from './scheduled-change-on-return';

/** Reads which listings fail the publish completeness predicate (composed in apps/api). */
export type ReadIncompleteListingIds = (args: {
    readonly vertical: PublicationVertical;
    readonly listingIds: readonly string[];
}) => Promise<ReadonlyMap<string, readonly string[]>>;

/** Optional integrations the preview reads through; each one the real S7 path also uses. */
export interface LateManualPaymentReturnPorts {
    /** HOS-1744 completeness, the predicate PB7 applies before restoring a listing. */
    readonly readIncompleteListingIds?: ReadIncompleteListingIds;
    /** S33's complement policy, the ports `resumeComplementsS33` selects with. */
    readonly complements?: ComplementPolicyPorts;
    /** Live Tourist VIP inheritance from another vertical. */
    readonly touristVipInheritance?: TouristVipInheritancePort;
}

/** What fila 10-bis says comes back, per vertical. */
export type LateManualPaymentPresence =
    | {
          readonly kind: 'LISTINGS';
          readonly vertical: PublicationVertical;
          readonly limit: number | null;
          readonly listings: readonly ListingReturnItem[];
      }
    | {
          readonly kind: 'PARTNER';
          readonly partner: { readonly name: string; readonly slug: string } | null;
          readonly outcome: PartnerReturnOutcome;
      }
    | { readonly kind: 'NONE'; readonly vertical: string | null };

/** The subscription fields the facts are read from. */
export interface ReturnSubject {
    readonly id: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly planVersionId: string | null;
}

const LISTING_TABLES = {
    [VerticalEnum.ACCOMMODATION]: () => accommodations,
    [VerticalEnum.VENUE]: () => venues,
    [VerticalEnum.EXPERIENCE]: () => experiences
} as const;

async function readListingPresence(input: {
    readonly tx: DrizzleClient;
    readonly vertical: PublicationVertical;
    readonly subject: ReturnSubject;
    readonly ports: LateManualPaymentReturnPorts;
}): Promise<LateManualPaymentPresence> {
    const { tx, vertical, subject } = input;
    const limit = await readPlanLimit({ tx, vertical, planVersionId: subject.planVersionId });
    if (!subject.userId) return { kind: 'LISTINGS', vertical, limit, listings: [] };
    const listings = await listingPublicationModel.listByOwner({
        tx,
        vertical,
        ownerId: subject.userId
    });
    const ids = listings.map((row) => row.id);
    const table = LISTING_TABLES[vertical]();
    const names =
        ids.length === 0
            ? []
            : await tx
                  .select({ id: table.id, name: table.name })
                  .from(table)
                  .where(inArray(table.id, ids));
    const nameOf = new Map(names.map((row) => [row.id, row.name]));
    const archived = listings.filter(
        (row) => row.publicationStatus === PublicationStatusEnum.ARCHIVED
    );
    const archiveOrigins = await listingRetentionModel.readArchiveOrigins({
        tx,
        vertical,
        listingIds: archived.map((row) => row.id)
    });
    const returning = listings
        .filter(
            (row) =>
                row.publicationStatus === PublicationStatusEnum.UNPUBLISHED_BY_BILLING ||
                row.publicationStatus === PublicationStatusEnum.ARCHIVED
        )
        .map((row) => row.id);
    const incomplete =
        returning.length > 0 && input.ports.readIncompleteListingIds
            ? await input.ports.readIncompleteListingIds({ vertical, listingIds: returning })
            : new Map<string, readonly string[]>();
    const publishedAt = await listingPublicationModel.readPublicationInstants({
        tx,
        vertical,
        listingIds: returning
    });
    const publishedCount = listings.filter(
        (row) => row.publicationStatus === PublicationStatusEnum.PUBLISHED
    ).length;
    return {
        kind: 'LISTINGS',
        vertical,
        limit,
        listings: planListingReturn({
            listings: listings.map((row) => ({
                id: row.id,
                name: nameOf.get(row.id) ?? row.id,
                publicationStatus: row.publicationStatus,
                createdAt: row.createdAt
            })),
            archiveOrigins,
            incompleteIds: new Set(incomplete.keys()),
            publishedAt,
            limit,
            publishedCount
        })
    };
}

async function readPlanLimit(input: {
    readonly tx: DrizzleClient;
    readonly vertical: PublicationVertical;
    readonly planVersionId: string | null;
}): Promise<number | null> {
    if (!input.planVersionId) return null;
    const [row] = await input.tx
        .select({ value: planVersionLimits.value })
        .from(planVersionLimits)
        .where(
            and(
                eq(planVersionLimits.planVersionId, input.planVersionId),
                eq(planVersionLimits.key, PUBLICATION_LIMIT_KEYS[input.vertical])
            )
        )
        .limit(1);
    return row?.value ?? null;
}

async function readEntitlementKeys(input: {
    readonly tx: DrizzleClient;
    readonly planVersionId: string | null;
}): Promise<ReadonlySet<string>> {
    if (!input.planVersionId) return new Set();
    const rows = await input.tx
        .select({ key: planVersionEntitlements.key })
        .from(planVersionEntitlements)
        .where(eq(planVersionEntitlements.planVersionId, input.planVersionId));
    return new Set(rows.map((row) => row.key));
}

async function readPartnerPresence(input: {
    readonly tx: DrizzleClient;
    readonly subject: ReturnSubject;
}): Promise<LateManualPaymentPresence> {
    const keys = await readEntitlementKeys({
        tx: input.tx,
        planVersionId: input.subject.planVersionId
    });
    const [partner] = input.subject.userId
        ? await input.tx
              .select({ name: partners.name, slug: partners.slug, revokedAt: partners.revokedAt })
              .from(partners)
              .where(
                  and(eq(partners.ownerUserId, input.subject.userId), isNull(partners.deletedAt))
              )
              .limit(1)
        : [];
    return {
        kind: 'PARTNER',
        partner: partner ? { name: partner.name, slug: partner.slug } : null,
        outcome: planPartnerReturn({
            partner: partner ? { revokedAt: partner.revokedAt } : null,
            grantsPublicPage: keys.has(EntitlementKeyEnum.PARTNER_PUBLIC_PAGE),
            grantsCarousel: keys.has(EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE)
        })
    };
}

/**
 * Reads what the S7 reactivation brings back for this subscription's vertical (fila
 * 10-bis (a)/(b)). Read-only.
 *
 * @param input.tx - A read transaction
 * @param input.subject - The suspended subscription
 * @param input.ports - Optional integrations
 * @returns The presence block
 */
export async function readLateManualPaymentPresence(input: {
    readonly tx: DrizzleClient;
    readonly subject: ReturnSubject;
    readonly ports: LateManualPaymentReturnPorts;
}): Promise<LateManualPaymentPresence> {
    const kind = returnPresenceKind({ vertical: input.subject.vertical });
    if (kind === 'PARTNER') return readPartnerPresence(input);
    if (kind === 'LISTINGS')
        return readListingPresence({
            ...input,
            vertical: input.subject.vertical as PublicationVertical
        });
    return { kind: 'NONE', vertical: input.subject.vertical };
}

/**
 * Reads the other three S7 effects (`register-late-manual-payment.service.ts:317`, `:359`,
 * `:364-382`) through the same selectors the real path runs. Read-only.
 *
 * @param input.tx - A read transaction
 * @param input.subject - The suspended subscription
 * @param input.now - The act's instant
 * @param input.ports - Optional integrations
 * @returns The three effects
 */
export async function readS7SideEffects(input: {
    readonly tx: DrizzleClient;
    readonly subject: ReturnSubject;
    readonly now: Date;
    readonly ports: LateManualPaymentReturnPorts;
}): Promise<S7SideEffects> {
    const { tx, subject } = input;
    const dueScheduledChange = await findDueScheduledChange({
        subscriptionId: subject.id,
        now: input.now,
        tx
    });
    const targets =
        subject.userId && subject.vertical && input.ports.complements
            ? (
                  await selectComplementTargets(
                      {
                          tx,
                          principal: {
                              id: subject.id,
                              userId: subject.userId,
                              vertical: subject.vertical
                          },
                          rule: 'RESUME',
                          complementStatus: 'PAUSED'
                      },
                      input.ports.complements
                  )
              ).targets
            : [];
    const [version] = subject.planVersionId
        ? await tx
              .select({ inheritsTouristVip: planVersions.inheritsTouristVip })
              .from(planVersions)
              .where(eq(planVersions.id, subject.planVersionId))
              .limit(1)
        : [];
    const inheritsElsewhere =
        subject.userId && input.ports.touristVipInheritance
            ? await input.ports.touristVipInheritance.inherits({ userId: subject.userId })
            : false;
    const vipRows = subject.userId
        ? await touristVipModel.findCancellableRows({ userId: subject.userId, tx })
        : [];
    return planS7SideEffects({
        pausedComplements: targets.map((target) => ({
            complementSubscriptionId: target.complementSubscriptionId,
            resumableAtProvider: isResumableAtProvider(target)
        })),
        inheritsTouristVip: (version?.inheritsTouristVip ?? false) || inheritsElsewhere,
        cancellableTouristVipIds: vipRows
            .map((row) => row.subscription.id)
            .filter((id) => id !== subject.id),
        dueScheduledChange
    });
}
