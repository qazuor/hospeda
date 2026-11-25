/**
 * @file LocationExceptionRequestForm.client.tsx
 * @description Short "Pedir una excepción" form (HOS-2192): a reason of 10 to 500
 * characters with a counter, posted to the owner endpoint of the listing's
 * vertical. Shared by the Ubicacion section panel and the publish button (the
 * 409 `DUPLICATE_LOCATION` branch).
 */

import { LOCATION_EXCEPTION_REASON_MAX, LOCATION_EXCEPTION_REASON_MIN } from '@repo/schemas';
import type { JSX } from 'react';
import { useId } from 'react';
import { Button } from '@/components/account/ui/Button';
import { useLocationExceptionRequest } from '@/hooks/use-location-exception-request';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import type {
    LocationExceptionTarget,
    LocationExceptionVertical
} from '@/lib/listing/location-exception';
import styles from './LocationExceptionRequest.module.css';

/** Props of {@link LocationExceptionRequestForm}. */
export interface LocationExceptionRequestFormProps {
    readonly locale: SupportedLocale;
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
    /** The address the owner was trying to save (a request to move the listing there). */
    readonly location?: LocationExceptionTarget;
    /** Called once after the request was accepted. */
    readonly onSent?: () => void;
    /** Renders a cancel button when given. */
    readonly onCancel?: () => void;
}

/**
 * Render the request form. After a successful submit it shows the confirmation
 * line instead of the form.
 *
 * @param props - See {@link LocationExceptionRequestFormProps}.
 */
export function LocationExceptionRequestForm({
    locale,
    vertical,
    listingId,
    location,
    onSent,
    onCancel
}: LocationExceptionRequestFormProps): JSX.Element {
    const { t } = createTranslations(locale);
    const fieldId = useId();
    const form = useLocationExceptionRequest({ vertical, listingId, location, onSent });
    const limits = { min: LOCATION_EXCEPTION_REASON_MIN, max: LOCATION_EXCEPTION_REASON_MAX };

    if (form.phase === 'sent') {
        return (
            <p
                className={styles.message}
                role="status"
                data-testid="location-exception-sent"
            >
                {t(
                    'listing.owner.locationException.sent',
                    'Pedido enviado. Tu pedido de excepción está en revisión.'
                )}
            </p>
        );
    }

    const busy = form.phase === 'submitting';
    return (
        // Not a <form>: this component is mounted inside the listing editor's own
        // <form>, and nested forms are invalid HTML (the browser drops the inner one
        // and its submit button submits the OUTER editor form). The textarea is
        // multi-line, so Enter never submitted anyway.
        <div
            className={styles.form}
            data-testid="location-exception-form"
        >
            <p className={styles.title}>
                {t(
                    'listing.owner.locationException.form.title',
                    'Pedir una excepción de dirección'
                )}
            </p>
            <label
                className={styles.label}
                htmlFor={fieldId}
            >
                {t('listing.owner.locationException.form.reasonLabel', 'Motivo')}
            </label>
            <p className={styles.hint}>
                {t(
                    'listing.owner.locationException.form.reasonHint',
                    'Contanos por qué necesitás publicar esta ficha en una dirección que ya tiene otra ficha publicada tuya.'
                )}
            </p>
            <textarea
                id={fieldId}
                className={styles.textarea}
                value={form.reason}
                onChange={form.onReasonChange}
                disabled={busy}
                aria-invalid={form.validationKey !== null}
                data-testid="location-exception-reason"
            />
            <span
                className={styles.counter}
                data-testid="location-exception-counter"
            >
                {t(
                    'listing.owner.locationException.form.counter',
                    '{{count}} de {{max}} caracteres',
                    { count: form.length, max: LOCATION_EXCEPTION_REASON_MAX }
                )}
            </span>
            {form.validationKey && (
                <p
                    className={styles.error}
                    role="alert"
                    data-testid="location-exception-validation"
                >
                    {t(
                        `listing.owner.locationException.validation.${form.validationKey}`,
                        form.validationKey === 'tooShort'
                            ? 'El motivo debe tener al menos {{min}} caracteres.'
                            : 'El motivo no puede superar los {{max}} caracteres.',
                        limits
                    )}
                </p>
            )}
            {form.errorKey && (
                <p
                    className={styles.error}
                    role="alert"
                    data-testid="location-exception-error"
                >
                    {t(
                        `listing.owner.locationException.errors.${form.errorKey}`,
                        'No pudimos enviar el pedido. Probá de nuevo en un rato.',
                        limits
                    )}
                </p>
            )}
            <div className={styles.actions}>
                <Button
                    onClick={form.onSubmit}
                    loading={busy}
                >
                    {busy
                        ? t('listing.owner.locationException.form.submitting', 'Enviando...')
                        : t('listing.owner.locationException.form.submit', 'Enviar pedido')}
                </Button>
                {onCancel && (
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        {t('listing.owner.locationException.form.cancel', 'Cancelar')}
                    </Button>
                )}
            </div>
        </div>
    );
}
