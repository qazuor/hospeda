/**
 * Client-side mirror of the data `resolveProvisionPlan` (service-core) needs to
 * create a provider from an alliance lead (HOS-2339).
 *
 * The retry button is only useful when this data exists. Without it the server
 * answers `legacy-lead-without-typed-fields` forever, and the admin would be
 * pressed to retry something that cannot succeed.
 */

import {
    type AllianceLead,
    HostTradeBenefitTypeEnumSchema,
    resolveLegacyCategorySlugs
} from '@repo/schemas';

/** The lead fields the provisioning decision reads. */
export type ProvisionableLeadFields = Pick<
    AllianceLead,
    'categorySlugs' | 'category' | 'businessName' | 'destinationId' | 'benefitType'
>;

/**
 * Category slugs a lead effectively chose: `categorySlugs` when set, else the
 * legacy `category` mapped through the same table the server uses.
 *
 * @param lead - The lead fields.
 * @returns The slugs, possibly empty.
 */
export function resolveLeadCategorySlugs(
    lead: Pick<AllianceLead, 'categorySlugs' | 'category'>
): readonly string[] {
    if (lead.categorySlugs && lead.categorySlugs.length > 0) return lead.categorySlugs;
    return resolveLegacyCategorySlugs(lead.category) ?? [];
}

/**
 * Whether the lead carries what automatic provisioning requires: a business
 * name, a destination, at least one category slug and a valid benefit type.
 *
 * @param lead - The lead fields.
 */
export function hasProvisionableData(lead: ProvisionableLeadFields): boolean {
    return (
        Boolean(lead.businessName) &&
        Boolean(lead.destinationId) &&
        resolveLeadCategorySlugs(lead).length > 0 &&
        HostTradeBenefitTypeEnumSchema.nullish().safeParse(lead.benefitType).success
    );
}
