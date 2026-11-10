/**
 * @file VenueMenuLinkField.client.tsx
 * @description The external menu link, edited INSIDE the carta section
 * (HOS-1787 leaf 5.3, DEC-FAC-062).
 *
 * The link used to be a price field. It is part of the complete carta — dishes,
 * uploaded file and link — so it moved here, next to the other two, and is
 * saved by its own one-key PATCH of the listing. It deliberately does NOT ride
 * in the carta's `PUT .../menu`: that endpoint re-creates every dish, and a
 * failed cartridge save would take the link with it.
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
import { apiClient } from '@/lib/api/client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './VenueMenuLinkField.module.css';

export interface VenueMenuLinkFieldProps {
    /** UUID of the venue listing the link belongs to. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** The stored link, or `null` when the venue has none. */
    readonly menuUrl: string | null;
    /** Disables the control while the section's plan gate is unsettled. */
    readonly disabled?: boolean;
    /** Receives the persisted value after a successful save. */
    readonly onSaved?: (menuUrl: string | null) => void;
}

/**
 * Renders the venue's external menu link with its own save action.
 *
 * Emptying the input is an explicit clear, not a no-op: it sends
 * `{ menuUrl: null }`, the same one-key body HOS-2038 keeps authorized on a
 * locked section.
 *
 * @param props - Listing id, locale, current value and save callback.
 */
export function VenueMenuLinkField({
    listingId,
    locale,
    menuUrl,
    disabled = false,
    onSaved
}: VenueMenuLinkFieldProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [value, setValue] = useState(menuUrl ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    // The manager owns the value across saves and "Vaciar", so a change there
    // (not a keystroke) is what re-seeds this draft.
    useEffect(() => {
        setValue(menuUrl ?? '');
    }, [menuUrl]);

    async function save(): Promise<void> {
        const trimmed = value.trim();
        const next = trimmed === '' ? null : trimmed;

        setIsSaving(true);
        setMessage(null);

        const result = await apiClient.patch<unknown>({
            path: `/api/v1/protected/venues/${listingId}`,
            // ONE key: the body is the link's own edit, never the whole form.
            body: { menuUrl: next }
        });

        setIsSaving(false);

        if (!result.ok) {
            setMessage(
                t('venue.owner.editor.menuManager.linkSaveError', 'No se pudo guardar el enlace.')
            );
            return;
        }

        setValue(next ?? '');
        onSaved?.(next);
        setMessage(t('venue.owner.editor.menuManager.linkSaved', 'Enlace guardado.'));
    }

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
                disabled={disabled || isSaving}
                onChange={(event) => {
                    setValue(event.target.value);
                }}
            />

            <button
                type="button"
                className={styles.saveButton}
                data-testid="venue-menu-link-save"
                disabled={disabled || isSaving}
                onClick={() => {
                    void save();
                }}
            >
                {isSaving
                    ? t('venue.owner.editor.menuManager.saving', 'Guardando…')
                    : t('venue.owner.editor.menuManager.linkSave', 'Guardar enlace')}
            </button>

            {message ? (
                <p
                    className={styles.message}
                    role="status"
                >
                    {message}
                </p>
            ) : null}
        </div>
    );
}
