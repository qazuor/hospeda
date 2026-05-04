/**
 * @file avatar-utils.ts
 * @description Framework-agnostic helpers for rendering avatar fallbacks.
 *
 * Both Astro components and React islands need the same logic for deriving
 * initials from a display name (with an email fallback) when a user has not
 * uploaded an avatar image yet. Keeping the logic here, as pure functions,
 * means OwnerCard.astro, ReviewPreview.astro, AvatarUpload.client.tsx,
 * ReviewCard.tsx, UserMenu.client.tsx and MobileMenu.client.tsx all agree on
 * what "CR" vs "?" means.
 *
 * Previously duplicated across 5+ callsites with subtle differences (some
 * returned '?', some '', some 'U'). Consolidated in SPEC-078-GAPS T-049
 * (GAP-078-145 web part).
 */

/** Placeholder returned when neither a name nor an email is available. */
export const INITIALS_PLACEHOLDER = '?';

interface GetInitialsInput {
    /** Full display name (e.g. "Carlos Ramírez"). */
    readonly name?: string | null;
    /**
     * Optional email to fall back to when `name` is empty or whitespace.
     * Only the character before the `@` is considered; see {@link getInitials}.
     */
    readonly email?: string | null;
    /**
     * Custom placeholder for when nothing else resolves. Defaults to `"?"`.
     * Pass `""` if you prefer an empty string (MobileMenu does this today).
     */
    readonly placeholder?: string;
}

/**
 * Derive up to two uppercase initials from a display name, with an optional
 * email fallback.
 *
 * Rules (in order):
 *
 * 1. If `name` has two or more whitespace-separated tokens, return the first
 *    letter of the first token + first letter of the last token. Example:
 *    `"Carlos Alberto Ramírez"` → `"CR"`.
 * 2. If `name` has a single token, return its first two characters, uppercased.
 *    Example: `"carlos"` → `"CA"`.
 * 3. If `name` is empty/undefined and `email` is provided, return the first
 *    character of the local part (before `@`), uppercased. Example:
 *    `"jane.doe@example.com"` → `"J"`.
 * 4. Otherwise return `placeholder` (default `"?"`).
 *
 * Pure function. Safe for Astro SSR, React islands, and Node tests alike.
 *
 * @param input - `name`, optional `email`, optional `placeholder`.
 * @returns Uppercase initials, at most 2 characters long.
 *
 * @example
 * getInitials({ name: 'Carlos Ramírez' });          // 'CR'
 * getInitials({ name: 'carlos' });                  // 'CA'
 * getInitials({ name: '', email: 'j@x.com' });      // 'J'
 * getInitials({ name: '', email: '', placeholder: '' }); // ''
 * getInitials({});                                  // '?'
 */
export function getInitials(input: GetInitialsInput = {}): string {
    const { name, email, placeholder = INITIALS_PLACEHOLDER } = input;

    const trimmedName = name?.trim() ?? '';
    if (trimmedName.length > 0) {
        const parts = trimmedName.split(/\s+/);
        if (parts.length === 1) {
            return (parts[0] ?? '').slice(0, 2).toUpperCase();
        }
        const first = parts[0] ?? '';
        const last = parts[parts.length - 1] ?? '';
        return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }

    const trimmedEmail = email?.trim() ?? '';
    if (trimmedEmail.length > 0) {
        const local = trimmedEmail.split('@')[0] ?? trimmedEmail;
        if (local.length > 0) return local.charAt(0).toUpperCase();
    }

    return placeholder;
}

/**
 * Positional-argument convenience wrapper used by legacy callsites that only
 * pass the display name. Prefer the RO-RO form `getInitials({ name })` in new
 * code — this exists so we don't have to rewrite every consumer in one pass.
 *
 * @param name - Full display name.
 * @returns Uppercase initials (at most 2 characters).
 */
export function getInitialsFromName(name: string | undefined | null): string {
    return getInitials({ name: name ?? undefined });
}
