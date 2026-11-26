import { resetUser } from '@/lib/analytics/umami-client';
import { clearCachedAuthMe } from '@/lib/auth-cache';
import { signOut } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { clearThemeSyncMarker } from '@/lib/theme';
import { buildUrl } from '@/lib/urls';

/** End the session, clearing shared identity state before returning home. */
export async function signOutFromNavigation({
    locale
}: {
    readonly locale: SupportedLocale;
}): Promise<void> {
    try {
        clearCachedAuthMe();
        resetUser();
        clearThemeSyncMarker();
        await signOut();
    } finally {
        window.location.href = buildUrl({ locale, path: '/' });
    }
}
