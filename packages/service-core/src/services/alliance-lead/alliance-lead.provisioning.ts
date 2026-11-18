import type { HostTradeCategoryModel, HostTradeModel, SelectAllianceLead } from '@repo/db';
import type { ILogger } from '@repo/logger';
import {
    type AllianceLeadProvisioningOutcome,
    type AllianceLeadProvisionSkipReason,
    type HostTradeBenefitTypeEnum,
    HostTradeBenefitTypeEnumSchema,
    LifecycleStatusEnum,
    resolveLegacyCategorySlugs
} from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';

/**
 * @file alliance-lead.provisioning.ts
 * @description Materializes a `host_trades` directory listing from an approved
 * `service_provider` alliance lead (HOS-278 §6.4).
 *
 * This is the one place HOS-277's NG-1 ("approval never auto-provisions") is
 * lifted, and it is lifted for `service_provider` ONLY. The other three
 * programs are still provisioned by hand.
 */

/** Everything provisioning needs from the lead, in one shape. */
export interface ProvisionListingInput {
    /** The lead row as it exists AFTER the status transition to `approved`. */
    readonly lead: SelectAllianceLead;
    /** Model used to look up slugs and insert the listing. */
    readonly hostTradeModel: HostTradeModel;
    /**
     * Catalog model used to resolve the lead's category slugs to ACTIVE categories
     * and to re-validate them under a row lock before linking them.
     */
    readonly categoryModel: Pick<
        HostTradeCategoryModel,
        'findActiveBySlugs' | 'findByIdsForShare' | 'findIdsInDeletedGroups'
    >;
    /** The admin performing the approval — recorded as the listing's creator. */
    readonly actorId: string;
    /** Logger for the skip paths, which are silent by design but not invisible. */
    readonly logger: ILogger;
    /** Transaction to enlist in, when the caller opened one. */
    readonly tx?: Parameters<HostTradeModel['create']>[1];
}

/** Why provisioning did not produce a new listing, when it did not. */
export type ProvisionSkipReason = AllianceLeadProvisionSkipReason;

/**
 * What a lead's approval will produce, decided WITHOUT touching the database.
 *
 * Separated from the execution below so the caller can know whether a listing
 * is coming before deciding to open a transaction. Approving is overwhelmingly
 * a single UPDATE — rejections, and the other three programs — and opening a
 * boundary for those would make a method that needs no database connection
 * demand one.
 */
export type ProvisionPlan =
    | { readonly kind: 'skip'; readonly reason: ProvisionSkipReason; readonly hostTradeId?: string }
    | {
          readonly kind: 'provision';
          readonly businessName: string;
          /** Catalog slugs the applicant chose; resolved to ACTIVE categories at write time. */
          readonly categorySlugs: readonly string[];
          readonly destinationId: string;
          readonly benefitType: HostTradeBenefitTypeEnum | null;
      };

/**
 * Decides what approving this lead should produce.
 *
 * Pure: reads the row it is handed and nothing else, so it is the single place
 * the three skip conditions are expressed and the one both the transaction
 * decision and the write path consult. Splitting the condition across the two
 * would let them disagree — a transaction opened for a listing that never
 * arrives, or worse, the reverse.
 *
 * @param lead - The lead row being approved.
 * @returns Either the data a listing needs, or why there will be none.
 */
export const resolveProvisionPlan = (lead: SelectAllianceLead): ProvisionPlan => {
    if (lead.kind !== 'service_provider') {
        return { kind: 'skip', reason: 'not-a-service-provider' };
    }

    if (lead.provisionedHostTradeId) {
        return {
            kind: 'skip',
            reason: 'already-provisioned',
            hostTradeId: lead.provisionedHostTradeId
        };
    }

    // `benefitType` is NARROWED here, not merely checked for presence: the lead
    // stores it as varchar (this table's convention for closed sets) while
    // `host_trades` uses a real Postgres enum. Parsing is what crosses that
    // seam — a cast would let a value the enum rejects reach the insert and
    // fail there, mid-approval.
    //
    // The categories come from `categorySlugs` (HOS-919). A lead written by a
    // container that still ran the pre-HOS-919 code after the data-migration
    // ran (rolling deploy) has only the legacy `category`: it is mapped through
    // the same table the migration uses. `categorySlugs` always wins when set.
    // Whether the slugs are still ACTIVE is a database question, answered at
    // write time (this function stays pure).
    const categorySlugs =
        lead.categorySlugs && lead.categorySlugs.length > 0
            ? lead.categorySlugs
            : (resolveLegacyCategorySlugs(lead.category) ?? []);
    const benefitType = HostTradeBenefitTypeEnumSchema.nullish().safeParse(lead.benefitType);

    if (
        !lead.businessName ||
        !lead.destinationId ||
        categorySlugs.length === 0 ||
        !benefitType.success
    ) {
        return { kind: 'skip', reason: 'legacy-lead-without-typed-fields' };
    }

    return {
        kind: 'provision',
        businessName: lead.businessName,
        categorySlugs,
        destinationId: lead.destinationId,
        benefitType: benefitType.data ?? null
    };
};

/** Outcome of a provisioning attempt. */
export type ProvisionListingResult =
    | { readonly provisioned: true; readonly hostTradeId: string }
    | {
          readonly provisioned: false;
          readonly reason: ProvisionSkipReason;
          readonly hostTradeId?: string;
      };

/**
 * Maps a {@link ProvisionListingResult} to the outcome reported by the admin
 * API (HOS-2339). The one mapping shared by `markHandled` and `provisionListing`.
 *
 * @param params - `{ result }`.
 * @returns The wire-shaped outcome.
 */
export const toProvisioningOutcome = (params: {
    readonly result: ProvisionListingResult;
}): AllianceLeadProvisioningOutcome => {
    const { result } = params;
    if (result.provisioned) return { provisioned: true, hostTradeId: result.hostTradeId };
    return {
        provisioned: false,
        reason: result.reason,
        ...(result.hostTradeId === undefined ? {} : { hostTradeId: result.hostTradeId })
    };
};

/**
 * Composes the listing's `contact` free-text field from the lead's contact
 * details.
 *
 * `host_trades.contact` is one NOT NULL free-text blob (phone, WhatsApp, email
 * — whatever the admin typed), while the lead keeps email and phone apart. The
 * email is always present; the phone is optional, so it is appended only when
 * there is one rather than leaving a dangling separator in the directory.
 */
const composeContact = (lead: SelectAllianceLead): string =>
    lead.phone ? `${lead.email} · ${lead.phone}` : lead.email;

/**
 * Provisions the directory listing for an approved service-provider lead.
 *
 * Returns a discriminated result rather than throwing on the skip paths,
 * because none of them is an error the admin should see: each is a lead that
 * legitimately produces no listing, and turning any of them into a thrown error
 * would block an approval the admin is entitled to make.
 *
 * The four skips:
 *
 * - **not-a-service-provider** — the other three programs have no listing to
 *   create. NG-1 still holds for them.
 * - **already-provisioned** — the lead already carries a
 *   `provisionedHostTradeId`. Re-approving must not mint a second listing:
 *   `createUniqueSlug` would happily name it `acme-2` and the directory would
 *   show the provider twice, with no error anywhere to notice.
 * - **legacy-lead-without-typed-fields** — a lead submitted BEFORE the typed
 *   provider columns existed, whose answers live inside `message` as prose
 *   (HOS-277 NG-3). There is genuinely nothing to build a NOT NULL row from.
 *   These keep the pre-HOS-278 behavior: the admin approves, then creates the
 *   listing by hand. Refusing the approval instead would strand every provider
 *   lead already sitting in the inbox. A lead with only the legacy `category`
 *   and no `categorySlugs` is NOT one of these when the category maps to the
 *   catalog (rolling-deploy leads, HOS-919): it is provisioned through
 *   `LEGACY_CATEGORY_TO_SLUGS`. Only an unmapped legacy value is skipped.
 * - **no-active-category** (HOS-919) — every category the applicant chose was
 *   deactivated or deleted (or sits in a deleted group) since the submission,
 *   including a delete that raced this approval (checked FOR SHARE). No listing is created; the
 *   approval stands and the admin creates the listing by hand.
 *
 * @param input - See {@link ProvisionListingInput}.
 * @returns Whether a listing was created, and its id when one was.
 */
export const provisionServiceProviderListing = async ({
    lead,
    hostTradeModel,
    categoryModel,
    actorId,
    logger,
    tx
}: ProvisionListingInput): Promise<ProvisionListingResult> => {
    const plan = resolveProvisionPlan(lead);

    if (plan.kind === 'skip') {
        if (plan.reason === 'already-provisioned') {
            logger.info(
                { leadId: lead.id, hostTradeId: plan.hostTradeId },
                '[alliance-lead] listing already provisioned — approval is a no-op'
            );
        } else if (plan.reason === 'legacy-lead-without-typed-fields') {
            logger.warn(
                { leadId: lead.id },
                '[alliance-lead] approved service provider has no usable typed provider data — ' +
                    'legacy or malformed lead, listing must be created by hand'
            );
        }
        return { provisioned: false, reason: plan.reason, hostTradeId: plan.hostTradeId };
    }

    // Only categories that are still ACTIVE are kept (AC-2.2). A provider whose
    // every chosen category was deactivated since the lead was submitted gets no
    // listing rather than an uncategorised one; the approval itself stands.
    const activeCategories = await categoryModel.findActiveBySlugs(plan.categorySlugs, tx);
    if (activeCategories.length === 0) {
        logger.warn(
            { leadId: lead.id, categorySlugs: plan.categorySlugs },
            '[alliance-lead] none of the lead categories is active — listing must be created by hand'
        );
        return { provisioned: false, reason: 'no-active-category' };
    }
    if (!tx) {
        throw new Error('Provisioning a listing with categories requires a transaction');
    }

    // The slug lookup above is a plain read, so an approval can race a category
    // soft delete (or a group soft delete) and link a category that just went
    // away. Re-read the resolved ids FOR SHARE on the listing transaction: that
    // lock conflicts with the delete's FOR UPDATE, so one of the two waits and
    // sees the other's result. Deleted, inactive and deleted-group categories
    // are dropped here, the same rules a manual provider write applies.
    const candidateIds = activeCategories.map((category) => category.id);
    const locked = await categoryModel.findByIdsForShare(candidateIds, tx);
    const inDeletedGroups = new Set(await categoryModel.findIdsInDeletedGroups(candidateIds, tx));
    const linkableIds = locked
        .filter(
            (category) =>
                !category.deletedAt &&
                category.lifecycleState === LifecycleStatusEnum.ACTIVE &&
                !inDeletedGroups.has(category.id)
        )
        .map((category) => category.id);
    if (linkableIds.length === 0) {
        logger.warn(
            { leadId: lead.id, categorySlugs: plan.categorySlugs },
            '[alliance-lead] every lead category was deleted or deactivated meanwhile — listing must be created by hand'
        );
        return { provisioned: false, reason: 'no-active-category' };
    }

    const slug = await createUniqueSlug(plan.businessName, async (candidate) => {
        const existing = await hostTradeModel.findOne({ slug: candidate });
        return !!existing;
    });

    const created = await hostTradeModel.create(
        {
            slug,
            name: plan.businessName,
            contact: composeContact(lead),
            // The FINE PRINT, not the benefit. The benefit itself is the
            // structured pair below; this column holds the conditions that
            // accompany it, and an applicant who wrote none legitimately has
            // an empty one. Consumers must render the pair — reading this
            // column as "the benefit" is what the structured columns exist to
            // stop.
            benefit: lead.benefitText ?? '',
            benefitType: plan.benefitType,
            benefitValue: lead.benefitValue,
            destinationId: plan.destinationId,
            // The applicant may be null: an anonymous submission whose email
            // already had an account stays unlinked until the owner redeems
            // the claim token. The listing is still created — the claim
            // backfills the owner later — and until then the ownership filter
            // simply matches nobody.
            ownerUserId: lead.applicantUserId,
            isActive: true,
            createdById: actorId,
            updatedById: actorId
        },
        tx
    );

    await hostTradeModel.replaceCategories({
        hostTradeId: created.id,
        categoryIds: linkableIds,
        tx
    });

    logger.info(
        { leadId: lead.id, hostTradeId: created.id, ownerUserId: lead.applicantUserId },
        '[alliance-lead] provisioned host trade listing from approved lead'
    );

    return { provisioned: true, hostTradeId: created.id };
};
