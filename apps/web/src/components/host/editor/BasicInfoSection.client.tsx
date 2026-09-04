/**
 * @file BasicInfoSection.client.tsx
 * @description Form section for basic accommodation info: name, summary,
 * description, type, and destination. Uses native HTML form elements.
 */

import { LockIcon } from '@repo/icons';
import { CharacterCounter } from '@/components/ui/CharacterCounter';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId, TextField } from '@/components/ui/TextField';
import type { AccommodationEditData, DestinationData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
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
const DESCRIPTION_COUNTER_ID = `${DESCRIPTION_ID}-counter`;

/**
 * Id of the plan notice shown in place of the formatting toolbar. Referenced
 * from the textarea's `aria-describedby` so a screen-reader user learns WHY
 * there is no toolbar on focus, rather than only on encountering the notice.
 */
const DESCRIPTION_FORMAT_UPSELL_ID = `${DESCRIPTION_ID}-format-upsell`;

/**
 * Field length limits. Same three fields the publish mini form edits, so the
 * numbers must match it — a host who fills `name` in one screen and edits it in
 * the other cannot be told two different maximums.
 */
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 100;
const SUMMARY_MIN_LENGTH = 10;
const SUMMARY_MAX_LENGTH = 300;
const DESCRIPTION_MIN_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 2000;

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
    readonly shouldOfferSlugRefresh?: boolean;
    readonly refreshSlugFromName?: boolean;
    readonly onRefreshSlugFromNameChange?: (value: boolean) => void;
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
    onFieldChange,
    shouldOfferSlugRefresh = false,
    refreshSlugFromName = false,
    onRefreshSlugFromNameChange
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
                    maxLength={NAME_MAX_LENGTH}
                    counter={{ locale, min: NAME_MIN_LENGTH, testId: 'name-char-counter' }}
                />
                {shouldOfferSlugRefresh ? (
                    <div className={styles.slugNotice}>
                        <p className={styles.fieldHint}>
                            {t(
                                'host.properties.editor.slugRefresh.notice',
                                'Tu ficha ya está publicada. Por defecto la dirección web actual se mantiene aunque cambies el nombre.'
                            )}
                        </p>
                        <p className={styles.fieldHint}>
                            {t(
                                'host.properties.editor.slugRefresh.warning',
                                'Si cambiás la dirección web, podés afectar cómo aparece hoy en Google o en enlaces que ya compartiste.'
                            )}
                        </p>
                        <label className={styles.slugCheckbox}>
                            <input
                                type="checkbox"
                                checked={refreshSlugFromName}
                                onChange={(event) =>
                                    onRefreshSlugFromNameChange?.(event.target.checked)
                                }
                            />
                            <span>
                                {t(
                                    'host.properties.editor.slugRefresh.checkbox',
                                    'Cambiar igual la dirección web para que siga este nuevo nombre'
                                )}
                            </span>
                        </label>
                    </div>
                ) : null}
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
                    maxLength={SUMMARY_MAX_LENGTH}
                    rows={3}
                    counter={{ locale, min: SUMMARY_MIN_LENGTH, testId: 'summary-char-counter' }}
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
                            {/*
                             * Sits ABOVE the textarea, in the slot the rich
                             * editor's formatting toolbar occupies (HOS-800).
                             * Below it, the notice ended up one element away
                             * from the AI-improve trigger and was read as
                             * gating that button — the product owner concluded
                             * the AI feature was plan-restricted while using
                             * it. Placement, the boxed treatment and copy that
                             * leads with the capability instead of the upgrade
                             * verb all serve the same end: this announces a
                             * missing toolbar, not a locked button.
                             */}
                            <div className={styles.formatUpsell}>
                                <LockIcon
                                    className={styles.formatUpsellIcon}
                                    aria-hidden="true"
                                />
                                <p
                                    id={DESCRIPTION_FORMAT_UPSELL_ID}
                                    className={styles.formatUpsellText}
                                >
                                    {t(
                                        'host.properties.editor.entitlement.richDescriptionHint',
                                        'Texto con formato: negritas, listas y más. Disponible en planes superiores.'
                                    )}{' '}
                                    <a
                                        href={buildUrl({
                                            locale,
                                            path: PRICING_PAGE_PATH_BY_AUDIENCE.owner
                                        })}
                                    >
                                        {t(
                                            'host.properties.editor.entitlement.upgradeLink',
                                            'Mejorar plan'
                                        )}
                                    </a>
                                </p>
                            </div>
                            <textarea
                                id={DESCRIPTION_ID}
                                className={styles.fieldInput}
                                value={data.description}
                                onChange={(e) => onFieldChange('description', e.target.value)}
                                rows={6}
                                maxLength={DESCRIPTION_MAX_LENGTH}
                                placeholder={t(
                                    'host.properties.editor.richText.placeholder',
                                    'Describí tu propiedad con detalle...'
                                )}
                                aria-invalid={Boolean(errors.description)}
                                aria-describedby={[
                                    errors.description
                                        ? buildFieldErrorId(DESCRIPTION_FIELD)
                                        : null,
                                    DESCRIPTION_COUNTER_ID,
                                    DESCRIPTION_FORMAT_UPSELL_ID
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                            />
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
                <CharacterCounter
                    id={DESCRIPTION_COUNTER_ID}
                    locale={locale}
                    current={data.description.length}
                    min={DESCRIPTION_MIN_LENGTH}
                    max={DESCRIPTION_MAX_LENGTH}
                    testId="description-char-counter"
                />
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
