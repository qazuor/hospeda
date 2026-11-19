/**
 * Partner type enum
 * Defines the type of partner entity
 *
 * @deprecated HOS-2336: replaced by the admin-managed `partner_types` catalog.
 * Still written to the legacy `partners.type` column during release N
 * (dual-write); deleted in the N+1 contract release.
 */
export enum PartnerTypeEnum {
    /** Commercial business partner */
    BUSINESS = 'business',
    /** Non-governmental organization partner */
    NGO = 'ngo',
    /** Institutional partner (government, university, etc.) */
    INSTITUTION = 'institution'
}
