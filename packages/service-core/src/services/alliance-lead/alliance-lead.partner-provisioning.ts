import type { PartnerModel, PartnerTypeModel, SelectAllianceLead } from '@repo/db';
import type { ILogger } from '@repo/logger';
import {
    type AllianceLeadPartnerProvisionSkipReason,
    LifecycleStatusEnum,
    type Partner,
    PartnerTypeSlugSchema
} from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';
import { legacyPartnerTypeFor } from '../partner-type/partner-type.helpers';

/**
 * @file alliance-lead.partner-provisioning.ts
 * @description Materializes a `partners` row from an approved `partner`
 * alliance lead (HOS-278 §6.5).
 *
 * The `partner` counterpart of `alliance-lead.provisioning.ts`, and deliberately
 * NOT folded into it. The two programs provision on different triggers: a
 * `service_provider` listing is created by the approval itself, while a partner
 * row is created by a SECOND, explicit admin action (§6.5 OQ-1). Sharing one
 * entry point would mean either approving a partner silently creates a row, or
 * approving a provider stops doing so — both are behavior changes nobody asked
 * for.
 */

/** Everything partner provisioning needs, in one shape. */
export interface ProvisionPartnerInput {
    /** The lead row being provisioned. Must already be `approved`. */
    readonly lead: SelectAllianceLead;
    /** Model used to look up slugs and insert the partner. */
    readonly partnerModel: PartnerModel;
    /**
     * Partner type catalog (HOS-2336). The lead's `partnerType` slug is
     * re-validated against ACTIVE types here, at approval time (spec D3).
     */
    readonly partnerTypeModel: PartnerTypeModel;
    /** The admin performing the action — recorded as the row's creator. */
    readonly actorId: string;
    /** Logger for the skip paths, which are silent by design but not invisible. */
    readonly logger: ILogger;
    /** Transaction to enlist in, when the caller opened one. */
    readonly tx?: Parameters<PartnerModel['create']>[1];
}

/**
 * Why provisioning did not produce a partner row, when it did not. Derived
 * from the closed `@repo/schemas` set so the API response enum and this type
 * cannot drift. `no-active-partner-type`: the lead's `partnerType` slug names
 * no ACTIVE, non-deleted type at approval time, because it was deactivated or
 * deleted after the lead was submitted (HOS-2336 AC-2.2). The lead is still
 * approved; no partner is created.
 */
export type PartnerProvisionSkipReason = AllianceLeadPartnerProvisionSkipReason;

/**
 * What provisioning this lead will produce, decided WITHOUT touching the
 * database.
 *
 * Separated from the execution below for the same reason its host-trade
 * sibling is: the caller consults it to decide whether to open a transaction
 * at all, and a single source for the skip conditions is what stops the
 * transaction decision and the write path from disagreeing.
 */
export type PartnerProvisionPlan =
    | {
          readonly kind: 'skip';
          readonly reason: PartnerProvisionSkipReason;
          readonly partnerId?: string;
      }
    | {
          readonly kind: 'provision';
          readonly organizationName: string;
          /**
           * The catalog slug the lead declared. Whether it is still an ACTIVE
           * type is NOT known here (this function is pure); the execution
           * resolves it and may still skip with `no-active-partner-type`.
           */
          readonly typeSlug: string;
      };

/**
 * Decides what provisioning this lead should produce.
 *
 * Pure: reads the row it is handed and nothing else.
 *
 * @param lead - The lead row being provisioned.
 * @returns Either the data a partner row needs, or why there will be none.
 */
export const resolvePartnerProvisionPlan = (lead: SelectAllianceLead): PartnerProvisionPlan => {
    if (lead.kind !== 'partner') {
        return { kind: 'skip', reason: 'not-a-partner' };
    }

    if (lead.provisionedPartnerId) {
        return {
            kind: 'skip',
            reason: 'already-provisioned',
            partnerId: lead.provisionedPartnerId
        };
    }

    // NARROWED to the slug shape, not merely checked for presence. Whether the
    // slug still names an ACTIVE catalog type is a database question, answered
    // by `provisionPartnerFromLead` under a FOR SHARE lock (HOS-2336).
    const type = PartnerTypeSlugSchema.safeParse(lead.partnerType);

    // `businessName` is checked here rather than trusted, because the backend
    // create schema does NOT require it for `partner` — only the web form does
    // (`REQUIRED_PARTNER_FIELDS` carries `partnerType` alone). A lead submitted
    // straight to the API can therefore be a perfectly valid `partner` row with
    // no name at all, and `partners.name` is NOT NULL.
    if (!lead.businessName || !type.success) {
        return { kind: 'skip', reason: 'legacy-lead-without-typed-fields' };
    }

    return {
        kind: 'provision',
        organizationName: lead.businessName,
        typeSlug: type.data
    };
};

/** Outcome of a partner provisioning attempt. */
export type ProvisionPartnerResult =
    | { readonly provisioned: true; readonly partnerId: string }
    | {
          readonly provisioned: false;
          readonly reason: PartnerProvisionSkipReason;
          readonly partnerId?: string;
      };

/**
 * Provisions the `partners` row for an approved partner lead.
 *
 * Returns a discriminated result rather than throwing on the skip paths, for
 * the same reason the host-trade sibling does: none of them is an error the
 * admin should see.
 *
 * The three skips:
 *
 * - **not-a-partner** — the other three programs are provisioned elsewhere or
 *   by hand.
 * - **already-provisioned** — the lead already carries a
 *   `provisionedPartnerId`. Pressing the button twice must not mint a second
 *   organization: `createUniqueSlug` would happily name it `acme-2` and the
 *   directory would show the same partner twice, with no error anywhere to
 *   notice.
 * - **legacy-lead-without-typed-fields** — a lead with no usable
 *   `businessName`/`partnerType`, whose answers live inside `message` as prose.
 *   There is nothing to build a NOT NULL row from. These keep the pre-HOS-278
 *   behavior: the admin creates the partner by hand. Refusing outright would
 *   strand every partner lead already sitting in the inbox.
 * - **no-active-partner-type** — the lead's type slug was deactivated or
 *   deleted after submission (HOS-2336 AC-2.2). Logged at `warn` with the lead
 *   id and slug; the admin picks a type and creates the partner by hand.
 *
 * The row is created DORMANT — `lifecycleState: DRAFT`. Public visibility
 * requires `ACTIVE`, so a provisioned partner is invisible until an admin
 * activates it; provisioning grants an account something to fill in, not a
 * published listing.
 *
 * @param input - See {@link ProvisionPartnerInput}.
 * @returns Whether a partner was created, and its id when one was.
 */
export const provisionPartnerFromLead = async ({
    lead,
    partnerModel,
    partnerTypeModel,
    actorId,
    logger,
    tx
}: ProvisionPartnerInput): Promise<ProvisionPartnerResult> => {
    const plan = resolvePartnerProvisionPlan(lead);

    if (plan.kind === 'skip') {
        if (plan.reason === 'already-provisioned') {
            logger.info(
                { leadId: lead.id, partnerId: plan.partnerId },
                '[alliance-lead] partner already provisioned — action is a no-op'
            );
        } else if (plan.reason === 'legacy-lead-without-typed-fields') {
            logger.warn(
                { leadId: lead.id },
                '[alliance-lead] approved partner has no usable typed organization data — ' +
                    'legacy or API-submitted lead, partner must be created by hand'
            );
        }
        return { provisioned: false, reason: plan.reason, partnerId: plan.partnerId };
    }

    // FOR SHARE: a concurrent deactivation or delete of this type (which takes
    // FOR UPDATE) cannot commit between this check and the insert below.
    const partnerType = await partnerTypeModel.findActiveBySlugForShare(plan.typeSlug, tx);
    if (!partnerType) {
        logger.warn(
            { leadId: lead.id, partnerTypeSlug: plan.typeSlug },
            '[alliance-lead] approved partner lead names a partner type that is no longer ' +
                'active — lead approved, partner must be created by hand'
        );
        return { provisioned: false, reason: 'no-active-partner-type' };
    }

    const slug = await createUniqueSlug(plan.organizationName, async (candidate) => {
        const existing = await partnerModel.findOne({ slug: candidate });
        return !!existing;
    });

    const created = await partnerModel.create(
        {
            slug,
            name: plan.organizationName,
            // Dual-write (HOS-2336 release N): the catalog id, plus the legacy
            // enum value when the slug has one (`null` for e.g. `media`).
            typeId: partnerType.id,
            type: legacyPartnerTypeFor({ slug: partnerType.slug }),
            lifecycleState: LifecycleStatusEnum.DRAFT,
            // The applicant may be null: an anonymous submission whose email
            // already had an account stays unlinked until the owner redeems the
            // claim token. The partner is still created — the claim backfills
            // the owner later — and until then the ownership filter matches
            // nobody.
            ownerUserId: lead.applicantUserId,
            createdById: actorId,
            updatedById: actorId
        } as Partial<Partner>,
        tx
    );

    logger.info(
        { leadId: lead.id, partnerId: created.id, ownerUserId: lead.applicantUserId },
        '[alliance-lead] provisioned partner from approved lead'
    );

    return { provisioned: true, partnerId: created.id };
};
