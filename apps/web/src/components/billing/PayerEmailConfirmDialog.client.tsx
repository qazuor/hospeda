/**
 * @file PayerEmailConfirmDialog.client.tsx
 * @description Pre-redirect confirmation dialog for the MercadoPago payer
 * email (HOS-937 step 2, spec §8.1).
 *
 * The `payer_email` bound to a MercadoPago preapproval is BINDING: only
 * whoever uses or types that exact email can authorize the charge, and
 * MercadoPago never shows the user which email it expects — it just says
 * "contact the seller". Before this dialog, a user who tried to pay with a
 * different MercadoPago account than the one Hospeda resolved simply
 * couldn't pay, with no way to find out why.
 *
 * Shown once, right before `/start-paid` is called, pre-filled with the
 * best local guess (the session's account email). Zero extra fields for
 * whoever's email already matches — one click through. Editing the value
 * here overrides the server's own resolution (spec §6.3): whatever is
 * confirmed is sent as `payerEmail` on the checkout request and wins over
 * both `billing_customers.mp_payer_email` and `.email`.
 *
 * Extracted out of `PlanPurchaseButton.client.tsx` for the same reason as
 * `TrialWarningDialog.client.tsx` (already at the file's 500-line soft
 * ceiling) — reuses the shared `<Dialog>` primitive
 * (`@/components/shared/ui/Dialog.client`) for the portal, backdrop, scroll
 * lock, `Escape`-to-close, focus trap and focus-restore-on-close behaviour.
 */

import type { JSX } from 'react';
import { useEffect, useId, useState } from 'react';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PayerEmailConfirmDialog.module.css';

/** Same permissive format check the server applies (`z.string().email()`). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * MercadoPago rejects a `payer_email` containing `+` outright, answering
 * `User bad request` with no field name and no error code (HOS-937,
 * isolated against a negative control: it is the CHARACTER, not the Gmail
 * alias). Since `payer_email` became binding, that rejection kills the whole
 * checkout, so the address has to be corrected here — before the redirect —
 * rather than at MercadoPago, which never says which email it expected.
 *
 * This is the front half of HOS-937 §11 OQ-1 (resolved as option 1: ask for
 * an alternative). `resolvePayerEmail` (`apps/api/src/services/billing/payer-email.ts`)
 * keeps throwing `PAYER_EMAIL_UNSUPPORTED_CHARACTER` as defense in depth for
 * any caller that does not come through this dialog.
 *
 * Deliberately NOT auto-corrected: `sanitizeEmailForMercadoPago`
 * (`apps/api/src/utils/mp-email.ts`) rewrites `+` to `.` and its own docblock
 * documents that the result is very likely a DEAD MAILBOX (Gmail ignores
 * dots, so `user.tag@gmail.com` collapses to `usertag@gmail.com`, which is
 * not `user@gmail.com`). Here that would be worse than elsewhere: this exact
 * string is what the user must later type at MercadoPago, so silently
 * rewriting it hands them an address they never wrote and cannot pay with.
 */
const MP_REJECTED_CHARACTER = '+';

/**
 * Props for {@link PayerEmailConfirmDialog}.
 */
export interface PayerEmailConfirmDialogProps {
    /** Controlled open state. When `false` the dialog renders nothing. */
    readonly isOpen: boolean;
    /** Current locale for translations. */
    readonly locale: SupportedLocale;
    /**
     * The best local guess to pre-fill the field with (the session's
     * account email). The server resolves the actual default independently
     * (spec §6.3) — this is only a starting point for editing.
     */
    readonly defaultEmail: string;
    /** Called on Cancel, `Escape`, or an overlay click — no checkout is started. */
    readonly onCancel: () => void;
    /** Called with the confirmed (possibly edited) email when the user continues. */
    readonly onConfirm: (email: string) => void;
}

/**
 * Renders the pre-redirect payer-email confirmation dialog.
 *
 * @param props - Open state, locale, the pre-fill default, and the two
 *   possible outcomes.
 * @returns The dialog element (or `null` while closed, via the shared `<Dialog>`).
 */
export function PayerEmailConfirmDialog({
    isOpen,
    locale,
    defaultEmail,
    onCancel,
    onConfirm
}: PayerEmailConfirmDialogProps): JSX.Element {
    const { t } = createTranslations(locale);
    const inputId = useId();
    const errorId = useId();
    const titleId = useId();

    const [value, setValue] = useState(defaultEmail);
    const [touched, setTouched] = useState(false);

    // Re-seed from `defaultEmail` every time the dialog opens — this
    // component is mounted once by the parent and toggled via `isOpen`, so
    // `useState(defaultEmail)` alone would only capture the FIRST open's
    // value and go stale on a later checkout attempt with a different guess
    // (e.g. after the session resolves, or a different plan button).
    useEffect(() => {
        if (isOpen) {
            setValue(defaultEmail);
            setTouched(false);
        }
    }, [isOpen, defaultEmail]);

    const trimmed = value.trim();
    const hasRejectedCharacter = trimmed.includes(MP_REJECTED_CHARACTER);
    const isValid = EMAIL_PATTERN.test(trimmed) && !hasRejectedCharacter;
    // A `+` error surfaces WITHOUT waiting for `touched`: the value that
    // carries it is usually the one WE pre-filled from the session, so the
    // user has no reason to touch the field and would otherwise only learn
    // it is a problem by pressing Continue and having nothing happen.
    const showError = (touched || hasRejectedCharacter) && !isValid;

    const title = t('billing.checkout.payerEmailConfirm.title', 'Con qué email vas a poder pagar');
    const body = t(
        'billing.checkout.payerEmailConfirm.body',
        'Mercado Pago solo te va a dejar pagar con este email exacto. Si querés usar otra cuenta de Mercado Pago, cambialo antes de continuar.'
    );
    const label = t('billing.checkout.payerEmailConfirm.label', 'Email de pago');
    const invalidError = t(
        'billing.checkout.payerEmailConfirm.invalidError',
        'Ingresá un email válido'
    );
    // Deliberately a DIFFERENT message from `invalidError`: the address is
    // perfectly valid, so "enter a valid email" would tell the user nothing
    // and leave them retyping the same thing.
    const plusError = t(
        'billing.checkout.payerEmailConfirm.plusError',
        'Mercado Pago no acepta emails con «+». Escribí otra dirección para poder pagar.'
    );
    const errorMessage = hasRejectedCharacter ? plusError : invalidError;
    const confirmLabel = t('billing.checkout.payerEmailConfirm.confirm', 'Continuar');
    const cancelLabel = t('billing.checkout.payerEmailConfirm.cancel', 'Cancelar');

    function handleConfirm(): void {
        setTouched(true);
        // Guards on `isValid`, not on the format alone — otherwise a
        // `+`-bearing address passes here and dies at MercadoPago with an
        // opaque "User bad request" the user cannot act on.
        if (!isValid) {
            return;
        }
        onConfirm(trimmed);
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onCancel}
            ariaLabelledBy={titleId}
            size="sm"
        >
            <DialogHeader titleId={titleId}>{title}</DialogHeader>
            <DialogBody>
                <p className={styles.body}>{body}</p>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor={inputId}
                    >
                        {label}
                    </label>
                    <input
                        id={inputId}
                        type="email"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        onBlur={() => setTouched(true)}
                        className={`${styles.input}${showError ? ` ${styles.inputError}` : ''}`}
                        autoComplete="email"
                        aria-describedby={showError ? errorId : undefined}
                        aria-invalid={showError}
                    />
                    {showError && (
                        <p
                            id={errorId}
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    )}
                </div>
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
                    onClick={handleConfirm}
                >
                    {confirmLabel}
                </button>
            </DialogFooter>
        </Dialog>
    );
}
