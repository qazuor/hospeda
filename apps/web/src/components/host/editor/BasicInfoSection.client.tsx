/**
 * @file BasicInfoSection.client.tsx
 * @description Form section for basic accommodation info: name, summary,
 * description, type, and destination. Uses native HTML form elements.
 */

import type { AccommodationEditData, DestinationData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
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
                    maxLength={200}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? 'acc-name-error' : undefined}
                />
                {errors.name && (
                    <span
                        id="acc-name-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.name}
                    </span>
                )}
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
                    aria-describedby={errors.summary ? 'acc-summary-error' : undefined}
                />
                {errors.summary && (
                    <span
                        id="acc-summary-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.summary}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-description"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.description', 'Descripción')}
                </label>
                <PlanEntitlementGate
                    entitlementKey="can_use_rich_description"
                    upgradeUrl="/suscriptores/precios/"
                    locale={locale}
                >
                    <RichTextEditor
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
                {errors.description && (
                    <span
                        id="acc-description-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.description}
                    </span>
                )}
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
                    aria-describedby={errors.type ? 'acc-type-error' : undefined}
                >
                    <option value="HOTEL">Hotel</option>
                    <option value="APARTMENT">Apartamento</option>
                    <option value="HOSTEL">Hostel</option>
                    <option value="HOUSE">Casa</option>
                    <option value="CABIN">Cabaña</option>
                    <option value="LOFT">Loft</option>
                    <option value="CONDO">Condado</option>
                    <option value="VILLA">Villa</option>
                    <option value="OTHER">Otro</option>
                </select>
                {errors.type && (
                    <span
                        id="acc-type-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.type}
                    </span>
                )}
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
                    aria-describedby={errors.destinationId ? 'acc-destination-error' : undefined}
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
                {errors.destinationId && (
                    <span
                        id="acc-destination-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.destinationId}
                    </span>
                )}
            </div>
        </fieldset>
    );
}
