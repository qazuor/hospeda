/**
 * @file TrialWarningDialog.client.tsx
 * @description The warn-and-confirm step in front of a checkout that would
 * destroy a running trial. HOS-1233 T-016 / AC-4.
 *
 * Measured on staging (`staging-tanda-2026-09-07`): an account three days into
 * a 30-day accommodation trial pressed "Empezar" and went straight to
 * MercadoPago. Nothing was asked, nothing was warned, and the remaining
 * twenty-seven days were about to be skipped in silence. This dialog is the
 * question that was missing.
 *
 * Three things it must keep saying, because each was measured as absent:
 *
 * 1. **The NUMBER of days.** "You will lose your trial" is a claim a visitor
 *    cannot price. `daysRemaining` is interpolated, and the caller only opens
 *    this dialog on the branch where that number is real — see below.
 * 2. **That the charge is immediate.** Since HOS-1012 the checkout is the paid
 *    path and nothing else: the first charge lands within minutes of the
 *    redirect (15:42:34 → 15:44:37 on the staging measurement). "Contratar"
 *    without that sentence reads like scheduling a future payment.
 * 3. **That cancelling costs nothing.** Cancel closes the dialog and returns to
 *    the page; no checkout is created and the subscription is untouched.
 *
 * ## `daysRemaining` is nullable and never rendered as zero
 *
 * `resolveTrialStartBranch` reaches the warning branch in two ways: a running
 * trial with days left, and an UNRESOLVED clock (AC-9 — an unknown answer warns
 * rather than charging silently). The second has no number to state, so the
 * body falls back to copy that promises no figure. F-9's rule holds either way:
 * a day count is optional and is never `0`.
 *
 * ## Why the shared `<Dialog>` and not a raw `<dialog>`
 *
 * `@/components/shared/ui/Dialog.client` already owns the portal, backdrop,
 * scroll lock, `Escape`, focus trap, focus restore and back-button handling,
 * and it renders a `<div>` panel — so none of the `dialog-panel` height rules
 * HOS-958 polices apply, and this module declares no `max-height` or `overflow`
 * of its own. Same call `PayerEmailConfirmDialog` made, for the same reasons.
 */

import type { JSX } from 'react';
import { useId } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './TrialWarningDialog.module.css';

/**
 * Props for {@link TrialWarningDialog}.
 */
export interface TrialWarningDialogProps {
    /** Controlled open state. When `false` the dialog renders nothing. */
    readonly isOpen: boolean;
    /** Current locale for translations. */
    readonly locale: SupportedLocale;
    /**
     * Whole days left on the running trial, or `null` when the clock could not
     * be resolved (AC-9's unknown case). Never `0`: the caller does not reach
     * this dialog with an exhausted trial, and copy that reads "0 días" is
     * exactly what F-9 forbids.
     */
    readonly daysRemaining: number | null;
    /** Called on Cancel, `Escape` or an overlay click — no checkout is started. */
    readonly onCancel: () => void;
    /** Called when the visitor accepts losing the days and continues to pay. */
    readonly onConfirm: () => void;
}

/**
 * Renders the "you are about to lose N trial days" confirmation.
 *
 * @param props - Open state, locale, the day count to name, and the two
 *   possible outcomes.
 * @returns The dialog element, or `null` while closed (via the shared `<Dialog>`).
 */
export function TrialWarningDialog({
    isOpen,
    locale,
    daysRemaining,
    onCancel,
    onConfirm
}: TrialWarningDialogProps): JSX.Element | null {
    const { t, tPlural } = createTranslations(locale);
    const titleId = useId();

    const title = t('pricing.trialWarning.title');
    // `> 0` and not `!== null`: a contradictory payload (a running trial
    // reporting zero or negative days) must take the same path as an
    // unresolved clock — warn, but promise no number — rather than render
    // "perdés 0 días", which reads as "this costs you nothing".
    const hasDayCount = daysRemaining !== null && daysRemaining > 0;
    const body = hasDayCount
        ? tPlural('pricing.trialWarning.body', daysRemaining, { count: daysRemaining })
        : t('pricing.trialWarning.bodyUnknown');
    const immediateCharge = t('pricing.trialWarning.immediateCharge');
    const confirmLabel = t('pricing.trialWarning.confirm');
    const cancelLabel = t('pricing.trialWarning.cancel');

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onCancel}
            ariaLabelledBy={titleId}
            size="sm"
        >
            <DialogHeader titleId={titleId}>{title}</DialogHeader>
            <DialogBody>
                <p
                    className={styles.body}
                    data-testid="trial-warning-days"
                >
                    {body}
                </p>
                <p className={styles.charge}>{immediateCharge}</p>
            </DialogBody>
            <DialogFooter>
                <button
                    type="button"
                    className={styles.cancelButton}
                    data-testid="trial-warning-cancel"
                    onClick={onCancel}
                >
                    {cancelLabel}
                </button>
                <button
                    type="button"
                    className={styles.confirmButton}
                    data-testid="trial-warning-confirm"
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </button>
            </DialogFooter>
        </Dialog>
    );
}
