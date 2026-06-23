/**
 * @file CommerceTranslationPanel.client.tsx
 * @description Owner-facing i18n editing panel for a commerce listing (SPEC-253 T-022).
 *
 * Replicates the SPEC-212 TranslationPanel visual language (locale badges,
 * fieldCard grid, section card pattern) but adapts it to a direct-edit UX:
 * owners write translations for nameI18n / summaryI18n / descriptionI18n /
 * richDescriptionI18n directly in the panel, per locale (es/en/pt tabs).
 *
 * The panel is stateless with respect to persistence — it calls `onChange`
 * whenever any field value changes. The parent editor (CommerceListingEditor)
 * collects the full i18n state and includes it in the PATCH payload.
 *
 * Design decisions (D3 — SPEC-253):
 * - Per-locale tab navigation (same three locales as the accommodation panel).
 * - Each tab exposes all four translatable fields as labelled textareas.
 * - Visual structure (fieldCard, localeBadge, sectionTitle) mirrors
 *   TranslationPanel.module.css so the two panels feel consistent.
 */
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useCallback, useState } from 'react';
import styles from './CommerceTranslationPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-locale string value for a single i18n field. */
export interface I18nLocaleValues {
    readonly es: string;
    readonly en: string;
    readonly pt: string;
}

/** The four translatable field groups the owner may edit. */
export interface CommerceI18nValues {
    readonly nameI18n: I18nLocaleValues;
    readonly summaryI18n: I18nLocaleValues;
    readonly descriptionI18n: I18nLocaleValues;
    readonly richDescriptionI18n: I18nLocaleValues;
}

/** Props for CommerceTranslationPanel. */
export interface CommerceTranslationPanelProps {
    /** Active UI locale — also the default active tab. */
    readonly locale: SupportedLocale;
    /** Initial i18n values sourced from the listing detail. */
    readonly initialValues: CommerceI18nValues;
    /**
     * Called with the full updated i18n state whenever any field changes.
     * The parent editor uses this to build the dirty PATCH payload.
     */
    readonly onChange: (values: CommerceI18nValues) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;

const LOCALE_LABELS: Record<SupportedLocale, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

type TranslatableField = keyof CommerceI18nValues;

const TRANSLATABLE_FIELDS: ReadonlyArray<TranslatableField> = [
    'nameI18n',
    'summaryI18n',
    'descriptionI18n',
    'richDescriptionI18n'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if this locale has content for at least one field. */
function localeHasContent({
    values,
    locale
}: {
    readonly values: CommerceI18nValues;
    readonly locale: SupportedLocale;
}): boolean {
    return TRANSLATABLE_FIELDS.some((field) => Boolean(values[field][locale]));
}

/** Build a blank (empty-string) i18n locale value set. */
function emptyLocaleValues(): I18nLocaleValues {
    return { es: '', en: '', pt: '' };
}

/** Safely read an i18n record from raw data as an I18nLocaleValues. */
function parseI18nField(raw: unknown): I18nLocaleValues {
    if (raw === null || typeof raw !== 'object') {
        return emptyLocaleValues();
    }
    const obj = raw as Record<string, unknown>;
    return {
        es: typeof obj.es === 'string' ? obj.es : '',
        en: typeof obj.en === 'string' ? obj.en : '',
        pt: typeof obj.pt === 'string' ? obj.pt : ''
    };
}

/**
 * Extracts CommerceI18nValues from a raw listing detail record.
 * Returns empty strings for any missing locale or field.
 */
export function parseCommerceI18nValues(raw: Record<string, unknown>): CommerceI18nValues {
    return {
        nameI18n: parseI18nField(raw.nameI18n),
        summaryI18n: parseI18nField(raw.summaryI18n),
        descriptionI18n: parseI18nField(raw.descriptionI18n),
        richDescriptionI18n: parseI18nField(raw.richDescriptionI18n)
    };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CommerceTranslationPanel
 *
 * Owner-editable i18n panel for a commerce listing. Renders per-locale tabs
 * (es/en/pt) with a textarea per translatable field. Calls `onChange` on every
 * field change so the parent editor can track dirty state.
 *
 * @param locale - Active UI locale (sets the default active tab).
 * @param initialValues - Initial i18n values from the listing detail.
 * @param onChange - Callback receiving the full updated i18n state.
 */
export function CommerceTranslationPanel({
    locale,
    initialValues,
    onChange
}: CommerceTranslationPanelProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [activeLocale, setActiveLocale] = useState<SupportedLocale>(locale);
    const [values, setValues] = useState<CommerceI18nValues>(initialValues);

    const handleFieldChange = useCallback(
        (field: TranslatableField, fieldLocale: SupportedLocale, text: string) => {
            setValues((prev) => {
                const updated: CommerceI18nValues = {
                    ...prev,
                    [field]: {
                        ...prev[field],
                        [fieldLocale]: text
                    }
                };
                onChange(updated);
                return updated;
            });
        },
        [onChange]
    );

    const fieldLabels: Record<TranslatableField, string> = {
        nameI18n: t('commerce.owner.editor.translationPanel.fieldName', 'Nombre'),
        summaryI18n: t('commerce.owner.editor.translationPanel.fieldSummary', 'Resumen'),
        descriptionI18n: t(
            'commerce.owner.editor.translationPanel.fieldDescription',
            'Descripción'
        ),
        richDescriptionI18n: t(
            'commerce.owner.editor.translationPanel.fieldRichDescription',
            'Descripción ampliada'
        )
    };

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('commerce.owner.editor.translationPanel.sectionTitle', 'Traducciones')}
            </legend>

            <p className={styles.sectionDescription}>
                {t(
                    'commerce.owner.editor.translationPanel.sectionDescription',
                    'Editá las traducciones de los campos principales de tu comercio en los tres idiomas disponibles.'
                )}
            </p>

            {/* Locale tab bar */}
            <div
                className={styles.tabBar}
                role="tablist"
                aria-label={t(
                    'commerce.owner.editor.translationPanel.sectionTitle',
                    'Traducciones'
                )}
            >
                {SUPPORTED_LOCALES.map((loc) => {
                    const hasContent = localeHasContent({ values, locale: loc });
                    const isActive = loc === activeLocale;
                    return (
                        <button
                            key={loc}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                            onClick={() => setActiveLocale(loc)}
                        >
                            <span
                                className={`${styles.localeBadge} ${
                                    isActive
                                        ? styles.localeBadgeActive
                                        : hasContent
                                          ? styles.localeBadgePresent
                                          : styles.localeBadgeMissing
                                }`}
                            >
                                {LOCALE_LABELS[loc]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Active locale fields */}
            <div
                role="tabpanel"
                aria-label={LOCALE_LABELS[activeLocale]}
                className={styles.tabPanel}
            >
                {TRANSLATABLE_FIELDS.map((field) => {
                    const fieldId = `ctp-${field}-${activeLocale}`;
                    const isRich = field === 'richDescriptionI18n' || field === 'descriptionI18n';
                    return (
                        <div
                            key={field}
                            className={styles.fieldCard}
                        >
                            <label
                                className={styles.fieldName}
                                htmlFor={fieldId}
                            >
                                {fieldLabels[field]}
                            </label>
                            <textarea
                                id={fieldId}
                                className={styles.textarea}
                                rows={isRich ? 5 : 3}
                                value={values[field][activeLocale]}
                                placeholder={t(
                                    'commerce.owner.editor.translationPanel.localePlaceholder',
                                    `Ingresá el texto en ${LOCALE_LABELS[activeLocale]}...`
                                )}
                                onChange={(event) =>
                                    handleFieldChange(field, activeLocale, event.target.value)
                                }
                            />
                        </div>
                    );
                })}
            </div>
        </fieldset>
    );
}
