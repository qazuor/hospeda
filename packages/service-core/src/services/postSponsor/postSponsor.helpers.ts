/**
 * @fileoverview Helper functions for PostSponsor entities.
 * Contains utility functions for sponsor-related operations.
 */

/**
 * Validates sponsor contact information.
 * Checks that at least one contact method is present.
 *
 * @param contact - Contact information to validate
 * @returns Whether the contact info is valid (has at least one contact method)
 */
export const validateSponsorContact = (contact: unknown): boolean => {
    if (!contact || typeof contact !== 'object') return false;
    const c = contact as Record<string, unknown>;
    return !!(c.email || c.phone || c.personalEmail || c.workEmail || c.mobilePhone);
};

/**
 * Normalizes sponsor social media links.
 * Trims all string values in the social media information object.
 *
 * @param social - Raw social media information object
 * @returns Normalized social media information with trimmed string values
 *
 * @example
 * ```typescript
 * const normalized = normalizeSocialInfo({
 *   twitter: '  @company  ',
 *   linkedin: ' linkedin.com/company/test '
 * });
 * // Result: { twitter: '@company', linkedin: 'linkedin.com/company/test' }
 * ```
 */
export const normalizeSocialInfo = (social: unknown): unknown => {
    if (!social || typeof social !== 'object') return social;
    const normalized = { ...(social as Record<string, unknown>) };
    for (const [key, value] of Object.entries(normalized)) {
        if (typeof value === 'string') {
            normalized[key] = value.trim();
        }
    }
    return normalized;
};
