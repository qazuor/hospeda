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

/**
 * Plain (non-i18n) column values, used ONLY as an ES-tab display fallback
 * (HOS-902) — see `resolveDisplayValue`'s JSDoc. Never part of the panel's
 * own state and never passed to `onChange`.
 */
export interface CommercePlainTextValues {
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly richDescription: string;
}

/** Props for CommerceTranslationPanel. */
export interface CommerceTranslationPanelProps {
    /** Active UI locale — also the default active tab. */
    readonly locale: SupportedLocale;
    /** Initial i18n values sourced from the listing detail. */
    readonly initialValues: CommerceI18nValues;
    /**
     * The listing's plain `name`/`summary`/`description`/`richDescription`
     * columns (HOS-902), used ONLY to show real content in the ES tab when
     * the i18n twin is empty — see `resolveDisplayValue`.
     */
    readonly plainTextValues: CommercePlainTextValues;
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
 * Deliberately NO fallback to the plain column here (see HOS-902 history
 * below) — this is the value that becomes `CommerceListingEditor`'s live form
 * state AND its PATCH diff baseline, i.e. it is what gets SAVED. Returns
 * empty strings for any missing locale or field, exactly what is actually
 * stored.
 *
 * HOS-902 correction: an earlier version of this function baked an ES
 * fallback to the plain `name`/`summary`/`description`/`richDescription`
 * column directly into the returned value, reasoning that a field carrying
 * only the fallback is identical between `current` and `baseline` and so
 * never looks dirty on its own. That reasoning broke the moment a SIBLING
 * locale of the SAME field changed: `gastronomyModel`/`experienceModel` do
 * NOT declare `nameI18n`/`summaryI18n`/`descriptionI18n`/`richDescriptionI18n`
 * in `mergeableJsonbColumns` (see `packages/db/src/models/gastronomy/
 * gastronomy.model.ts` and `.../experience/experience.model.ts`, both line
 * 68 — only `contactInfo` is there), so `BaseModelImpl.update()`
 * (`packages/db/src/base/base.model.ts:387-393`) takes the PLAIN-REPLACEMENT
 * path for these columns, not the `||`-merge path — the whole JSONB object is
 * overwritten, not merged per key. Editing only `nameI18n.en` therefore sends
 * the WHOLE `nameI18n` object, including an `es` that carried nothing but
 * fallback DISPLAY text — permanently writing it into the i18n column, where
 * `apps/web/src/lib/api/transforms.ts`'s public-ficha resolution PREFERS the
 * i18n column over the plain one, so a later rename via the plain `name`
 * field could never reach the public page again. The fallback now lives
 * ONLY in `resolveDisplayValue`, at render time, never in this function.
 */
export function parseCommerceI18nValues(raw: Record<string, unknown>): CommerceI18nValues {
    const parseField = (fieldRaw: unknown): I18nLocaleValues => {
        const obj =
            fieldRaw !== null && typeof fieldRaw === 'object'
                ? (fieldRaw as Record<string, unknown>)
                : {};
        return {
            es: typeof obj.es === 'string' ? obj.es : '',
            en: typeof obj.en === 'string' ? obj.en : '',
            pt: typeof obj.pt === 'string' ? obj.pt : ''
        };
    };
    return {
        nameI18n: parseField(raw.nameI18n),
        summaryI18n: parseField(raw.summaryI18n),
        descriptionI18n: parseField(raw.descriptionI18n),
        richDescriptionI18n: parseField(raw.richDescriptionI18n)
    };
}

/** Maps each translatable i18n field to its plain-column counterpart. */
const PLAIN_TEXT_KEY: Record<TranslatableField, keyof CommercePlainTextValues> = {
    nameI18n: 'name',
    summaryI18n: 'summary',
    descriptionI18n: 'description',
    richDescriptionI18n: 'richDescription'
};

/**
 * Resolves what the ES tab shows for one field — DISPLAY ONLY (HOS-902).
 *
 * The stored value always wins when present. Only when it is empty AND the
 * locale is `es` does this fall back to the plain column — `en`/`pt` have no
 * plain equivalent and never fall back.
 *
 * This is called at render time, from the `value` prop of the textarea, and
 * its result is NEVER written back into the panel's `values` state or passed
 * to `onChange` on its own — only the owner typing into the field does that
 * (`handleFieldChange`, driven by the real DOM `event.target.value`). See the
 * HOS-902 note on `parseCommerceI18nValues` for why baking this into state
 * instead was unsafe: with `nameI18n`/`summaryI18n`/`descriptionI18n`/
 * `richDescriptionI18n` replaced wholesale (not merged) on save, ANY stored
 * value — including a fabricated fallback — travels in full the moment a
 * sibling locale of the SAME field changes.
 */
function resolveDisplayValue({
    field,
    locale,
    values,
    plainTextValues
}: {
    readonly field: TranslatableField;
    readonly locale: SupportedLocale;
    readonly values: CommerceI18nValues;
    readonly plainTextValues: CommercePlainTextValues;
}): string {
    const stored = values[field][locale];
    if (stored) return stored;
    return locale === 'es' ? plainTextValues[PLAIN_TEXT_KEY[field]] : '';
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
 * @param plainTextValues - Plain-column values for the ES display fallback (HOS-902).
 * @param onChange - Callback receiving the full updated i18n state.
 */
export function CommerceTranslationPanel({
    locale,
    initialValues,
    plainTextValues,
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
                                // HOS-902: display-only fallback, never state — see
                                // `resolveDisplayValue`'s JSDoc.
                                value={resolveDisplayValue({
                                    field,
                                    locale: activeLocale,
                                    values,
                                    plainTextValues
                                })}
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
