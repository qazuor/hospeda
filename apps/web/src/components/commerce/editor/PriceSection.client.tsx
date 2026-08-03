/**
 * @file PriceSection.client.tsx
 * @description Price fields of the commerce owner editor (HOS-258).
 *
 * The only section whose SHAPE depends on the vertical: gastronomy edits a
 * price tier plus a menu link, experience edits a price-on-request toggle plus
 * a starting price and its unit. The accommodation editor has no analogue —
 * none of its sections branch on an entity type.
 *
 * Kept as ONE component with internal branching rather than two conditionally
 * mounted ones (HOS-258 OQ-1): both branches share the section chrome and the
 * `editor-price` anchor, and the owner should see a single price entry in the
 * section navigation either way.
 *
 * The `null`-vs-omitted asymmetry between the two branches is NOT visible here
 * — it lives in `buildPatchPayload`. See the spec's §7.1 table.
 */

import { ExperiencePriceUnitEnum, PriceRangeEnum } from '@repo/schemas';
import type { JSX } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { CommerceEditData, CommerceFieldChange } from './commerce-edit-data';
import styles from './editor-fields.module.css';

/** Experience price unit options. */
const PRICE_UNIT_OPTIONS = Object.values(ExperiencePriceUnitEnum);

export interface PriceSectionProps {
    readonly locale: SupportedLocale;
    readonly vertical: CommerceVertical;
    readonly data: CommerceEditData;
    readonly errors: Readonly<{
        menuUrl?: string;
        priceFrom?: string;
        priceUnit?: string;
    }>;
    readonly onFieldChange: CommerceFieldChange;
}

export function PriceSection({
    locale,
    vertical,
    data,
    errors,
    onFieldChange
}: PriceSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    if (vertical === 'gastronomy') {
        return (
            <section
                className={styles.section}
                id="editor-price"
            >
                <label
                    className={styles.label}
                    htmlFor="ce-priceRange"
                >
                    {t('commerce.owner.editor.sections.priceRange', 'Rango de precios')}
                </label>
                <select
                    id="ce-priceRange"
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
                            {tier}
                        </option>
                    ))}
                </select>

                <label
                    className={styles.label}
                    htmlFor="ce-menuUrl"
                >
                    {t('commerce.owner.editor.sections.menuUrl', 'Enlace al menú')}
                </label>
                <input
                    id="ce-menuUrl"
                    className={styles.input}
                    type="url"
                    value={data.menuUrl}
                    placeholder="https://..."
                    aria-invalid={errors.menuUrl ? 'true' : 'false'}
                    aria-describedby={errors.menuUrl ? fieldErrorId('menuUrl') : undefined}
                    onChange={(event) => {
                        onFieldChange('menuUrl', event.target.value);
                    }}
                />
                <FieldError
                    id={fieldErrorId('menuUrl')}
                    message={errors.menuUrl}
                />
            </section>
        );
    }

    return (
        <section
            className={styles.section}
            id="editor-price"
        >
            {/* isPriceOnRequest toggle */}
            <label className={styles.checkbox}>
                <input
                    type="checkbox"
                    checked={data.isPriceOnRequest}
                    onChange={(event) => {
                        onFieldChange('isPriceOnRequest', event.target.checked);
                    }}
                />
                {t('commerce.owner.editor.sections.isPriceOnRequest', 'Precio a consultar')}
            </label>

            {/* T-021: priceFrom — disabled when isPriceOnRequest */}
            <label
                className={styles.label}
                htmlFor="ce-priceFrom"
            >
                {t('commerce.owner.editor.sections.priceFrom', 'Precio desde (centavos)')}
            </label>
            <input
                id="ce-priceFrom"
                className={styles.input}
                type="number"
                min={0}
                step={1}
                disabled={data.isPriceOnRequest}
                value={data.priceFrom ?? ''}
                aria-invalid={errors.priceFrom ? 'true' : 'false'}
                aria-describedby={errors.priceFrom ? fieldErrorId('priceFrom') : undefined}
                onChange={(event) => {
                    const raw = event.target.value;
                    const parsed = raw === '' ? null : Math.floor(Number(raw));
                    onFieldChange('priceFrom', parsed);
                }}
            />
            <FieldError
                id={fieldErrorId('priceFrom')}
                message={errors.priceFrom}
            />

            {/* T-021: priceUnit select — disabled when isPriceOnRequest */}
            <label
                className={styles.label}
                htmlFor="ce-priceUnit"
            >
                {t('commerce.owner.editor.sections.priceUnit', 'Unidad de precio')}
            </label>
            <select
                id="ce-priceUnit"
                className={styles.input}
                value={data.priceUnit}
                disabled={data.isPriceOnRequest}
                aria-invalid={errors.priceUnit ? 'true' : 'false'}
                aria-describedby={errors.priceUnit ? fieldErrorId('priceUnit') : undefined}
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
                        {t(`commerce.owner.editor.priceUnitOption.${unit}`, unit)}
                    </option>
                ))}
            </select>
            <FieldError
                id={fieldErrorId('priceUnit')}
                message={errors.priceUnit}
            />
        </section>
    );
}
