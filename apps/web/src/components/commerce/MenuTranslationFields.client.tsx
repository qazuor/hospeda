/**
 * @file MenuTranslationFields.client.tsx
 * @description The EN/PT translation fields for one carta section or dish
 * (HOS-1043), extracted out of `CommerceMenuManager.client.tsx` to keep that
 * file's growth in check.
 *
 * Native `<details>`/`<summary>` for the collapse, not a `useState` toggle: a
 * carta editor with thirty sections of a hundred dishes each would otherwise
 * carry one boolean per row for a purely cosmetic affordance, and the
 * platform's own rule for `apps/web` is minimal client JS.
 *
 * The ES leg of each translated field is never edited here — it is the
 * section/item's own `name`/`description` input, already rendered by the
 * parent. Only `en`/`pt` are collected; `CommerceMenuManager`'s
 * `buildI18nField` decides at save time whether the pair is complete enough
 * to submit.
 *
 * @module components/commerce/MenuTranslationFields
 */

import type { JSX } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CommerceMenuManager.module.css';

/** What one translation field patch carries. */
export interface MenuTranslationPatch {
    readonly nameEn?: string;
    readonly namePt?: string;
    readonly descriptionEn?: string;
    readonly descriptionPt?: string;
}

export interface MenuTranslationFieldsProps {
    readonly nameEn: string;
    readonly namePt: string;
    readonly descriptionEn: string;
    readonly descriptionPt: string;
    /** Whether the description pair renders at all — a section with no blurb has nothing to translate. */
    readonly hasDescription: boolean;
    /**
     * Whether the LAST save was refused for carrying a translation
     * (`isTranslationLocked` in the parent). Purely informational — the
     * fields stay enabled either way, because clearing them is the owner's
     * only way out of the lock, and a disabled field cannot be cleared.
     */
    readonly locked: boolean;
    readonly locale: SupportedLocale;
    readonly onChange: (patch: MenuTranslationPatch) => void;
}

/**
 * Renders the EN/PT input pair for a name and (optionally) a description,
 * behind a collapsed `<details>`.
 *
 * @param props - See {@link MenuTranslationFieldsProps}.
 * @returns The translation fields block.
 */
export function MenuTranslationFields({
    nameEn,
    namePt,
    descriptionEn,
    descriptionPt,
    hasDescription,
    locked,
    locale,
    onChange
}: MenuTranslationFieldsProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <details
            className={styles.translationsBlock}
            open={locked}
        >
            <summary className={styles.translationsSummary}>
                {t('commerce.owner.editor.menuManager.translations', 'Traducciones (EN/PT)')}
            </summary>
            {locked && (
                <p className={styles.translationsLockedHint}>
                    {t(
                        'commerce.owner.editor.menuManager.translationLockedHint',
                        'Disponible en el plan Premium. Borrá el inglés y el portugués para guardar la carta en español.'
                    )}
                </p>
            )}
            <div className={styles.translationsGrid}>
                <input
                    className={styles.input}
                    type="text"
                    value={nameEn}
                    placeholder={t(
                        'commerce.owner.editor.menuManager.nameEnPlaceholder',
                        'Nombre en inglés'
                    )}
                    aria-label={t('commerce.owner.editor.menuManager.nameEn', 'Nombre en inglés')}
                    onChange={(event) => {
                        onChange({ nameEn: event.target.value });
                    }}
                />
                <input
                    className={styles.input}
                    type="text"
                    value={namePt}
                    placeholder={t(
                        'commerce.owner.editor.menuManager.namePtPlaceholder',
                        'Nombre en portugués'
                    )}
                    aria-label={t(
                        'commerce.owner.editor.menuManager.namePt',
                        'Nombre en portugués'
                    )}
                    onChange={(event) => {
                        onChange({ namePt: event.target.value });
                    }}
                />
                {hasDescription && (
                    <>
                        <input
                            className={styles.input}
                            type="text"
                            value={descriptionEn}
                            placeholder={t(
                                'commerce.owner.editor.menuManager.descriptionEnPlaceholder',
                                'Descripción en inglés'
                            )}
                            aria-label={t(
                                'commerce.owner.editor.menuManager.descriptionEn',
                                'Descripción en inglés'
                            )}
                            onChange={(event) => {
                                onChange({ descriptionEn: event.target.value });
                            }}
                        />
                        <input
                            className={styles.input}
                            type="text"
                            value={descriptionPt}
                            placeholder={t(
                                'commerce.owner.editor.menuManager.descriptionPtPlaceholder',
                                'Descripción en portugués'
                            )}
                            aria-label={t(
                                'commerce.owner.editor.menuManager.descriptionPt',
                                'Descripción en portugués'
                            )}
                            onChange={(event) => {
                                onChange({ descriptionPt: event.target.value });
                            }}
                        />
                    </>
                )}
            </div>
        </details>
    );
}
