/**
 * @file ProfileCompletion.helpers.ts
 * @description Helpers, constants, and types for `ProfileCompletion.client.tsx`
 * (SPEC-113 T-113-04). Extracted to keep the island file under the 500-line
 * limit and to make the validation logic separately testable.
 */

import { InternationalPhoneRegex } from '@repo/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Validated field errors keyed by field name.
 * Includes new fields from the refactored form (firstName, lastName, etc.).
 */
export type ProfileCompletionFieldErrors = Partial<
    Record<
        | 'firstName'
        | 'lastName'
        | 'birthDate'
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

/**
 * Computes the initial value for the display-name override input. The override
 * is only seeded with the session display name when there is NO separate
 * `firstName` to derive it from. Once a `firstName` pre-fill is present (e.g. a
 * Google sign-up where the full name was split into first/last),
 * {@link computeDisplayName} auto-derives the display name from
 * firstName + lastName, so the override must start empty and not shadow that
 * derivation.
 *
 * This is the keystone of the B1 fix: passing `initialFirstName` must leave the
 * override empty, otherwise the display name would freeze to the raw session
 * name instead of tracking edits to the first/last name inputs.
 *
 * @param initialDisplayName - Full display name from the session (may be empty).
 * @param initialFirstName - First-name pre-fill, if any (may be empty).
 * @returns The override seed; empty string whenever a `firstName` is present.
 */
export function computeInitialDisplayNameOverride({
    initialDisplayName,
    initialFirstName
}: {
    readonly initialDisplayName: string;
    readonly initialFirstName: string;
}): string {
    return initialDisplayName && !initialFirstName ? initialDisplayName : '';
}

/**
 * Splits a full display name (e.g. the single `name` string an OAuth provider
 * such as Google exposes) into a `{ firstName, lastName }` pair used to
 * pre-fill the profile completion form. The first whitespace-delimited token
 * becomes the first name and the remainder becomes the last name. Returns empty
 * strings when there is nothing to split, so the inputs fall back to blank.
 *
 * Heuristic by design: providers hand us only a single full-name string, so
 * compound names ("María José García") split imperfectly and the user can edit
 * them. This only seeds the inputs; it never blocks submission or overrides a
 * value the user already typed.
 *
 * @param fullName - The provider/display full name (may be empty or undefined).
 * @returns Trimmed `{ firstName, lastName }`; both empty when the input is blank.
 */
export function splitFullName({ fullName }: { readonly fullName?: string }): {
    readonly firstName: string;
    readonly lastName: string;
} {
    const normalized = (fullName ?? '').trim().replace(/\s+/g, ' ');
    if (!normalized) return { firstName: '', lastName: '' };
    const spaceIdx = normalized.indexOf(' ');
    if (spaceIdx === -1) return { firstName: normalized, lastName: '' };
    return {
        firstName: normalized.slice(0, spaceIdx),
        lastName: normalized.slice(spaceIdx + 1)
    };
}

/**
 * Parses a `dd/mm/yyyy` string into a `Date`, returning `null` when the string
 * is not a complete, calendar-valid date. Rejects roll-overs like `31/02/2000`
 * (which JS would otherwise silently coerce to early March).
 *
 * Single source of truth shared by the birth-date input (masking/picker) and
 * the submit-time validation, so both agree on what "a valid date" means.
 *
 * @param value - User-typed value in `dd/mm/yyyy` format.
 * @returns A `Date` for a valid calendar date, otherwise `null`.
 */
export function ddmmyyyyToDate(value: string): Date | null {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    // Reject roll-overs like 31/02 → 03/03.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Input shape for `validateProfileCompletionFields`.
 */
export interface ProfileCompletionValidationInput {
    readonly firstName: string;
    readonly lastName: string;
    readonly phone: string;
    readonly birthDate?: string;
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
    const { firstName, lastName, phone, birthDate, acceptedTerms, bio, website, occupation } =
        input;

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

    // Use the canonical E.164 regex from @repo/schemas so client validation
    // can never drift from what CompleteProfileBodySchema enforces server-side.
    // Strip spaces/dashes/parens first — the picker + number input let users
    // type those for readability, and buildPhone() removes them before sending.
    if (phone.trim() && !InternationalPhoneRegex.test(phone.replace(/[\s\-().]/g, ''))) {
        errors.phone = 'format';
    }

    // birthDate is optional, but if the user typed something it must be a
    // complete, calendar-valid dd/mm/yyyy date. Otherwise the server rejects
    // the ISO string with a generic 422 and the field gets no error marker.
    if (
        birthDate !== undefined &&
        birthDate.trim().length > 0 &&
        ddmmyyyyToDate(birthDate) === null
    ) {
        errors.birthDate = 'invalid';
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
