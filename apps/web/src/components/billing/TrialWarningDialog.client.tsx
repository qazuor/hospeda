/**
 * @file TrialWarningDialog.client.tsx
 * @description Confirmation dialog warning that MercadoPago grants the free
 * trial once per (MercadoPago account, plan) pair — a rule Hospeda's own
 * trial-eligibility check cannot see, because that check is scoped to the
 * Hospeda customer, not to the MercadoPago account they end up paying with.
 * A user who already spent a trial on this plan with the same MP account
 * would otherwise see "N days free" on screen and get charged for the first
 * period within minutes (this happened in production with real money).
 *
 * Building a per-Hospeda-customer MercadoPago plan was evaluated and
 * rejected by the owner (unbounded plan-volume risk on MercadoPago's side).
 * The approved mitigation is to warn loudly, in a dialog the user must
 * explicitly confirm, before ever redirecting to MercadoPago.
 *
 * Extracted out of `PlanPurchaseButton.client.tsx` (already at the file's
 * 500-line soft ceiling) rather than added inline. Reuses the shared
 * `<Dialog>` primitive (`@/components/shared/ui/Dialog.client`) for the
 * portal, backdrop, scroll lock, `Escape`-to-close, focus trap and
 * focus-restore-on-close behaviour — none of that is reimplemented here.
 *
 * Rendered by `PlanPurchaseButton` only when the checkout in flight actually
 * promises a trial: `trialDays > 0` AND the user has not been marked
 * ineligible by `billingApi.getTrialEligibility()`. See that file's
 * `promisesTrial` gate for the exact condition.
 */

import type { JSX } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './TrialWarningDialog.module.css';

/** Element id used to associate the dialog panel with its visible title. */
const TITLE_ID = 'trial-warning-dialog-title';

/**
 * Props for {@link TrialWarningDialog}.
 */
export interface TrialWarningDialogProps {
    /** Controlled open state. When `false` the dialog renders nothing. */
    readonly isOpen: boolean;
    /** Current locale for translations. */
    readonly locale: SupportedLocale;
    /** Called on Cancel, `Escape`, or an overlay click — no checkout is started. */
    readonly onCancel: () => void;
    /** Called when the user explicitly accepts the warning and wants to continue to checkout. */
    readonly onConfirm: () => void;
}

/**
 * Renders the MercadoPago trial-eligibility warning dialog.
 *
 * @param props - Open state, locale, and the two possible outcomes.
 * @returns The dialog element (or `null` while closed, via the shared `<Dialog>`).
 */
export function TrialWarningDialog({
    isOpen,
    locale,
    onCancel,
    onConfirm
}: TrialWarningDialogProps): JSX.Element {
    const { t } = createTranslations(locale);

    const title = t(
        'billing.checkout.trialWarning.title',
        'La prueba gratis la otorga Mercado Pago'
    );
    const body = t(
        'billing.checkout.trialWarning.body',
        'Mercado Pago otorga el período de prueba una sola vez por cuenta y por plan. Si ya usaste una prueba de este plan con la misma cuenta de Mercado Pago, Mercado Pago va a cobrar el primer período al momento en lugar de aplicarte la prueba.'
    );
    const confirmLabel = t('billing.checkout.trialWarning.confirm', 'Entendido, continuar');
    const cancelLabel = t('billing.checkout.trialWarning.cancel', 'Cancelar');

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onCancel}
            ariaLabelledBy={TITLE_ID}
            size="sm"
        >
            {/* No header close button: the footer already carries an explicit
                Cancel action, and a second "Cancelar"-labelled control here
                would be indistinguishable from it by accessible name. Escape
                and the overlay click (both handled by the shared Dialog)
                remain available. */}
            <DialogHeader titleId={TITLE_ID}>{title}</DialogHeader>
            <DialogBody>
                <p className={styles.body}>{body}</p>
            </DialogBody>
            <DialogFooter>
                <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={onCancel}
                >
                    {cancelLabel}
                </button>
                <button
                    type="button"
                    className={styles.confirmButton}
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </button>
            </DialogFooter>
        </Dialog>
    );
}
