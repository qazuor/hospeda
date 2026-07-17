/**
 * @file ProfileCompletion.helpers.ts
 * @description Helpers, constants, and types for `ProfileCompletion.client.tsx`
 * (SPEC-113 T-113-04). Extracted to keep the island file under the 500-line
 * limit and to make the computation logic separately testable.
 *
 * HOS-190 slice 3: the hand-rolled `validateProfileCompletionFields` (and its
 * `ProfileCompletionFieldErrors` token map) was removed in favor of the
 * shared `useZodForm` primitive validating the real API payload against
 * `CompleteProfileBodySchema` from `@repo/schemas` directly in
 * `ProfileCompletion.client.tsx`. This closed a real gap: the manual
 * validator never checked `socialNetworks.*` (the server requires `.url()`
 * per platform) or `displayName` length bounds.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payload sent to the API endpoint.
 *
 * `acceptedTerms` is typed as `boolean` (not `z.literal(true)`'s `true`) —
 * unlike the API's `CompleteProfileBody`, this is the pre-validation shape
 * built straight from form state, and the checkbox can legitimately be
 * unchecked when the user submits. `useZodForm`'s `validate()` runs it
 * through `CompleteProfileBodySchema` (whose `acceptedTerms` IS `z.literal(true)`)
 * and surfaces the rejection as a field error — see `ProfileCompletion.client.tsx`.
 */
export interface ProfileCompletionPayload {
    readonly firstName: string;
    readonly lastName: string;
    readonly displayName: string;
    readonly acceptedTerms: boolean;
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
