/**
 * ImpersonateButton Component
 *
 * Button that triggers user impersonation via Better Auth admin plugin.
 * Gated behind USER_IMPERSONATE permission.
 *
 * ## TEMPORARILY DISABLED — HOS-296 / re-enabled by HOS-354
 *
 * Impersonation is currently NON-FUNCTIONAL and the button is rendered
 * disabled on purpose. Dropping `users.role` (HOS-296) means Better Auth's
 * `admin()` plugin can no longer resolve a role for `hasPermission()`: it
 * falls back to `defaultRole`, decides `noAdminRole`, and every
 * `/api/auth/admin/*` route answers 403. The failure is CLOSED — nobody gains
 * access — but the affordance would promise something that cannot work, so it
 * is disabled with an explanatory tooltip instead of silently erroring.
 *
 * Nothing here is deleted: the click handler, the `impersonatedBy` plumbing in
 * `contexts/auth-context.tsx` and the banner in `AppLayout.tsx` all stay, and
 * **HOS-354** is the issue that restores impersonation on top of the role set.
 * Re-enabling should be a matter of flipping {@link IMPERSONATION_ENABLED}
 * once the Better Auth side resolves roles again.
 *
 * @see https://linear.app/hospeda-beta/issue/HOS-354
 * @module ImpersonateButton
 */

import type { TranslationKey } from '@repo/i18n';
import { UserSwitchIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { useCallback, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { type ToastContextValue, useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { authClient } from '@/lib/auth-client';
import { adminLogger } from '@/utils/logger';

/**
 * Master switch for the impersonation affordance.
 *
 * `false` until HOS-354 restores a working `/api/auth/admin/*` path. Kept as a
 * named constant rather than inlined so re-enabling is one edit and greps for
 * "impersonation disabled" land here.
 */
const IMPERSONATION_ENABLED = false;

export interface ImpersonateButtonProps {
    /** The user ID to impersonate */
    readonly userId: string;
    /**
     * Visual variant of the button.
     * - `icon`: only the icon (table rows).
     * - `full`: icon + label (detail headers on desktop).
     * - `responsive`: icon-only on small screens, icon + label on `sm` and up.
     */
    readonly variant?: 'icon' | 'full' | 'responsive';
}

/**
 * Runs the actual impersonation call and reports the outcome via toast.
 *
 * Extracted from the click handler (HOS-1198) so it can be exercised directly
 * in tests without depending on {@link IMPERSONATION_ENABLED} — the button
 * that triggers it stays disabled pending HOS-354, but the error-path
 * behavior (toast instead of a blocking `alert()`) still needs coverage.
 *
 * @param params - userId to impersonate, the toast dispatcher, and `t`.
 * @returns `{ success: true }` when impersonation started (the caller then
 * navigates away); `{ success: false }` when it failed and a toast was shown.
 */
export async function performImpersonation({
    userId,
    addToast,
    t
}: {
    userId: string;
    addToast: ToastContextValue['addToast'];
    t: (key: TranslationKey) => string;
}): Promise<{ success: boolean }> {
    try {
        const result = await authClient.admin.impersonateUser({ userId });
        if (result.error) {
            adminLogger.error('[Impersonate] Failed:', result.error);
            addToast({
                message: t('admin-common.impersonation.error' as TranslationKey),
                variant: 'error'
            });
            return { success: false };
        }
        // Clear cached session so AuthContext re-fetches permissions for the impersonated user
        sessionStorage.removeItem('hospeda_user_session');
        sessionStorage.removeItem('hospeda_session_timestamp');
        // Redirect to dashboard so the impersonated user starts from their home view
        window.location.href = '/dashboard';
        return { success: true };
    } catch (error) {
        adminLogger.error('[Impersonate] Unexpected error:', error);
        addToast({
            message: t('admin-common.impersonation.error' as TranslationKey),
            variant: 'error'
        });
        return { success: false };
    }
}

/**
 * Button to impersonate a user. Shows a confirmation dialog before proceeding.
 * Only visible to users with USER_IMPERSONATE permission.
 */
export function ImpersonateButton({ userId, variant = 'icon' }: ImpersonateButtonProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const handleImpersonateClick = useCallback(() => {
        setConfirmOpen(true);
    }, []);

    const handleConfirmImpersonate = useCallback(async () => {
        setConfirmOpen(false);
        setIsLoading(true);
        const { success } = await performImpersonation({ userId, addToast, t });
        // On success the page navigates away (window.location.href); only
        // reset the loading state on failure so the button doesn't flash
        // enabled again mid-redirect.
        if (!success) {
            setIsLoading(false);
        }
    }, [userId, addToast, t]);

    const label = t('admin-common.impersonation.start' as TranslationKey);
    // HOS-354: while disabled, the tooltip/aria label must say WHY — an inert
    // button with the normal label reads as a bug.
    const unavailableLabel = t('admin-common.impersonation.unavailable' as TranslationKey);
    const isDisabled = !IMPERSONATION_ENABLED || isLoading;
    const title = IMPERSONATION_ENABLED ? label : unavailableLabel;

    const confirmDialog = (
        <AlertDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{label}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin-common.impersonation.confirm' as TranslationKey)}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
                        {t('admin-common.impersonation.cancel' as TranslationKey)}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmImpersonate}>
                        {label}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    if (variant === 'icon') {
        return (
            <PermissionGate permissions={[PermissionEnum.USER_IMPERSONATE]}>
                <button
                    type="button"
                    onClick={handleImpersonateClick}
                    disabled={isDisabled}
                    title={title}
                    aria-label={title}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-warning/20 hover:text-warning disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UserSwitchIcon size={16} />
                </button>
                {confirmDialog}
            </PermissionGate>
        );
    }

    // `full` and `responsive` share the same chrome — only the label visibility
    // differs at the `sm` breakpoint.
    return (
        <PermissionGate permissions={[PermissionEnum.USER_IMPERSONATE]}>
            <button
                type="button"
                onClick={handleImpersonateClick}
                disabled={isDisabled}
                title={title}
                aria-label={title}
                className="inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 font-medium text-sm text-warning transition-colors hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
            >
                <UserSwitchIcon size={16} />
                <span className={variant === 'responsive' ? 'hidden sm:inline' : undefined}>
                    {IMPERSONATION_ENABLED ? label : unavailableLabel}
                </span>
            </button>
            {confirmDialog}
        </PermissionGate>
    );
}
