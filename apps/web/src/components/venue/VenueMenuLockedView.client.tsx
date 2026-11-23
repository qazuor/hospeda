/**
 * @file VenueMenuLockedView.client.tsx
 * @description The read-only carta shown inside a `locked` section (HOS-1854):
 * the uploaded file, the external link and the stored dishes, with no editable
 * control. Split out of `VenueMenuManager.client.tsx` (HOS-2490).
 */

import type { JSX } from 'react';
import type { TranslationFn } from '@/lib/i18n';
import { centsToPesosInputValue } from '@/lib/listing/price-units';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './VenueMenuManager.module.css';
import type { MenuFile, MenuSectionDraft } from './venue-menu-draft';

/** Props of {@link VenueMenuLockedView}. */
export interface VenueMenuLockedViewProps {
    readonly t: TranslationFn;
    readonly sections: readonly MenuSectionDraft[];
    readonly file: MenuFile | null;
    readonly menuUrl: string | null;
    /** Whether the carta holds anything at all (dishes, file or link). */
    readonly hasData: boolean;
}

/**
 * The locked carta, read-only.
 *
 * @param props - See {@link VenueMenuLockedViewProps}.
 * @returns The stored data, or the empty sentence.
 */
export function VenueMenuLockedView({
    t,
    sections,
    file,
    menuUrl,
    hasData
}: VenueMenuLockedViewProps): JSX.Element {
    /*
     * The scheme gate (HOS-592 / F-02). `menu_file_url` reached the column
     * through more than the upload route before the write schemas were
     * narrowed, so the value is made safe no matter how it got into the row.
     * `undefined` means the link is DROPPED, never rendered with the raw value.
     */
    const safeFileHref = resolveSafeExternalUrl(file?.url);
    const safeMenuHref = resolveSafeExternalUrl(menuUrl);

    return (
        <>
            {file ? (
                <div className={styles.fileRow}>
                    {safeFileHref ? (
                        <a
                            className={styles.fileLink}
                            href={safeFileHref}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {file.kind === 'pdf'
                                ? t('venue.owner.editor.menuManager.filePdf', 'Ver el PDF')
                                : t('venue.owner.editor.menuManager.fileImage', 'Ver la foto')}
                        </a>
                    ) : (
                        <span className={styles.intro}>
                            {t(
                                'venue.owner.editor.lockedSection.fileUnavailable',
                                'No se puede abrir este archivo.'
                            )}
                        </span>
                    )}
                </div>
            ) : null}

            {menuUrl ? (
                <div className={styles.fileRow}>
                    {safeMenuHref ? (
                        <a
                            className={styles.fileLink}
                            href={safeMenuHref}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {t('listing.owner.editor.sections.menuUrl', 'Enlace al menú')}
                        </a>
                    ) : (
                        <span className={styles.intro}>
                            {t('venue.owner.editor.lockedSection.unavailable', 'No disponible')}
                        </span>
                    )}
                </div>
            ) : null}

            {hasData ? (
                sections.map((section, sectionIndex) => (
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                        key={`locked-section-${sectionIndex}`}
                        className={styles.sectionCard}
                    >
                        <h3 className={styles.subheading}>{section.name}</h3>
                        {section.description ? (
                            <p className={styles.intro}>{section.description}</p>
                        ) : null}
                        {section.items.length > 0 ? (
                            <ul className={styles.readOnlyList}>
                                {section.items.map((item, itemIndex) => (
                                    <li
                                        // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                                        key={`locked-item-${sectionIndex}-${itemIndex}`}
                                        className={styles.readOnlyItem}
                                    >
                                        <span className={styles.readOnlyName}>{item.name}</span>
                                        {item.description ? (
                                            <span className={styles.readOnlyDescription}>
                                                {item.description}
                                            </span>
                                        ) : null}
                                        <span className={styles.readOnlyPrice}>
                                            {item.priceCents === null
                                                ? t(
                                                      'venue.owner.editor.menuManager.itemPricePlaceholder',
                                                      'A consultar'
                                                  )
                                                : `$${centsToPesosInputValue({
                                                      cents: item.priceCents
                                                  })}`}
                                        </span>
                                        {item.isAvailable ? null : (
                                            <span className={styles.readOnlyNote}>
                                                {t(
                                                    'venue.owner.editor.lockedSection.unavailable',
                                                    'No disponible'
                                                )}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                ))
            ) : (
                <p className={styles.intro}>
                    {t(
                        'venue.owner.editor.lockedSection.empty',
                        'No hay datos cargados en esta sección.'
                    )}
                </p>
            )}
        </>
    );
}
