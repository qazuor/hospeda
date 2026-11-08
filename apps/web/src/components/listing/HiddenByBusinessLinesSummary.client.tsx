/**
 * @file HiddenByBusinessLinesSummary.client.tsx
 * @description Hub block for sections saved but hidden by the listing's
 * business lines (HOS-1787 leaf 5.7, DEC-FAC-063 / DEC-FAC-075 / AC:5:6).
 *
 * A section that becomes `absent` keeps its owner's data: the same treatment a
 * `locked` section gets. The hub tells the owner how much is stored and lets
 * THEM empty it — the API compares `actorId === subjectId`, so staff never gets
 * the destructive action (DEC-FAC-075). The page passes `canEmpty: false` for
 * staff and the button disappears; the counts stay visible.
 *
 * Emptying uses the API's `delete` intent:
 *  - `menu`: an empty `PUT .../menu` (plus `DELETE .../menu-file`, and a
 *    one-key `PATCH { menuUrl: null }` for the external link);
 *  - `dailySpecials`: an empty `PUT .../daily-specials`;
 *  - `nightInfo`: a `PATCH` whose six fields are all `null` — HOS-2038 measured
 *    that null fields declare no section, so the write is a delete and is
 *    authorized on an `absent` section.
 *
 * @module components/listing/HiddenByBusinessLinesSummary
 */

import { type JSX, useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/shared/ui/ConfirmDeleteDialog.client';
import { useSectionVaciar } from '@/hooks/useSectionVaciar';
import { apiClient } from '@/lib/api/client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './HiddenByBusinessLinesSummary.module.css';

/** One hidden section the hub may render. */
export interface HiddenByBusinessLinesSection {
    /** Catalog section id (e.g. `menu`, `nightInfo`). */
    readonly id: string;
    /** i18n key of the section's label. */
    readonly labelKey: string;
    /** Stored item count; `null` means the read failed. */
    readonly count: number | null;
}

/** Props for {@link HiddenByBusinessLinesSummary}. */
export interface HiddenByBusinessLinesSummaryProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** The listing whose sections are hidden. */
    readonly listingId: string;
    /** Sections with data, already filtered by the page. */
    readonly sections: readonly HiddenByBusinessLinesSection[];
    /** Only the owner may empty; staff sees the counts without the action. */
    readonly canEmpty: boolean;
}

/** Empties one hidden section through its `delete`-intent write. */
async function clearSection({
    sectionId,
    listingId
}: {
    readonly sectionId: string;
    readonly listingId: string;
}): Promise<boolean> {
    switch (sectionId) {
        case 'menu': {
            const cleared = await apiClient.put<unknown>({
                path: `/api/v1/protected/venues/${listingId}/menu`,
                body: { sections: [] }
            });
            if (!cleared.ok) return false;
            await apiClient.delete<unknown>({
                path: `/api/v1/protected/venues/${listingId}/menu-file`
            });
            const link = await apiClient.patch<unknown>({
                path: `/api/v1/protected/venues/${listingId}`,
                body: { menuUrl: null }
            });
            return link.ok;
        }
        case 'dailySpecials': {
            const result = await apiClient.put<unknown>({
                path: `/api/v1/protected/venues/${listingId}/daily-specials`,
                body: { specials: [] }
            });
            return result.ok;
        }
        case 'nightInfo': {
            const result = await apiClient.patch<unknown>({
                path: `/api/v1/protected/venues/${listingId}`,
                body: {
                    entryKind: null,
                    entryNoteI18n: null,
                    entryPriceFrom: null,
                    // HOS-2060: the night policies are deleted key by key, so
                    // every other house rule survives the clear.
                    policies: { minAge: null, dressCode: null, dressCodeNote: null }
                }
            });
            return result.ok;
        }
        default:
            return false;
    }
}

/** One hidden section, with its own confirm dialog. */
function HiddenSectionRow({
    locale,
    listingId,
    section,
    canEmpty
}: {
    readonly locale: SupportedLocale;
    readonly listingId: string;
    readonly section: HiddenByBusinessLinesSection;
    readonly canEmpty: boolean;
}): JSX.Element {
    const { t, tPlural } = createTranslations(locale);
    const [message, setMessage] = useState<string | null>(null);
    const label = t(section.labelKey, section.id);

    const vaciar = useSectionVaciar({
        clear: async () => {
            const cleared = await clearSection({ sectionId: section.id, listingId });
            if (!cleared) {
                setMessage(
                    t(
                        'venue.owner.editor.lockedSection.vaciarError',
                        'No se pudo vaciar la sección.'
                    )
                );
            }
            return cleared;
        },
        onCleared: () => {
            setMessage(t('venue.owner.editor.lockedSection.vaciarSuccess', 'Se vació la sección.'));
            window.location.reload();
        }
    });

    return (
        <li className={styles.row}>
            <div className={styles.rowText}>
                <span className={styles.rowLabel}>{label}</span>
                {typeof section.count === 'number' && section.count > 0 ? (
                    <span className={styles.rowCount}>
                        {tPlural('listing.owner.editor.hub.hidden.count', section.count, {
                            count: section.count
                        })}
                    </span>
                ) : null}
                {message ? (
                    <span
                        className={styles.rowMessage}
                        role="status"
                    >
                        {message}
                    </span>
                ) : null}
            </div>
            {canEmpty ? (
                <button
                    type="button"
                    className={styles.vaciar}
                    data-testid={`hidden-section-vaciar-${section.id}`}
                    disabled={vaciar.isBusy}
                    onClick={vaciar.request}
                >
                    {t('venue.owner.editor.lockedSection.vaciar', 'Vaciar')}
                </button>
            ) : null}
            <ConfirmDeleteDialog
                isOpen={vaciar.isDialogOpen}
                title={t('venue.owner.editor.lockedSection.vaciarTitle', 'Vaciar la sección')}
                message={t(
                    'venue.owner.editor.lockedSection.vaciarMessage',
                    'Se van a borrar los datos guardados de esta sección. Esta acción no se puede deshacer.'
                )}
                detail={label}
                confirmLabel={t(
                    'venue.owner.editor.lockedSection.vaciarConfirm',
                    'Vaciar la sección'
                )}
                busyLabel={t('venue.owner.editor.lockedSection.vaciarBusy', 'Vaciando…')}
                cancelLabel={t('venue.owner.editor.lockedSection.cancel', 'Cancelar')}
                closeLabel={t('common.close', 'Cerrar')}
                isBusy={vaciar.isBusy}
                onConfirm={vaciar.confirm}
                onCancel={vaciar.cancel}
            />
        </li>
    );
}

/** The hub block; renders nothing when no hidden section has data. */
export function HiddenByBusinessLinesSummary({
    locale,
    listingId,
    sections,
    canEmpty
}: HiddenByBusinessLinesSummaryProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    if (sections.length === 0) return null;

    return (
        <section
            className={styles.summary}
            data-testid="hidden-by-business-lines"
        >
            <h2 className={styles.title}>
                {t('listing.owner.editor.hub.hidden.title', 'Guardado y oculto por tus rubros')}
            </h2>
            <p className={styles.intro}>
                {t(
                    'listing.owner.editor.hub.hidden.intro',
                    'Estas secciones no se muestran porque tus rubros actuales no las incluyen. Sus datos siguen guardados: si volvés a agregar el rubro, vuelven.'
                )}
            </p>
            <ul className={styles.rows}>
                {sections.map((section) => (
                    <HiddenSectionRow
                        key={section.id}
                        locale={locale}
                        listingId={listingId}
                        section={section}
                        canEmpty={canEmpty}
                    />
                ))}
            </ul>
        </section>
    );
}
