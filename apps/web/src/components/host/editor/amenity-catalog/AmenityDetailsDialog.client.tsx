/**
 * @file AmenityDetailsDialog.client.tsx
 * @description The per-amenity details editor of the accommodation catalog
 * browser (HOS-2123): scope, availability and extra charge for ONE selected
 * amenity, opened from that tile's "Agregar detalles" / "Detalles" link.
 *
 * It is the shared `Dialog` (focus trap, Escape, focus restore, back-button
 * close), centered on desktop and docked to the bottom as a drawer on narrow
 * screens through responsive CSS only — one component, two presentations.
 *
 * Persistence is unchanged: the dialog edits a local DRAFT and "Aplicar" hands
 * it to the form state, exactly where the former inline disclosure wrote. The
 * page's own "Guardar" still saves it through the same `amenityAttributes`
 * diff. "Cancelar", Escape and an overlay click discard the draft.
 */

import { type JSX, useId, useState } from 'react';
import {
    type AmenityAttributeChange,
    AmenityAttributeFields,
    NO_AMENITY_ATTRIBUTES
} from '@/components/shared/catalog-picker/AmenityAttributeControls.client';
import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import type { AmenityAttributeValue } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AmenityDetailsDialog.module.css';

/** The amenity whose details are being edited. */
export interface AmenityDetailsTarget {
    readonly id: string;
    /** Localized display name, used in the dialog title. */
    readonly name: string;
}

/** Props for {@link AmenityDetailsDialog}. */
export interface AmenityDetailsDialogProps {
    readonly locale: SupportedLocale;
    /** The amenity being edited; `null` keeps the dialog closed. */
    readonly target: AmenityDetailsTarget | null;
    /** What is currently declared for the target (form state, not the draft). */
    readonly declared: AmenityAttributeValue | undefined;
    /** Commits the draft to the form state. */
    readonly onApply: (input: {
        readonly amenityId: string;
        readonly value: AmenityAttributeValue;
    }) => void;
    /** Closes without applying. */
    readonly onClose: () => void;
}

/** The dialog's content, keyed by amenity so every opening starts a fresh draft. */
function AmenityDetailsContent({
    locale,
    target,
    declared,
    titleId,
    onApply,
    onClose
}: {
    readonly locale: SupportedLocale;
    readonly target: AmenityDetailsTarget;
    readonly declared: AmenityAttributeValue | undefined;
    readonly titleId: string;
    readonly onApply: AmenityDetailsDialogProps['onApply'];
    readonly onClose: () => void;
}): JSX.Element {
    const { t } = createTranslations(locale);
    const idPrefix = useId();
    const [draft, setDraft] = useState<AmenityAttributeValue>(declared ?? NO_AMENITY_ATTRIBUTES);
    const key = 'host.properties.editor.catalog.details';

    const changeDraft: AmenityAttributeChange = (_amenityId, field, value) => {
        setDraft((previous) => ({ ...previous, [field]: value }));
    };

    return (
        <>
            <DialogHeader
                titleId={titleId}
                onClose={onClose}
                closeLabel={t(`${key}.close`, 'Cerrar')}
            >
                {t(`${key}.title`, `Detalles de ${target.name}`, { name: target.name })}
            </DialogHeader>
            <DialogBody>
                <div className={styles.fields}>
                    <AmenityAttributeFields
                        idPrefix={idPrefix}
                        amenityId={target.id}
                        declared={draft}
                        t={t}
                        onChange={changeDraft}
                    />
                </div>
            </DialogBody>
            <DialogFooter>
                <button
                    type="button"
                    className={styles.secondary}
                    onClick={onClose}
                >
                    {t(`${key}.cancel`, 'Cancelar')}
                </button>
                <button
                    type="button"
                    className={styles.primary}
                    onClick={() => {
                        onApply({ amenityId: target.id, value: draft });
                        onClose();
                    }}
                >
                    {t(`${key}.apply`, 'Aplicar')}
                </button>
            </DialogFooter>
        </>
    );
}

/**
 * Details dialog / bottom drawer for one selected amenity.
 *
 * @param props - {@link AmenityDetailsDialogProps}
 * @returns The dialog (renders nothing while `target` is `null`)
 */
export function AmenityDetailsDialog({
    locale,
    target,
    declared,
    onApply,
    onClose
}: AmenityDetailsDialogProps): JSX.Element {
    const titleId = `${useId()}-amenity-details-title`;

    return (
        <Dialog
            isOpen={target !== null}
            onClose={onClose}
            ariaLabelledBy={titleId}
            size="sm"
            className={styles.panel}
            overlayClassName={styles.overlay}
        >
            {target && (
                <AmenityDetailsContent
                    key={target.id}
                    locale={locale}
                    target={target}
                    declared={declared}
                    titleId={titleId}
                    onApply={onApply}
                    onClose={onClose}
                />
            )}
        </Dialog>
    );
}
