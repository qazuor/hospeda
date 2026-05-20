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

import { AUTH_ME_CACHE_KEY } from '@/lib/auth-cache';
import { getApiUrl } from '@/lib/env';
import { addToast } from '@/store/toast-store';
import { useEffect } from 'react';

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
 * AuthedPreferenceSync — silent background sync for authenticated users.
 *
 * @example
 * ```astro
 * <AuthedPreferenceSync client:idle />
 * ```
 */
export function AuthedPreferenceSync(): null {
    useEffect(() => {
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
