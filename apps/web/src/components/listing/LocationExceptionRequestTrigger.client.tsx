/**
 * @file LocationExceptionRequestTrigger.client.tsx
 * @description "Pedir una excepción" shown under a refused location save
 * (HOS-2192, D-23): the PATCH of a PUBLISHED listing answered 409
 * `DUPLICATE_LOCATION`. The request carries the address the owner was TRYING to
 * save (the server recomputes the key from it; a key is never sent).
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import type {
    LocationExceptionTarget,
    LocationExceptionVertical
} from '@/lib/listing/location-exception';
import styles from './LocationExceptionRequest.module.css';
import { LocationExceptionRequestForm } from './LocationExceptionRequestForm.client';

/** Props of {@link LocationExceptionRequestTrigger}. */
export interface LocationExceptionRequestTriggerProps {
    readonly locale: SupportedLocale;
    readonly vertical: LocationExceptionVertical;
    readonly listingId: string;
    /** The address the owner submitted when the save was refused. */
    readonly location: LocationExceptionTarget;
}

/**
 * Render the request button, which opens the short form for the submitted address.
 *
 * @param props - See {@link LocationExceptionRequestTriggerProps}.
 */
export function LocationExceptionRequestTrigger({
    locale,
    vertical,
    listingId,
    location
}: LocationExceptionRequestTriggerProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [open, setOpen] = useState(false);

    if (open) {
        return (
            <div
                className={styles.block}
                data-testid="location-exception-trigger"
            >
                <LocationExceptionRequestForm
                    locale={locale}
                    vertical={vertical}
                    listingId={listingId}
                    location={location}
                    onCancel={() => setOpen(false)}
                />
            </div>
        );
    }
    return (
        <div
            className={styles.actions}
            data-testid="location-exception-trigger"
        >
            <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={() => setOpen(true)}
                data-testid="location-exception-open"
            >
                {t('listing.owner.locationException.requestButton', 'Pedir una excepción')}
            </button>
        </div>
    );
}
