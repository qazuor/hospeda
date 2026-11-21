import type { SupportedLocale } from '../i18n';
import { toRegionalLocaleTag } from '../i18n';

/** Formats the public join date for the host summary, without inventing a date when absent. */
export function formatHostSince({
    ownerJoinedAt,
    locale
}: {
    readonly ownerJoinedAt: string | Date | null;
    readonly locale: SupportedLocale;
}): { readonly since: string | null } {
    if (ownerJoinedAt === null) return { since: null };
    const joinedAt = new Date(ownerJoinedAt);
    if (!Number.isFinite(joinedAt.getTime())) return { since: null };
    return {
        since: new Intl.DateTimeFormat(toRegionalLocaleTag({ locale }), {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(joinedAt)
    };
}
