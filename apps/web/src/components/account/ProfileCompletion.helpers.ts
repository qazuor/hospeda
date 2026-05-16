/**
 * @file ProfileCompletion.helpers.ts
 * @description Helpers, constants, and types for `ProfileCompletion.client.tsx`
 * (SPEC-113 T-113-04). Extracted to keep the island file under the 500-line
 * limit and to make the validation logic separately testable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Validated field errors keyed by field name.
 * Includes new fields from the refactored form (firstName, lastName, etc.).
 */
export type ProfileCompletionFieldErrors = Partial<
    Record<
        | 'firstName'
        | 'lastName'
        | 'displayName'
        | 'phone'
        | 'locale'
        | 'terms'
        | 'bio'
        | 'website'
        | 'occupation',
        string
    >
>;

/** Payload sent to the API endpoint. */
export interface ProfileCompletionPayload {
    readonly firstName: string;
    readonly lastName: string;
    readonly displayName: string;
    readonly acceptedTerms: true;
    readonly birthDate?: string;
    readonly imageUrl?: string;
    readonly phone?: string;
    readonly locale?: string;
    readonly newsletterOptIn?: boolean;
    readonly bio?: string;
    readonly website?: string;
    readonly occupation?: string;
    readonly socialNetworks?: Partial<Record<SocialPlatform, string>>;
    readonly location?: { country: string; region?: string; city?: string };
}

/** Supported social network platforms. */
export type SocialPlatform =
    | 'facebook'
    | 'instagram'
    | 'twitter'
    | 'linkedIn'
    | 'tiktok'
    | 'youtube';

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

/** Country options for the location section (brief onboarding set). */
export const LOCATION_COUNTRIES = [
    { code: 'AR', label: '🇦🇷 Argentina' },
    { code: 'UY', label: '🇺🇾 Uruguay' },
    { code: 'BR', label: '🇧🇷 Brasil' },
    { code: 'CL', label: '🇨🇱 Chile' },
    { code: 'PY', label: '🇵🇾 Paraguay' },
    { code: 'OTHER', label: '🌍 Otro' }
] as const;

/** Social platforms with their display labels. */
export const SOCIAL_PLATFORMS: readonly {
    key: SocialPlatform;
    label: string;
    placeholder: string;
}[] = [
    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/usuario' },
    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/usuario' },
    { key: 'twitter', label: 'X / Twitter', placeholder: 'https://twitter.com/usuario' },
    { key: 'linkedIn', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/usuario' },
    { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@usuario' },
    { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@usuario' }
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the display name from firstName + lastName unless the user has
 * explicitly overridden it.
 *
 * @param firstName - Trimmed first name.
 * @param lastName - Trimmed last name.
 * @param override - User-typed override (empty string = use auto-derived).
 * @returns The computed display name.
 */
export function computeDisplayName({
    firstName,
    lastName,
    override
}: {
    readonly firstName: string;
    readonly lastName: string;
    readonly override: string;
}): string {
    const auto = `${firstName.trim()} ${lastName.trim()}`.trim();
    return override.trim() || auto;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Input shape for `validateProfileCompletionFields`.
 */
export interface ProfileCompletionValidationInput {
    readonly firstName: string;
    readonly lastName: string;
    readonly phone: string;
    readonly acceptedTerms: boolean;
    readonly bio?: string;
    readonly website?: string;
    readonly occupation?: string;
}

/**
 * Validates profile completion form fields client-side.
 * Mirrors server-side validation in `CompleteProfileBodySchema` from `@repo/schemas`.
 *
 * @param input - Form field values to validate
 * @returns Object keyed by field name with i18n error tokens (or empty object if valid)
 */
export function validateProfileCompletionFields(
    input: ProfileCompletionValidationInput
): ProfileCompletionFieldErrors {
    const errors: ProfileCompletionFieldErrors = {};
    const { firstName, lastName, phone, acceptedTerms, bio, website, occupation } = input;

    if (!firstName.trim()) {
        errors.firstName = 'required';
    } else if (firstName.trim().length > 50) {
        errors.firstName = 'max';
    }

    if (!lastName.trim()) {
        errors.lastName = 'required';
    } else if (lastName.trim().length > 50) {
        errors.lastName = 'max';
    }

    if (phone.trim() && !/^\+\d{7,15}$/.test(phone.replace(/[\s\-().]/g, ''))) {
        errors.phone = 'format';
    }

    if (!acceptedTerms) {
        errors.terms = 'required';
    }

    if (bio !== undefined && bio.trim().length > 0) {
        if (bio.trim().length < 10) errors.bio = 'min';
        else if (bio.trim().length > 300) errors.bio = 'max';
    }

    if (website !== undefined && website.trim().length > 0) {
        try {
            new URL(website.trim());
        } catch {
            errors.website = 'url';
        }
    }

    if (occupation !== undefined && occupation.trim().length > 0) {
        if (occupation.trim().length < 2) errors.occupation = 'min';
        else if (occupation.trim().length > 100) errors.occupation = 'max';
    }

    return errors;
}
