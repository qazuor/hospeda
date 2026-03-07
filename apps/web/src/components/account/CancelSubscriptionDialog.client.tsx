/**
 * @file CancelSubscriptionDialog.client.tsx
 * @description Confirmation dialog for cancelling a user subscription.
 * Shows a warning with a list of consequences before confirming the action.
 */

import { AlertTriangleIcon } from '@repo/icons';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { addToast } from '../../store/toast-store';
import { Modal } from '../ui/Modal.client';

/**
 * Props for the CancelSubscriptionDialog component.
 */
export interface CancelSubscriptionDialogProps {
    /** Whether the dialog is open */
    readonly open: boolean;
    /** Callback to close the dialog */
    readonly onClose: () => void;
    /** Subscription ID to cancel */
    readonly subscriptionId: string;
    /** Locale for i18n */
    readonly locale: SupportedLocale;
}

/** i18n keys for the list of consequences shown before cancellation */
const CONSEQUENCE_KEYS = [
    'subscription.cancelConsequence1',
    'subscription.cancelConsequence2',
    'subscription.cancelConsequence3'
] as const;

/**
 * Confirmation dialog for cancelling a subscription.
 *
 * Renders a warning icon and a bullet list of consequences,
 * then provides Cancel (go back) and Confirm buttons.
 * On confirmation it calls `billingApi.cancelSubscription` and
 * notifies the user via toast.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <CancelSubscriptionDialog
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   subscriptionId="sub_abc123"
 *   locale="es"
 * />
 * ```
 */
export function CancelSubscriptionDialog({
    open,
    onClose,
    subscriptionId,
    locale
}: CancelSubscriptionDialogProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    /** Handle cancellation confirmation */
    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            const result = await billingApi.cancelSubscription({ subscriptionId });
            if (result.ok) {
                addToast({ type: 'success', message: t('subscription.cancelSuccess') });
                onClose();
            } else {
                addToast({ type: 'error', message: t('subscription.cancelError') });
            }
        } catch {
            addToast({ type: 'error', message: t('subscription.cancelError') });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title={t('subscription.cancelTitle')}
            open={open}
            onClose={onClose}
        >
            <div className="space-y-6">
                {/* Warning icon and message */}
                <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-full bg-destructive/10 p-3">
                        <AlertTriangleIcon
                            size="md"
                            weight="fill"
                            className="text-destructive"
                            aria-hidden="true"
                        />
                    </div>
                    <div>
                        <p className="mb-3 font-medium text-foreground">
                            {t('subscription.cancelWarning')}
                        </p>
                        <ul className="space-y-2">
                            {CONSEQUENCE_KEYS.map((key) => (
                                <li
                                    key={key}
                                    className="flex items-center gap-2 text-muted-foreground text-sm"
                                >
                                    <span
                                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                                        aria-hidden="true"
                                    />
                                    {t(key)}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col-reverse gap-3 border-border border-t pt-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-md border border-border px-5 py-2.5 font-medium text-foreground text-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                    >
                        {t('subscription.cancelGoBack')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="rounded-md bg-destructive px-5 py-2.5 font-medium text-destructive-foreground text-sm transition-colors hover:bg-destructive/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive disabled:opacity-50"
                        aria-busy={isSubmitting}
                    >
                        {isSubmitting
                            ? `${t('subscription.cancelConfirmButton')}...`
                            : t('subscription.cancelConfirmButton')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
