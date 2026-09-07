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

import { type JSX, useCallback, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
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

/**
 * Safely read an i18n record from raw data as an I18nLocaleValues.
 *
 * `es` falls back to the flat plain-text column (`plainFallback`) when the
 * i18n value is empty (HOS-902). ES is the platform's source-of-truth locale
 * and predates the i18n columns, so a listing written before SPEC-253 has
 * real Spanish content sitting in the plain column with an empty (or absent)
 * `nameI18n`/`summaryI18n`/`descriptionI18n`/`richDescriptionI18n` twin —
 * without this fallback the ES tab showed the "Ingresá el texto..."
 * placeholder over content that was already published and live, and an owner
 * who "filled it in" was retyping what already existed (HOS-902). `en`/`pt`
 * have no plain equivalent, so they get NO fallback — an empty en/pt is a
 * genuinely untranslated field, not a display bug.
 */
function parseI18nField({
    raw,
    plainFallback
}: {
    readonly raw: unknown;
    readonly plainFallback: string;
}): I18nLocaleValues {
    const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const es = typeof obj.es === 'string' ? obj.es : '';
    return {
        es: es || plainFallback,
        en: typeof obj.en === 'string' ? obj.en : '',
        pt: typeof obj.pt === 'string' ? obj.pt : ''
    };
}

/** Read a nullable plain-text column from raw data as a fallback source. */
function plainField(raw: Record<string, unknown>, key: string): string {
    const value = raw[key];
    return typeof value === 'string' ? value : '';
}

/**
 * Extracts CommerceI18nValues from a raw listing detail record.
 *
 * Returns empty strings for any missing locale or field, EXCEPT `es`, which
 * falls back to the corresponding flat column (`name`/`summary`/
 * `description`/`richDescription`) when the i18n value is empty — see
 * `parseI18nField`.
 *
 * Baking the fallback into the returned value is safe even though this same
 * function seeds BOTH `CommerceListingEditor`'s live form state AND its PATCH
 * diff baseline (both call sites parse the same raw record the same way): a
 * field that only carries a fallback value is, by construction, IDENTICAL in
 * both, so `buildPatchPayload`'s per-field diff (HOS-902) never treats it as
 * dirty. Showing the fallback can never leak into a save unless the owner
 * actually edits that specific field — see
 * `CommerceListingEditor.payload.test.tsx`'s HOS-902 case for the regression
 * this protects against: editing ONE i18n field must not re-send an untouched
 * one just because it displays fallback text.
 */
export function parseCommerceI18nValues(raw: Record<string, unknown>): CommerceI18nValues {
    return {
        nameI18n: parseI18nField({ raw: raw.nameI18n, plainFallback: plainField(raw, 'name') }),
        summaryI18n: parseI18nField({
            raw: raw.summaryI18n,
            plainFallback: plainField(raw, 'summary')
        }),
        descriptionI18n: parseI18nField({
            raw: raw.descriptionI18n,
            plainFallback: plainField(raw, 'description')
        }),
        richDescriptionI18n: parseI18nField({
            raw: raw.richDescriptionI18n,
            plainFallback: plainField(raw, 'richDescription')
        })
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

    // Each label carries the active locale (HOS-371).
    //
    // Without it these four read exactly like the editor's OWN name / summary /
    // description / rich-description fields, which sit on the same page: a
    // screen reader announced "Descripción ampliada" twice with nothing to tell
    // them apart, and `getByRole('textbox', { name })` matched both. The locale
    // also has to be in the NAME, not just the active tab, because the tab is a
    // separate control — someone landing on the field never hears which
    // language they are typing in.
    const localeSuffix = ` (${LOCALE_LABELS[activeLocale]})`;
    const fieldLabels: Record<TranslatableField, string> = {
        nameI18n: `${t('commerce.owner.editor.translationPanel.fieldName', 'Nombre')}${localeSuffix}`,
        summaryI18n: `${t('commerce.owner.editor.translationPanel.fieldSummary', 'Resumen')}${localeSuffix}`,
        descriptionI18n: `${t('commerce.owner.editor.translationPanel.fieldDescription', 'Descripción')}${localeSuffix}`,
        richDescriptionI18n: `${t('commerce.owner.editor.translationPanel.fieldRichDescription', 'Descripción ampliada')}${localeSuffix}`
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
                                // The locale name MUST travel as an interpolation
                                // param, not baked into the fallback: the key
                                // EXISTS in the catalog ("Ingresá el texto en
                                // {{locale}}..."), so the resolver returns the
                                // catalog value and discards the fallback
                                // entirely — the owner saw a literal
                                // "{{locale}}". Same failure mode as BETA-124's
                                // summary counter.
                                placeholder={t(
                                    'commerce.owner.editor.translationPanel.localePlaceholder',
                                    `Ingresá el texto en ${LOCALE_LABELS[activeLocale]}...`,
                                    { locale: LOCALE_LABELS[activeLocale] }
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
