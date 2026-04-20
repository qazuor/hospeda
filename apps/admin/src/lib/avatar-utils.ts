/**
 * Utility helpers for avatar rendering (initials, fallback derivation).
 */

/**
 * Arguments for {@link getInitialsFromName}.
 */
export interface GetInitialsFromNameArgs {
    /** Full name or display name of the user. */
    name?: string | null;
    /** Optional email — used as a fallback when name is empty. */
    email?: string | null;
    /** Maximum number of initial characters to return. Defaults to 2. */
    max?: number;
}

/**
 * Result returned by {@link getInitialsFromName}.
 */
export interface GetInitialsFromNameResult {
    /** Uppercase initials suitable for an AvatarFallback. Always non-empty. */
    initials: string;
}

/**
 * Derive uppercase initials from a name (or email) to display inside an
 * AvatarFallback. Falls back to the first character of the email local-part
 * when the name is empty, and to "?" when both inputs are missing.
 */
export const getInitialsFromName = (args: GetInitialsFromNameArgs): GetInitialsFromNameResult => {
    const { name, email, max = 2 } = args;
    const cap = Math.max(1, Math.floor(max));

    const cleaned = (name ?? '').trim();
    if (cleaned.length > 0) {
        const tokens = cleaned.split(/\s+/u).filter((t) => t.length > 0);
        const letters = tokens
            .slice(0, cap)
            .map((t) => t[0] ?? '')
            .join('')
            .toUpperCase();
        if (letters.length > 0) return { initials: letters };
    }

    const cleanedEmail = (email ?? '').trim();
    if (cleanedEmail.length > 0) {
        const local = cleanedEmail.split('@')[0] ?? '';
        const first = local[0] ?? '';
        if (first.length > 0) return { initials: first.toUpperCase() };
    }

    return { initials: '?' };
};
