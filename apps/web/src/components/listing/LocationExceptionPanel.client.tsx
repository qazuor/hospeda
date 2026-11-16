/**
 * @file LocationExceptionPanel.client.tsx
 * @description Status block of the Ubicacion section (HOS-2192), driven by the
 * protected projection's `locationException`: pending ("en revisión", no request
 * button), approved ("ya podés publicar"), rejected (the admin's reason plus a
 * button to ask again) and none (the request button next to the draft warning).
 *
 * A React island, rendered by the owner-scoped SSR editor pages: the per-user
 * state never reaches a cacheable page. After a successful request it flips to
 * "pending" without a reload.
 */

import type { LocationExceptionOwnerView } from '@repo/schemas';
import { type JSX, useState } from 'react';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import {
    canRequestLocationException,
    type LocationExceptionVertical,
    resolveLocationExceptionStatus
} from '@/lib/listing/location-exception';
import styles from './LocationExceptionRequest.module.css';
import { LocationExceptionRequestForm } from './LocationExceptionRequestForm.client';

/** Props of {@link LocationExceptionPanel}. */
export interface LocationExceptionPanelProps {
    readonly locale: SupportedLocale;
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
    /** The draft warning flag: another published listing of the owner holds this address. */
    readonly locationDuplicate: boolean;
    /** The projection's exception block (absent on older payloads). */
    readonly locationException?: LocationExceptionOwnerView | null;
}

/**
 * Render the exception status of a listing, or nothing when there is no
 * clash and no exception to report.
 *
 * @param props - See {@link LocationExceptionPanelProps}.
 */
export function LocationExceptionPanel({
    locale,
    vertical,
    listingId,
    locationDuplicate,
    locationException
}: LocationExceptionPanelProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const [sent, setSent] = useState(false);
    const [formOpen, setFormOpen] = useState(false);

    const resolved = resolveLocationExceptionStatus({ locationException });
    const status = sent ? 'pending' : resolved.status;

    if (status === 'approved') {
        return (
            <section
                className={`${styles.block} ${styles.approved}`}
                data-testid="location-exception-approved"
            >
                <p className={styles.message}>
                    {t(
                        'listing.owner.locationException.status.approved',
                        'Tu excepción de dirección fue aprobada: ya podés publicar esta ficha.'
                    )}
                </p>
            </section>
        );
    }

    if (status === 'approvedMove') {
        return (
            <section
                className={`${styles.block} ${styles.approved}`}
                data-testid="location-exception-approved-move"
            >
                <p className={styles.message}>
                    {t(
                        'listing.owner.locationException.status.approvedMove',
                        'Aprobado: ya podés guardar esa dirección.'
                    )}
                </p>
            </section>
        );
    }

    if (status === 'pending') {
        return (
            <section
                className={`${styles.block} ${styles.pending}`}
                data-testid="location-exception-pending"
            >
                <p
                    className={styles.message}
                    role="status"
                >
                    {t(
                        'listing.owner.locationException.status.pending',
                        'Tu pedido de excepción está en revisión. Te avisamos por email cuando tengamos una respuesta.'
                    )}
                </p>
            </section>
        );
    }

    const canRequest = canRequestLocationException({
        status,
        locationDuplicate,
        targetsNewAddress: resolved.targetsNewAddress
    });
    if (status === 'none' && !canRequest) return null;

    const decisionReason = resolved.decisionReason;
    return (
        <section
            className={`${styles.block} ${status === 'rejected' ? styles.rejected : ''}`}
            data-testid={
                status === 'rejected' ? 'location-exception-rejected' : 'location-exception-none'
            }
        >
            {status === 'rejected' && (
                <p
                    className={styles.message}
                    role="status"
                >
                    {decisionReason
                        ? t(
                              'listing.owner.locationException.status.rejected',
                              'Tu pedido de excepción fue rechazado. Motivo: {{reason}}',
                              { reason: decisionReason }
                          )
                        : t(
                              'listing.owner.locationException.status.rejectedNoReason',
                              'Tu pedido de excepción fue rechazado.'
                          )}
                </p>
            )}
            {canRequest && !formOpen && (
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={`${styles.button} ${styles.primary}`}
                        onClick={() => setFormOpen(true)}
                        data-testid="location-exception-open"
                    >
                        {status === 'rejected'
                            ? t('listing.owner.locationException.askAgainButton', 'Volver a pedir')
                            : t(
                                  'listing.owner.locationException.requestButton',
                                  'Pedir una excepción'
                              )}
                    </button>
                </div>
            )}
            {canRequest && formOpen && (
                <LocationExceptionRequestForm
                    locale={locale}
                    vertical={vertical}
                    listingId={listingId}
                    onSent={() => setSent(true)}
                    onCancel={() => setFormOpen(false)}
                />
            )}
        </section>
    );
}
