/**
 * @file ListingTranslationPanel.client.tsx
 * @description Owner-facing i18n editing panel for a listing (SPEC-253 T-022).
 *
 * Uses the shared TranslationEditor presentation with a direct-edit UX:
 * owners write translations for nameI18n / summaryI18n / descriptionI18n /
 * richDescriptionI18n directly in the panel, per locale (es/en/pt tabs).
 *
 * The panel is stateless with respect to persistence — it calls `onChange`
 * whenever any field value changes. The parent editor (ListingEditor)
 * collects the full i18n state and includes it in the PATCH payload.
 *
 * Design decisions (D3 — SPEC-253):
 * - Per-locale tab navigation (same three locales as the accommodation panel).
 * - Names use single-line kit inputs; summaries and descriptions autosize.
 * - Shared Section, Tabs, missing hints and row chrome live in account/editor.
 * - The data model and onChange contract stay local, including display-only
 *   Spanish fallback. The editor retains its save bar (saveModel: 'bar').
 */

import type { VenueOrExperience } from '@repo/schemas';
import { type JSX, useCallback, useState } from 'react';
import {
    TranslationEditor,
    TranslationEditorRow
} from '@/components/account/editor/TranslationEditor';
import { TranslationTextControl } from '@/components/account/editor/TranslationTextControl';
import { Field, StatusPill } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

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
export interface ListingI18nValues {
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
export interface ListingPlainTextValues {
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly richDescription: string;
}

/** Props for ListingTranslationPanel. */
export interface ListingTranslationPanelProps {
    /** Active UI locale — also the default active tab. */
    readonly locale: SupportedLocale;
    /** Which vertical the listing belongs to; picks the section copy (venue by default). */
    readonly vertical?: VenueOrExperience;
    /** Initial i18n values sourced from the listing detail. */
    readonly initialValues: ListingI18nValues;
    /**
     * The listing's plain `name`/`summary`/`description`/`richDescription`
     * columns (HOS-902), used ONLY to show real content in the ES tab when
     * the i18n twin is empty — see `resolveDisplayValue`.
     */
    readonly plainTextValues: ListingPlainTextValues;
    /**
     * Called with the full updated i18n state whenever any field changes.
     * The parent editor uses this to build the dirty PATCH payload.
     */
    readonly onChange: (values: ListingI18nValues) => void;
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

type TranslatableField = keyof ListingI18nValues;

const TRANSLATABLE_FIELDS: ReadonlyArray<TranslatableField> = [
    'nameI18n',
    'summaryI18n',
    'descriptionI18n',
    'richDescriptionI18n'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely read an i18n record from raw data as an I18nLocaleValues.
 *
 * Deliberately NO fallback to the plain column here (see HOS-902 history
 * below) — this is the value that becomes `ListingEditor`'s live form
 * state AND its PATCH diff baseline, i.e. it is what gets SAVED. Returns
 * empty strings for any missing locale or field, exactly what is actually
 * stored.
 *
 * HOS-902 correction: an earlier version of this function baked an ES
 * fallback to the plain `name`/`summary`/`description`/`richDescription`
 * column directly into the returned value, reasoning that a field carrying
 * only the fallback is identical between `current` and `baseline` and so
 * never looks dirty on its own. That reasoning broke the moment a SIBLING
 * locale of the SAME field changed: `venueModel`/`experienceModel` do
 * NOT declare `nameI18n`/`summaryI18n`/`descriptionI18n`/`richDescriptionI18n`
 * in `mergeableJsonbColumns` (see `packages/db/src/models/venue/
 * venue.model.ts` and `.../experience/experience.model.ts`, both line
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
export function parseListingI18nValues(raw: Record<string, unknown>): ListingI18nValues {
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
const PLAIN_TEXT_KEY: Record<TranslatableField, keyof ListingPlainTextValues> = {
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
 * HOS-902 note on `parseListingI18nValues` for why baking this into state
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
    readonly values: ListingI18nValues;
    readonly plainTextValues: ListingPlainTextValues;
}): string {
    const stored = values[field][locale];
    if (stored) return stored;
    return locale === 'es' ? plainTextValues[PLAIN_TEXT_KEY[field]] : '';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ListingTranslationPanel
 *
 * Owner-editable i18n panel for a listing. Renders per-locale tabs
 * (es/en/pt) with a textarea per translatable field. Calls `onChange` on every
 * field change so the parent editor can track dirty state.
 *
 * @param locale - Active UI locale (sets the default active tab).
 * @param vertical - The listing's vertical (section copy), `venue` by default.
 * @param initialValues - Initial i18n values from the listing detail.
 * @param plainTextValues - Plain-column values for the ES display fallback (HOS-902).
 * @param onChange - Callback receiving the full updated i18n state.
 */
export function ListingTranslationPanel({
    locale,
    vertical = 'venue',
    initialValues,
    plainTextValues,
    onChange
}: ListingTranslationPanelProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [values, setValues] = useState<ListingI18nValues>(initialValues);

    const handleFieldChange = useCallback(
        (field: TranslatableField, fieldLocale: SupportedLocale, text: string) => {
            setValues((prev) => {
                const updated: ListingI18nValues = {
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
    const fieldLabelFor = (field: TranslatableField, fieldLocale: SupportedLocale): string => {
        const suffix = ` (${LOCALE_LABELS[fieldLocale]})`;
        const base: Record<TranslatableField, string> = {
            nameI18n: t('listing.owner.editor.translationPanel.fieldName', 'Nombre'),
            summaryI18n: t('listing.owner.editor.translationPanel.fieldSummary', 'Resumen'),
            descriptionI18n: t(
                'listing.owner.editor.translationPanel.fieldDescription',
                'Descripción'
            ),
            richDescriptionI18n: t(
                'listing.owner.editor.translationPanel.fieldRichDescription',
                'Descripción ampliada'
            )
        };
        return `${base[field]}${suffix}`;
    };

    const emptyCount = (fieldLocale: SupportedLocale): number =>
        TRANSLATABLE_FIELDS.filter(
            (field) =>
                resolveDisplayValue({ field, locale: fieldLocale, values, plainTextValues }) === ''
        ).length;
    const missingLocales = SUPPORTED_LOCALES.filter(
        (loc) => loc !== 'es' && emptyCount(loc) > 0
    ).map((loc) => LOCALE_LABELS[loc]);

    const renderFields = (fieldLocale: SupportedLocale) => (
        <>
            {TRANSLATABLE_FIELDS.map((field) => {
                const value = resolveDisplayValue({
                    field,
                    locale: fieldLocale,
                    values,
                    plainTextValues
                });
                const stored = Boolean(values[field][fieldLocale]);
                return (
                    <TranslationEditorRow
                        key={field}
                        locale={fieldLocale}
                        heading={
                            value === '' ? (
                                <StatusPill tone="warning">
                                    {t('listing.owner.editor.translationPanel.statusEmpty')}
                                </StatusPill>
                            ) : stored ? (
                                <StatusPill tone="success">
                                    {t('listing.owner.editor.translationPanel.statusFilled')}
                                </StatusPill>
                            ) : (
                                <StatusPill tone="neutral">
                                    {t('listing.owner.editor.translationPanel.statusSource')}
                                </StatusPill>
                            )
                        }
                    >
                        <Field
                            locale={locale}
                            label={fieldLabelFor(field, fieldLocale)}
                            id={`ctp-${field}-${fieldLocale}`}
                        >
                            <TranslationTextControl
                                singleLine={field === 'nameI18n'}
                                value={value}
                                placeholder={t(
                                    'listing.owner.editor.translationPanel.localePlaceholder',
                                    `Ingresá el texto en ${LOCALE_LABELS[fieldLocale]}...`,
                                    { locale: LOCALE_LABELS[fieldLocale] }
                                )}
                                onChange={(text) => handleFieldChange(field, fieldLocale, text)}
                            />
                        </Field>
                    </TranslationEditorRow>
                );
            })}
        </>
    );

    const tabs = SUPPORTED_LOCALES.map((loc) => {
        const count = emptyCount(loc);
        return {
            locale: loc,
            count,
            countLabel: t('listing.owner.editor.translationPanel.missingCount', undefined, {
                count
            }),
            content: renderFields(loc)
        };
    });

    return (
        <TranslationEditor
            locale={locale}
            vertical={vertical}
            description={t(`listing.owner.editor.translationPanel.sectionDescription.${vertical}`)}
            missingNotice={
                missingLocales.length > 0
                    ? t('listing.owner.editor.translationPanel.missingNotice', undefined, {
                          locales: missingLocales.join(', ')
                      })
                    : undefined
            }
            tabs={tabs}
            defaultLocale={locale}
            ariaLabel={t('listing.owner.editor.translationPanel.sectionTitle', 'Traducciones')}
        />
    );
}
