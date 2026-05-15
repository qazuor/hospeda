/**
 * @file ProfileCompletion.helpers.ts
 * @description Helpers, constants, and types for `ProfileCompletion.client.tsx`
 * (SPEC-113 T-113-04). Extracted to keep the island file under the 500-line
 * limit and to make the validation logic separately testable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Validated field errors keyed by field name. */
export type ProfileCompletionFieldErrors = Partial<
    Record<'displayName' | 'firstName' | 'phone' | 'locale' | 'terms', string>
>;

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Phone country code options (limited set covering the primary markets:
 * Argentina, regional neighbors, USA/Canada, Spain, Mexico).
 */
export const COUNTRY_CODES = [
    { code: '+54', label: '🇦🇷 +54 (Argentina)' },
    { code: '+55', label: '🇧🇷 +55 (Brasil)' },
    { code: '+598', label: '🇺🇾 +598 (Uruguay)' },
    { code: '+56', label: '🇨🇱 +56 (Chile)' },
    { code: '+595', label: '🇵🇾 +595 (Paraguay)' },
    { code: '+1', label: '🇺🇸 +1 (USA/Canada)' },
    { code: '+34', label: '🇪🇸 +34 (España)' },
    { code: '+52', label: '🇲🇽 +52 (México)' }
] as const;

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates profile completion form fields client-side.
 * Mirrors server-side validation in `CompleteProfileBodySchema` from `@repo/schemas`.
 *
 * @param input - Form field values to validate
 * @returns Object keyed by field name with i18n error tokens (or empty object if valid)
 */
export function validateProfileCompletionFields({
    displayName,
    phone,
    acceptedTerms
}: {
    readonly displayName: string;
    readonly phone: string;
    readonly acceptedTerms: boolean;
}): ProfileCompletionFieldErrors {
    const errors: ProfileCompletionFieldErrors = {};

    if (!displayName.trim()) {
        errors.displayName = 'required';
    } else if (displayName.trim().length < 2) {
        errors.displayName = 'min';
    } else if (displayName.trim().length > 50) {
        errors.displayName = 'max';
    }

    if (phone.trim() && !/^\+\d{7,15}$/.test(phone.replace(/[\s\-().]/g, ''))) {
        errors.phone = 'format';
    }

    if (!acceptedTerms) {
        errors.terms = 'required';
    }

    return errors;
}
