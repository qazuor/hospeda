/**
 * @file AuthedPreferenceSync.client.tsx
 * @description Persists theme / locale changes to the authenticated user's
 * account on the backend.
 *
 * Listens for `preferences:change` events dispatched by `LanguageSwitcher`
 * and `ThemeControl`. When the visitor is authenticated (per the
 * `<html data-user-authenticated>` hint plus the cached `/auth/me`
 * snapshot in sessionStorage), it issues a `PATCH /api/v1/protected/users/{id}`
 * to update `settings.themeWeb` or `settings.languageWeb` on the user
 * record. Guests are ignored so they fall through to the
 * `GuestPreferenceNudge`.
 *
 * Failures show an error toast but do not roll back local state — the
 * change has already been applied to `localStorage` and `<html>` by the
 * primitive that emitted the event. A subsequent successful save will
 * reconcile.
 *
 * The component renders nothing.
 */

import { useEffect } from 'react';
import { AUTH_ME_CACHE_KEY } from '@/lib/auth-cache';
import { getApiUrl } from '@/lib/env';
import { isThemeSynced, markThemeSynced, syncSavedThemeChoice } from '@/lib/theme';
import { addToast } from '@/store/toast-store';

interface AuthMeSnapshot {
    readonly isAuthenticated: boolean;
    readonly user: { readonly id: string } | null;
}

interface PreferenceChangeDetail {
    readonly kind: 'theme' | 'locale';
    readonly value: string;
}

function readUserIdFromCache(): string | null {
    try {
        const raw = sessionStorage.getItem(AUTH_ME_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AuthMeSnapshot;
        if (!parsed.isAuthenticated || !parsed.user?.id) return null;
        return parsed.user.id;
    } catch {
        return null;
    }
}

function isAuthenticatedByAttribute(): boolean {
    return document.documentElement.getAttribute('data-user-authenticated') === 'true';
}

async function persistPreference(detail: PreferenceChangeDetail): Promise<void> {
    if (!isAuthenticatedByAttribute()) return;

    const userId = readUserIdFromCache();
    if (!userId) return;

    const body: Record<string, unknown> = {};
    if (detail.kind === 'theme') {
        // A signed-in toggle wins over the saved value for the rest of the
        // session, even if the PATCH below is still in flight on the next page.
        markThemeSynced({ userId });
        body.themeWeb = detail.value;
    } else if (detail.kind === 'locale') {
        body.languageWeb = detail.value;
    } else {
        return;
    }

    try {
        const apiUrl = getApiUrl().replace(/\/$/, '');
        const response = await fetch(`${apiUrl}/api/v1/protected/users/${userId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: body })
        });
        if (!response.ok) {
            throw new Error(`Server responded ${response.status}`);
        }
    } catch {
        addToast({
            type: 'error',
            message: 'No pudimos guardar tu preferencia. Volvé a intentarlo.'
        });
    }
}

/**
 * Loads the saved `settings.themeWeb` once per session and applies it
 * (HOS-1966). Silent on every failure: the local theme simply stays.
 */
async function loadSavedTheme(): Promise<void> {
    if (!isAuthenticatedByAttribute()) return;
    const userId = readUserIdFromCache();
    if (!userId || isThemeSynced({ userId })) return;

    try {
        const apiUrl = getApiUrl().replace(/\/$/, '');
        const response = await fetch(`${apiUrl}/api/v1/protected/users/${userId}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) return;
        const body = (await response.json()) as {
            data?: { settings?: { themeWeb?: unknown } | null } | null;
        };
        // The user may have toggled while the GET was in flight: re-check
        // inside the sync (it reads the marker) before anything is applied.
        syncSavedThemeChoice({ userId, savedChoice: body.data?.settings?.themeWeb });
    } catch {
        // Keep the local theme; the next page load retries.
    }
}

/**
 * AuthedPreferenceSync — silent background sync for authenticated users.
 *
 * @example
 * ```astro
 * <AuthedPreferenceSync client:idle />
 * ```
 */
export function AuthedPreferenceSync(): null {
    useEffect(() => {
        void loadSavedTheme();
        const handle = (event: Event) => {
            const detail = (event as CustomEvent<PreferenceChangeDetail>).detail;
            if (!detail) return;
            void persistPreference(detail);
        };
        window.addEventListener('preferences:change', handle);
        return () => {
            window.removeEventListener('preferences:change', handle);
        };
    }, []);

    return null;
}
