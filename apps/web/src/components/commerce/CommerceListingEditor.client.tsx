/**
 * @file CommerceListingEditor.client.tsx
 * @description Operational editor island for a commerce owner's listing
 * (SPEC-249 Part A). Native HTML form (no TanStack Form, per web conventions)
 * that edits ONLY the operational fields the owner may change and persists them
 * through the vertical's protected PATCH endpoint (`updateOwn`).
 *
 * Identity/core fields are rendered read-only by the hosting page, not here.
 *
 * Field-group coverage:
 *   T-012 mechanics + richDescription (this file)
 *   T-013 simple fields (contactInfo, menuUrl/priceRange or isPriceOnRequest)
 *   T-014 structured fields (openingHours, socialNetworks)
 *   T-015 media gallery
 *   T-016 amenities / features
 */
import { apiClient } from '@/lib/api/client';
import type { CommerceListingDetail, CommerceVertical } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useCallback, useState } from 'react';
import styles from './CommerceListingEditor.module.css';

export interface CommerceListingEditorProps {
    /** Which vertical this listing belongs to (drives the PATCH endpoint + price group). */
    readonly vertical: CommerceVertical;
    /** UUID of the listing being edited. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Current operational + identity values fetched from the protected getById. */
    readonly initialData: CommerceListingDetail;
}

type SaveStatus =
    | { readonly kind: 'idle' }
    | { readonly kind: 'saving' }
    | { readonly kind: 'success' }
    | { readonly kind: 'error'; readonly message: string };

/** Resolve the owner PATCH endpoint for the given vertical. */
function patchPathFor({
    vertical,
    listingId
}: { vertical: CommerceVertical; listingId: string }): string {
    return vertical === 'gastronomy'
        ? `/api/v1/protected/gastronomies/${listingId}`
        : `/api/v1/protected/experiences/${listingId}`;
}

/**
 * Owner operational editor. Tracks which field groups changed and PATCHes ONLY
 * the dirty subset, so an owner who edits one section never re-submits the rest.
 */
export function CommerceListingEditor({
    vertical,
    listingId,
    locale,
    initialData
}: CommerceListingEditorProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [richDescription, setRichDescription] = useState<string>(
        initialData.richDescription ?? ''
    );
    const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
    const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

    const markDirty = useCallback((field: string) => {
        setDirty((prev) => {
            const next = new Set(prev);
            next.add(field);
            return next;
        });
        setStatus({ kind: 'idle' });
    }, []);

    /** Build the PATCH payload from the dirty field groups only. */
    const buildPayload = useCallback((): Record<string, unknown> => {
        const payload: Record<string, unknown> = {};
        if (dirty.has('richDescription')) {
            payload.richDescription = richDescription;
        }
        return payload;
    }, [dirty, richDescription]);

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (dirty.size === 0) {
                return;
            }
            setStatus({ kind: 'saving' });

            const result = await apiClient.patch<unknown>({
                path: patchPathFor({ vertical, listingId }),
                body: buildPayload()
            });

            if (result.ok) {
                setDirty(new Set());
                setStatus({ kind: 'success' });
            } else {
                setStatus({
                    kind: 'error',
                    message: t('commerce.owner.editor.error', 'No se pudieron guardar los cambios.')
                });
            }
        },
        [dirty, vertical, listingId, buildPayload, t]
    );

    const isSaving = status.kind === 'saving';
    const canSave = dirty.size > 0 && !isSaving;

    return (
        <form
            className={styles.editor}
            onSubmit={handleSubmit}
            aria-busy={isSaving}
        >
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-richDescription"
                >
                    {t('commerce.owner.editor.sections.richDescription', 'Descripción ampliada')}
                </label>
                <textarea
                    id="ce-richDescription"
                    className={styles.textarea}
                    value={richDescription}
                    rows={6}
                    onChange={(event) => {
                        setRichDescription(event.target.value);
                        markDirty('richDescription');
                    }}
                />
            </section>

            <div className={styles.actions}>
                <button
                    type="submit"
                    className={styles.save}
                    disabled={!canSave}
                >
                    {isSaving
                        ? t('commerce.owner.editor.saving', 'Guardando...')
                        : t('commerce.owner.editor.save', 'Guardar cambios')}
                </button>

                {status.kind === 'success' && (
                    <output className={styles.success}>
                        {t('commerce.owner.editor.success', 'Cambios guardados.')}
                    </output>
                )}
                {status.kind === 'error' && (
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {status.message}
                    </p>
                )}
            </div>
        </form>
    );
}
