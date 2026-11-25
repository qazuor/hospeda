/**
 * @file PromotionFormFields.tsx
 * @description The fields of the owner-promotion form on the kit field set
 * (HOS-2505): every control is a kit `Field` + control whose id is
 * `promotion-<name>`, the namespace the save bar uses to focus the first
 * error. Two Sections: the benefit (what and how much) and the conditions
 * (when, where, for whom).
 */

import { OwnerPromotionDiscountTypeEnum } from '@repo/schemas';
import type { ChangeEvent } from 'react';
import { Field, Section, Select, Textarea, TextInput } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { PromotionAudienceField } from './PromotionAudienceField';
import styles from './PromotionForm.module.css';
import {
    PROMOTION_DISCOUNT_TYPE_VALUES,
    type PromotionFieldErrors,
    type PromotionFieldValues
} from './promotion-form-state';
import type { AccommodationsLoad } from './usePromotionForm';

/** Id namespace of the promotion fields. */
export const PROMOTION_FIELD_PREFIX = 'promotion';

/** Translator signature the form uses (`t(key, fallback)`). */
type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/** Props of {@link PromotionFormFields}. */
export interface PromotionFormFieldsProps {
    readonly locale: SupportedLocale;
    readonly t: Translate;
    readonly fields: PromotionFieldValues;
    readonly errors: PromotionFieldErrors;
    readonly accommodationsLoad: AccommodationsLoad;
    /** HOS-2589: X, the free quota, read from the catalog by the SSR page. */
    readonly freeQuota: number | null;
    /** HOS-2589: the tourist VIP plan name, read from the catalog by the SSR page. */
    readonly vipPlanName: string | null;
    /** HOS-2589: whether the owner's plan grants `vip_only_promotions`. */
    readonly vipOnlyAllowed: boolean;
    /** The owner plans page, for the locked «Solo VIP» link. */
    readonly plansHref: string;
    readonly onFieldChange: (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => void;
    readonly onAudienceChange: (value: 'plus' | 'vip') => void;
}

/** Field id parts for one field name. */
const idFor = (name: keyof PromotionFieldValues) => ({ prefix: PROMOTION_FIELD_PREFIX, name });

/**
 * Renders the promotion fields in two Sections.
 *
 * @param props - See {@link PromotionFormFieldsProps}.
 * @returns The benefit and conditions Sections.
 */
export function PromotionFormFields({
    locale,
    t,
    fields,
    errors,
    accommodationsLoad,
    freeQuota,
    vipPlanName,
    vipOnlyAllowed,
    plansHref,
    onFieldChange,
    onAudienceChange
}: PromotionFormFieldsProps) {
    return (
        <>
            <Section
                title={t('host.promotions.kit.benefitSection', 'La promoción')}
                helpId="section:promotions.benefit"
            >
                <div className={styles.fields}>
                    <Field
                        locale={locale}
                        idParts={idFor('title')}
                        label={t('host.promotions.fields.title', 'Título')}
                        required
                        error={errors.title}
                    >
                        <TextInput
                            name="title"
                            value={fields.title}
                            onChange={onFieldChange}
                            maxLength={200}
                        />
                    </Field>
                    <Field
                        locale={locale}
                        idParts={idFor('description')}
                        label={t('host.promotions.fields.description', 'Descripción')}
                        error={errors.description}
                    >
                        <Textarea
                            name="description"
                            value={fields.description}
                            onChange={onFieldChange}
                            rows={3}
                            limit={1000}
                            locale={locale}
                        />
                    </Field>
                    <div className={styles.row}>
                        <Field
                            locale={locale}
                            idParts={idFor('discountType')}
                            label={t('host.promotions.fields.discountType', 'Tipo de descuento')}
                            required
                            error={errors.discountType}
                        >
                            <Select
                                name="discountType"
                                value={fields.discountType}
                                onChange={onFieldChange}
                            >
                                <option value="">
                                    {t(
                                        'host.promotions.fields.discountTypePlaceholder',
                                        'Elegí una opción'
                                    )}
                                </option>
                                {PROMOTION_DISCOUNT_TYPE_VALUES.map((type) => (
                                    <option
                                        key={type}
                                        value={type}
                                    >
                                        {t(`host.promotions.discountTypes.${type}`, type)}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field
                            locale={locale}
                            idParts={idFor('discountValue')}
                            label={t('host.promotions.fields.discountValue', 'Valor del descuento')}
                            required
                            error={errors.discountValue}
                        >
                            <TextInput
                                type="number"
                                name="discountValue"
                                value={fields.discountValue}
                                onChange={onFieldChange}
                                min={0}
                                step={1}
                                max={
                                    fields.discountType ===
                                    OwnerPromotionDiscountTypeEnum.PERCENTAGE
                                        ? 100
                                        : undefined
                                }
                            />
                        </Field>
                    </div>
                </div>
            </Section>

            <Section
                title={t('host.promotions.kit.conditionsSection', 'Condiciones')}
                helpId="section:promotions.conditions"
            >
                <div className={styles.fields}>
                    <div className={styles.row}>
                        <Field
                            locale={locale}
                            idParts={idFor('validFrom')}
                            label={t('host.promotions.fields.validFrom', 'Válido desde')}
                            required
                            error={errors.validFrom}
                        >
                            <TextInput
                                type="date"
                                name="validFrom"
                                value={fields.validFrom}
                                onChange={onFieldChange}
                            />
                        </Field>
                        <Field
                            locale={locale}
                            idParts={idFor('validUntil')}
                            label={t('host.promotions.fields.validUntil', 'Válido hasta')}
                            error={errors.validUntil}
                        >
                            <TextInput
                                type="date"
                                name="validUntil"
                                value={fields.validUntil}
                                onChange={onFieldChange}
                            />
                        </Field>
                    </div>
                    <div className={styles.row}>
                        <Field
                            locale={locale}
                            idParts={idFor('minNights')}
                            label={t('host.promotions.fields.minNights', 'Noches mínimas')}
                            error={errors.minNights}
                        >
                            <TextInput
                                type="number"
                                name="minNights"
                                value={fields.minNights}
                                onChange={onFieldChange}
                                min={1}
                                step={1}
                            />
                        </Field>
                        <Field
                            locale={locale}
                            idParts={idFor('maxRedemptions')}
                            label={t('host.promotions.fields.maxRedemptions', 'Usos máximos')}
                            error={errors.maxRedemptions}
                        >
                            <TextInput
                                type="number"
                                name="maxRedemptions"
                                value={fields.maxRedemptions}
                                onChange={onFieldChange}
                                min={1}
                                step={1}
                            />
                        </Field>
                    </div>
                    <Field
                        locale={locale}
                        idParts={idFor('accommodationId')}
                        label={t('host.promotions.fields.accommodationId', 'Propiedad')}
                        hint={t(
                            'host.promotions.fields.accommodationIdHint',
                            "Elegí una propiedad o dejá 'Todas mis propiedades' para aplicar la promoción a todas."
                        )}
                        error={errors.accommodationId}
                    >
                        <Select
                            name="accommodationId"
                            value={fields.accommodationId}
                            onChange={onFieldChange}
                            disabled={accommodationsLoad.status === 'loading'}
                        >
                            {accommodationsLoad.status === 'loading' ? (
                                <option value="">
                                    {t(
                                        'host.promotions.fields.accommodationIdLoading',
                                        'Cargando propiedades...'
                                    )}
                                </option>
                            ) : (
                                <>
                                    <option value="">
                                        {t(
                                            'host.promotions.fields.accommodationIdAll',
                                            'Todas mis propiedades'
                                        )}
                                    </option>
                                    {accommodationsLoad.status === 'ready' &&
                                        accommodationsLoad.items.map((acc) => (
                                            <option
                                                key={acc.id}
                                                value={acc.id}
                                            >
                                                {acc.label}
                                            </option>
                                        ))}
                                </>
                            )}
                        </Select>
                    </Field>
                    {/* Who sees it (HOS-2589 M-1; replaced the HOS-21 VIP-only toggle) */}
                    <PromotionAudienceField
                        locale={locale}
                        t={t}
                        name={`${PROMOTION_FIELD_PREFIX}-touristAudience`}
                        value={fields.vipOnly ? 'vip' : 'plus'}
                        onChange={onAudienceChange}
                        freeQuota={freeQuota}
                        vipPlanName={vipPlanName}
                        vipOnlyAllowed={vipOnlyAllowed}
                        plansHref={plansHref}
                    />
                </div>
            </Section>
        </>
    );
}
