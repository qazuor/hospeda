/**
 * @file BasicInfoSection.client.tsx
 * @description Form section for basic accommodation info: name, summary,
 * description, type, and destination. Uses native HTML form elements.
 */

import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId, TextField } from '@/components/ui/TextField';
import type { AccommodationEditData, DestinationData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { AiTextImprovePanel } from './AiTextImprovePanel.client';
import styles from './BasicInfoSection.module.css';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';
import { PlanEntitlementGate } from './PlanEntitlementGate.client';
import { RichTextEditor } from './RichTextEditor.client';

/**
 * Identity of the `description` field.
 *
 * This is the one field in the section that does NOT take `<TextField>`
 * (HOS-385 OQ-2). Its control is chosen by an entitlement gate — a rich-text
 * contenteditable or a plain `<textarea>` — so a single label sits above the
 * gate and a single `<FieldError>` below it, and the wrapper renders label,
 * control and error as one contiguous unit. Only the id derivation applies,
 * which is the part that was actually drifting.
 */
const DESCRIPTION_FIELD = {
    prefix: ACCOMMODATION_FIELD_PREFIX,
    name: 'description'
} as const;

const DESCRIPTION_ID = buildFieldId(DESCRIPTION_FIELD);

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
                <TextField
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="name"
                    label={`${t('host.properties.editor.field.name', 'Nombre')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.name}
                    type="text"
                    value={data.name}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    required
                    maxLength={100}
                />
            </div>

            <div className={styles.field}>
                <TextField
                    as="textarea"
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="summary"
                    label={`${t('host.properties.editor.field.summary', 'Descripción corta')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.summary}
                    value={data.summary}
                    onChange={(e) => onFieldChange('summary', e.target.value)}
                    required
                    maxLength={300}
                    rows={3}
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
                    htmlFor={DESCRIPTION_ID}
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
                                id={DESCRIPTION_ID}
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
                                    errors.description
                                        ? buildFieldErrorId(DESCRIPTION_FIELD)
                                        : undefined
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
                        id={DESCRIPTION_ID}
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
                    id={buildFieldErrorId(DESCRIPTION_FIELD)}
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
                <TextField
                    as="select"
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="type"
                    label={t('host.properties.editor.field.type', 'Tipo')}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.type}
                    value={data.type}
                    onChange={(e) => onFieldChange('type', e.target.value)}
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
                </TextField>
            </div>

            <div className={styles.field}>
                {/*
                 * The one id this migration renames: `acc-destination` →
                 * `acc-destinationId`. The old slug dropped the `Id` the Zod key
                 * carries, which is precisely the drift `buildFieldId` removes.
                 * Ids here are internal (no deep links, no external consumers),
                 * so the rename is safe at runtime.
                 */}
                <TextField
                    as="select"
                    prefix={ACCOMMODATION_FIELD_PREFIX}
                    name="destinationId"
                    label={`${t('host.properties.editor.field.destination', 'Destino')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.destinationId}
                    value={data.destinationId}
                    onChange={(e) => onFieldChange('destinationId', e.target.value)}
                    required
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
                </TextField>
            </div>
        </fieldset>
    );
}
