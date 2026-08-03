/**
 * @file BasicInfoSection.client.tsx
 * @description Form section for basic accommodation info: name, summary,
 * description, type, and destination. Uses native HTML form elements.
 */

import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { AccommodationEditData, DestinationData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { AiTextImprovePanel } from './AiTextImprovePanel.client';
import styles from './BasicInfoSection.module.css';
import { PlanEntitlementGate } from './PlanEntitlementGate.client';
import { RichTextEditor } from './RichTextEditor.client';

/** Props for BasicInfoSection. */
export interface BasicInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly destinations: readonly DestinationData[];
    readonly errors: Readonly<{
        name?: string;
        summary?: string;
        description?: string;
        type?: string;
        destinationId?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}

/**
 * Basic information form section.
 * Renders name, summary, description, type, and destination fields.
 */
export function BasicInfoSection({
    locale,
    data,
    destinations,
    errors,
    onFieldChange
}: BasicInfoSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.basicInfo', 'Información básica')}
            </legend>

            <div className={styles.field}>
                <label
                    htmlFor="acc-name"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.name', 'Nombre')} *
                </label>
                <input
                    id="acc-name"
                    type="text"
                    className={styles.fieldInput}
                    value={data.name}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    required
                    maxLength={100}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? fieldErrorId('acc-name') : undefined}
                />
                <FieldError
                    id={fieldErrorId('acc-name')}
                    message={errors.name}
                    className={styles.fieldErrorSpacing}
                />
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-summary"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.summary', 'Resumen')} *
                </label>
                <textarea
                    id="acc-summary"
                    className={styles.fieldInput}
                    value={data.summary}
                    onChange={(e) => onFieldChange('summary', e.target.value)}
                    required
                    maxLength={300}
                    rows={3}
                    aria-invalid={Boolean(errors.summary)}
                    aria-describedby={errors.summary ? fieldErrorId('acc-summary') : undefined}
                />
                <FieldError
                    id={fieldErrorId('acc-summary')}
                    message={errors.summary}
                    className={styles.fieldErrorSpacing}
                />
                <PlanEntitlementGate
                    entitlementKey="ai_text_improve"
                    locale={locale}
                    fallback={null}
                >
                    <AiTextImprovePanel
                        fieldType="summary"
                        fieldValue={data.summary}
                        locale={locale}
                        onAccept={(suggestion) => onFieldChange('summary', suggestion)}
                        triggerDisabled={!data.summary}
                    />
                </PlanEntitlementGate>
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-description"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.description', 'Descripción')}
                </label>
                {/*
                 * The entitlement gates RICH text (formatting), NOT the ability
                 * to write a description. Without `can_use_rich_description` the
                 * host still edits a plain-text description; the entitlement only
                 * unlocks the formatted editor. The fallback keeps the field fully
                 * editable plus a non-blocking nudge to upgrade for rich text.
                 */}
                <PlanEntitlementGate
                    entitlementKey="can_use_rich_description"
                    locale={locale}
                    fallback={
                        <>
                            <textarea
                                id="acc-description"
                                className={styles.fieldInput}
                                value={data.description}
                                onChange={(e) => onFieldChange('description', e.target.value)}
                                rows={6}
                                maxLength={2000}
                                placeholder={t(
                                    'host.properties.editor.richText.placeholder',
                                    'Describí tu propiedad con detalle...'
                                )}
                                aria-invalid={Boolean(errors.description)}
                                aria-describedby={
                                    errors.description ? fieldErrorId('acc-description') : undefined
                                }
                            />
                            <p className={styles.fieldHint}>
                                {t(
                                    'host.properties.editor.entitlement.richDescriptionHint',
                                    'Mejorá tu plan para dar formato a tu descripción (negritas, listas y más).'
                                )}{' '}
                                <a href={buildUrl({ locale, path: 'suscriptores/planes' })}>
                                    {t(
                                        'host.properties.editor.entitlement.upgradeLink',
                                        'Mejorar plan'
                                    )}
                                </a>
                            </p>
                        </>
                    }
                >
                    <RichTextEditor
                        id="acc-description"
                        value={data.description}
                        onChange={(value) => onFieldChange('description', value)}
                        placeholder={t(
                            'host.properties.editor.richText.placeholder',
                            'Describí tu propiedad con detalle...'
                        )}
                        hasError={Boolean(errors.description)}
                        errorMessage={errors.description}
                    />
                </PlanEntitlementGate>
                <FieldError
                    id={fieldErrorId('acc-description')}
                    message={errors.description}
                    className={styles.fieldErrorSpacing}
                />
                {/*
                 * Independent entitlement from `can_use_rich_description` above:
                 * an owner can have AI-improve without rich text, rich text
                 * without AI-improve, both, or neither. Sits alongside the
                 * field regardless of which branch (RichTextEditor or plain
                 * textarea) the rich-description gate rendered, since both
                 * paths flow through the same `data.description` +
                 * `onFieldChange('description', ...)` controlled-value contract.
                 */}
                <PlanEntitlementGate
                    entitlementKey="ai_text_improve"
                    locale={locale}
                    fallback={null}
                >
                    <AiTextImprovePanel
                        fieldType="description"
                        fieldValue={data.description}
                        locale={locale}
                        onAccept={(suggestion) => onFieldChange('description', suggestion)}
                        triggerDisabled={!data.description}
                    />
                </PlanEntitlementGate>
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-type"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.type', 'Tipo')}
                </label>
                <select
                    id="acc-type"
                    className={styles.fieldInput}
                    value={data.type}
                    onChange={(e) => onFieldChange('type', e.target.value)}
                    aria-invalid={Boolean(errors.type)}
                    aria-describedby={errors.type ? fieldErrorId('acc-type') : undefined}
                >
                    <option value="HOTEL">Hotel</option>
                    <option value="APARTMENT">Apartamento</option>
                    <option value="HOSTEL">Hostel</option>
                    <option value="HOUSE">Casa</option>
                    <option value="CABIN">Cabaña</option>
                    <option value="COUNTRY_HOUSE">Casa de campo</option>
                    <option value="CAMPING">Camping</option>
                    <option value="ROOM">Habitación</option>
                    <option value="MOTEL">Motel</option>
                    <option value="RESORT">Resort</option>
                    <option value="APART_HOTEL">Aparthotel</option>
                    <option value="ESTANCIA">Estancia</option>
                    <option value="BED_AND_BREAKFAST">Bed & Breakfast</option>
                </select>
                <FieldError
                    id={fieldErrorId('acc-type')}
                    message={errors.type}
                    className={styles.fieldErrorSpacing}
                />
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-destination"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.destination', 'Destino')} *
                </label>
                <select
                    id="acc-destination"
                    className={styles.fieldInput}
                    value={data.destinationId}
                    onChange={(e) => onFieldChange('destinationId', e.target.value)}
                    required
                    aria-invalid={Boolean(errors.destinationId)}
                    aria-describedby={
                        errors.destinationId ? fieldErrorId('acc-destination') : undefined
                    }
                >
                    <option value="">
                        {t(
                            'host.properties.editor.field.destinationPlaceholder',
                            'Seleccionar destino...'
                        )}
                    </option>
                    {destinations.map((dest) => (
                        <option
                            key={dest.id}
                            value={dest.id}
                        >
                            {dest.name}
                        </option>
                    ))}
                </select>
                <FieldError
                    id={fieldErrorId('acc-destination')}
                    message={errors.destinationId}
                    className={styles.fieldErrorSpacing}
                />
            </div>
        </fieldset>
    );
}
