/**
 * @file PriceSection.client.tsx
 * @description Price fields of the listing owner editor (HOS-258).
 *
 * The only section whose SHAPE depends on the vertical: venue edits a price
 * tier, experience edits a price-on-request toggle plus a starting price and
 * its unit. Which controls are painted is read from the catalog's `price`
 * section for the active vertical (DEC-FAC-062 moved the menu link out of
 * price, into the carta). The accommodation editor has no analogue — none of
 * its sections branch on an entity type.
 *
 * Kept as ONE component with catalog-driven groups rather than two conditionally
 * mounted ones (HOS-258 OQ-1): both branches share the section chrome and the
 * `editor-price` anchor, and the owner should see a single price entry in the
 * section navigation either way.
 *
 * The `null`-vs-omitted asymmetry between the two branches is NOT visible here
 * — it lives in `buildPatchPayload`. See the spec's §7.1 table.
 *
 * ## Price unit (HOS-809)
 *
 * `ListingEditData.priceFrom` stays in CENTAVOS end to end — it is loaded from
 * the API, diffed against the baseline and PATCHed back by
 * `ListingEditor` without ever being interpreted, so changing its unit
 * would have meant auditing all three. The peso ↔ centavo conversion happens
 * HERE instead, at the one place the number is shown to and typed by a person.
 * Both directions come from `@/lib/listing/price-units`; a display that
 * divides without an input that multiplies would multiply the stored price by
 * 100 on every save.
 */

import { ExperiencePriceUnitEnum, LISTING_SECTIONS, PriceRangeEnum } from '@repo/schemas';
import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/listing/price-units';
import styles from './editor-fields.module.css';
import { LISTING_FIELD_PREFIX } from './field-ids';
import type { ListingEditData, ListingFieldChange } from './listing-edit-data';

/** Experience price unit options. */
const PRICE_UNIT_OPTIONS = Object.values(ExperiencePriceUnitEnum);

/**
 * The catalog's `price` fields per vertical, as a lookup.
 *
 * A lookup rather than `find(section => section.id === 'price')`: G-FAC-05
 * (leaf 5.8) scans the editor files for comparisons against section-id
 * literals, and the catalog already declares which fields `price` owns.
 */
const PRICE_FIELDS_BY_VERTICAL: Readonly<Record<string, readonly string[]>> = (() => {
    const byVertical: Record<string, readonly string[]> = {};

    for (const [vertical, sections] of Object.entries(LISTING_SECTIONS)) {
        byVertical[vertical] =
            Object.fromEntries(
                (
                    sections as ReadonlyArray<{
                        readonly id: string;
                        readonly fields: readonly string[];
                    }>
                ).map((section) => [section.id, section.fields])
            ).price ?? [];
    }

    return byVertical;
})();

export interface PriceSectionProps {
    readonly locale: SupportedLocale;
    readonly vertical: VenueOrExperience;
    readonly data: ListingEditData;
    readonly errors: Readonly<{
        priceFrom?: string;
        priceUnit?: string;
    }>;
    readonly onFieldChange: ListingFieldChange;
}

export function PriceSection({
    locale,
    vertical,
    data,
    errors,
    onFieldChange
}: PriceSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const priceFields = PRICE_FIELDS_BY_VERTICAL[vertical] ?? [];
    const showsTier = priceFields.includes('priceRange');
    const showsExperiencePricing = priceFields.includes('isPriceOnRequest');

    return (
        <section
            className={styles.section}
            id="editor-price"
        >
            {showsTier ? (
                <TextField
                    as="select"
                    prefix={LISTING_FIELD_PREFIX}
                    name="priceRange"
                    label={t('listing.owner.editor.sections.priceRange', 'Rango de precios')}
                    labelClassName={styles.label}
                    className={styles.input}
                    value={data.priceRange}
                    onChange={(event) => {
                        onFieldChange('priceRange', event.target.value);
                    }}
                >
                    <option value="">—</option>
                    {Object.values(PriceRangeEnum).map((tier) => (
                        <option
                            key={tier}
                            value={tier}
                        >
                            {t(`listing.owner.editor.priceRangeOption.${tier}`, tier)}
                        </option>
                    ))}
                </TextField>
            ) : null}

            {showsExperiencePricing ? (
                <>
                    {/* isPriceOnRequest toggle */}
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={data.isPriceOnRequest}
                            onChange={(event) => {
                                onFieldChange('isPriceOnRequest', event.target.checked);
                            }}
                        />
                        {t('listing.owner.editor.sections.isPriceOnRequest', 'Precio a consultar')}
                    </label>

                    {/* T-021: priceFrom — disabled when isPriceOnRequest */}
                    {/* HOS-809: the owner types PESOS; the field value is centavos. */}
                    <TextField
                        prefix={LISTING_FIELD_PREFIX}
                        name="priceFrom"
                        label={t(
                            'listing.owner.editor.sections.priceFromWithCurrency',
                            'Precio desde (ARS)'
                        )}
                        labelClassName={styles.label}
                        className={styles.input}
                        error={errors.priceFrom}
                        type="number"
                        min={0}
                        step={1}
                        disabled={data.isPriceOnRequest}
                        value={centsToPesosInputValue({ cents: data.priceFrom })}
                        onChange={(event) => {
                            onFieldChange(
                                'priceFrom',
                                parsePesosInputToCents({ raw: event.target.value })
                            );
                        }}
                    />

                    {/* T-021: priceUnit select — disabled when isPriceOnRequest */}
                    <TextField
                        as="select"
                        prefix={LISTING_FIELD_PREFIX}
                        name="priceUnit"
                        label={t('listing.owner.editor.sections.priceUnit', 'Unidad de precio')}
                        labelClassName={styles.label}
                        className={styles.input}
                        error={errors.priceUnit}
                        value={data.priceUnit}
                        disabled={data.isPriceOnRequest}
                        onChange={(event) => {
                            onFieldChange('priceUnit', event.target.value);
                        }}
                    >
                        <option value="">—</option>
                        {PRICE_UNIT_OPTIONS.map((unit) => (
                            <option
                                key={unit}
                                value={unit}
                            >
                                {t(`listing.owner.editor.priceUnitOption.${unit}`, unit)}
                            </option>
                        ))}
                    </TextField>
                </>
            ) : null}
        </section>
    );
}
