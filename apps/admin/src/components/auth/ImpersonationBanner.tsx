/**
 * ImpersonationBanner Component
 *
 * Displays a sticky banner when the current admin is impersonating another user.
 * Shows the impersonated user's name and provides a button to stop impersonating.
 *
 * @module ImpersonationBanner
 */

import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { authClient } from '@/lib/auth-client';
import type { TranslationKey } from '@repo/i18n';
import { AlertTriangleIcon, CloseIcon } from '@repo/icons';
import { useCallback, useState } from 'react';

/**
 * Banner shown at the top of the layout when impersonation is active.
 *
 * Checks `impersonatedBy` from AuthContext to determine
 * if the current session is impersonated.
 *
 * @returns The banner JSX or null if not impersonating
 */
export function ImpersonationBanner() {
    const { t } = useTranslations();
    const { user, impersonatedBy } = useAuthContext();
    const [isLoading, setIsLoading] = useState(false);

    const isImpersonating = !!impersonatedBy;

    const handleStopImpersonating = useCallback(async () => {
        setIsLoading(true);
        try {
            await authClient.admin.stopImpersonating();
            // Clear cached session so AuthContext re-fetches permissions for the original user
            sessionStorage.removeItem('hospeda_user_session');
            sessionStorage.removeItem('hospeda_session_timestamp');
            // Redirect to users list so admin can continue managing users
            window.location.href = '/access/users';
        } catch {
            setIsLoading(false);
        }
    }, []);

    if (!isImpersonating) {
        return null;
    }

    const userName = user?.displayName ?? user?.email ?? 'Unknown';

    return (
        <div
            role="alert"
            className="sticky top-0 z-50 flex items-center justify-between gap-3 border-amber-300 border-b bg-amber-50 px-4 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
            <div className="flex items-center gap-2">
                <AlertTriangleIcon
                    size={16}
                    className="shrink-0"
                />
                <span className="font-medium text-sm">
                    {t('admin-common.impersonation.banner' as TranslationKey, { userName })}
                </span>
            </div>
            <button
                type="button"
                onClick={handleStopImpersonating}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-3 py-1 font-medium text-amber-900 text-xs transition-colors hover:bg-amber-200 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
            >
                <CloseIcon size={12} />
                {t('admin-common.impersonation.stop' as TranslationKey)}
            </button>
        </div>
    );
}
