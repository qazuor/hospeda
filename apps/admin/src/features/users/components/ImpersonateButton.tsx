/**
 * ImpersonateButton Component
 *
 * Button that triggers user impersonation via Better Auth admin plugin.
 * Gated behind USER_IMPERSONATE permission.
 *
 * @module ImpersonateButton
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { useTranslations } from '@/hooks/use-translations';
import { authClient } from '@/lib/auth-client';
import { adminLogger } from '@/utils/logger';
import { UserSwitch } from '@phosphor-icons/react';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { useCallback, useState } from 'react';

export interface ImpersonateButtonProps {
    /** The user ID to impersonate */
    readonly userId: string;
    /** Visual variant of the button */
    readonly variant?: 'icon' | 'full';
}

/**
 * Button to impersonate a user. Shows a confirmation dialog before proceeding.
 * Only visible to users with USER_IMPERSONATE permission.
 */
export function ImpersonateButton({ userId, variant = 'icon' }: ImpersonateButtonProps) {
    const { t } = useTranslations();
    const [isLoading, setIsLoading] = useState(false);

    const handleImpersonate = useCallback(async () => {
        const confirmed = window.confirm(t('admin-common.impersonation.confirm' as TranslationKey));
        if (!confirmed) return;

        setIsLoading(true);
        try {
            const result = await authClient.admin.impersonateUser({ userId });
            if (result.error) {
                adminLogger.error('[Impersonate] Failed:', result.error);
                alert(t('admin-common.impersonation.error' as TranslationKey));
                setIsLoading(false);
                return;
            }
            // Clear cached session so AuthContext re-fetches permissions for the impersonated user
            sessionStorage.removeItem('hospeda_user_session');
            sessionStorage.removeItem('hospeda_session_timestamp');
            // Redirect to dashboard so the impersonated user starts from their home view
            window.location.href = '/dashboard';
        } catch (error) {
            adminLogger.error('[Impersonate] Unexpected error:', error);
            alert(t('admin-common.impersonation.error' as TranslationKey));
            setIsLoading(false);
        }
    }, [userId, t]);

    return (
        <PermissionGate permissions={[PermissionEnum.USER_IMPERSONATE]}>
            {variant === 'full' ? (
                <button
                    type="button"
                    onClick={handleImpersonate}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 text-sm transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                >
                    <UserSwitch size={16} />
                    {t('admin-common.impersonation.start' as TranslationKey)}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleImpersonate}
                    disabled={isLoading}
                    title={t('admin-common.impersonation.start' as TranslationKey)}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-amber-100 hover:text-amber-900 disabled:opacity-50 dark:hover:bg-amber-950 dark:hover:text-amber-200"
                >
                    <UserSwitch size={16} />
                </button>
            )}
        </PermissionGate>
    );
}
