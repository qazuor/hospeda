/**
 * @file VenueMenuLinkField.client.tsx
 * @description The external menu link, edited INSIDE the carta section
 * (HOS-1787 leaf 5.3, DEC-FAC-062).
 *
 * The link used to be a price field. It is part of the complete carta — dishes,
 * uploaded file and link — so it lives here, next to the other two. It is still
 * stored by its own one-key PATCH of the listing and never rides in the carta's
 * `PUT .../menu` (DEC-FAC-062). Owner decision 14 (Mi cuenta UI epic)
 * supersedes DEC-FAC-062's separate «Guardar enlace» button: this field is now a
 * controlled input whose draft the carta's save bar tracks, saves and discards
 * (`useVenueMenuLink`).
 *
 * ## Locked cartas never mount this component
 *
 * A carta resolved as `locked` renders the link READ-ONLY inside
 * `VenueMenuManager`'s upsell, and "Vaciar" clears it with `{ menuUrl: null }`
 * (HOS-1854 / HOS-2038). This component only exists in the `available` branch,
 * so it never offers an editable control the plan does not allow.
 *
 * ## Why the mount marker
 *
 * The carta is a `client:load` island, so `#ce-menuUrl` is in the server HTML
 * before React attaches a handler. The e2e's fill must not land on that node;
 * `data-hydrated` is false in the SSR output and true only after mount, which
 * is what the browser test gates on.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { LISTING_FIELD_PREFIX } from '@/components/listing/editor/field-ids';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './VenueMenuLinkField.module.css';

/** Props of {@link VenueMenuLinkField}. */
export interface VenueMenuLinkFieldProps {
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** The draft, as typed (blank clears the link on save). */
    readonly value: string;
    /** Receives every keystroke. */
    readonly onChange: (value: string) => void;
    /** Disables the control while the section's plan gate is unsettled. */
    readonly disabled?: boolean;
}

/**
 * Renders the venue's external menu link; the carta's save bar saves it.
 *
 * @param props - See {@link VenueMenuLinkFieldProps}.
 * @returns The labelled link input.
 */
export function VenueMenuLinkField({
    locale,
    value,
    onChange,
    disabled = false
}: VenueMenuLinkFieldProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    return (
        <div
            className={styles.field}
            data-testid="venue-menu-link-field"
            data-hydrated={hydrated ? 'true' : undefined}
        >
            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="menuUrl"
                label={t('listing.owner.editor.sections.menuUrl', 'Enlace al menú')}
                labelClassName={styles.label}
                className={styles.input}
                type="url"
                value={value}
                placeholder="https://..."
                disabled={disabled}
                onChange={(event) => {
                    onChange(event.target.value);
                }}
            />
        </div>
    );
}
