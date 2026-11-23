/**
 * @file BasicInfoSection.client.tsx
 * @description Form section for basic accommodation info: name, summary,
 * description, type, and destination. Uses native HTML form elements.
 */

import { LockIcon } from '@repo/icons';
import { Checkbox } from '@/components/account/ui/Checkbox';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Select } from '@/components/account/ui/Select';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
import { CharacterCounter } from '@/components/ui/CharacterCounter';
import type { AccommodationEditData, DestinationData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
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
 * Accommodation type values in display order. Labels resolve through
 * `host.miniForm.types.<VALUE>` in `@repo/i18n` (es, en, pt; HOS-2436, HOS-2488),
 * so the section carries no Spanish copy of its own.
 */
const ACCOMMODATION_TYPE_VALUES = [
    'HOTEL',
    'APARTMENT',
    'HOSTEL',
    'HOUSE',
    'CABIN',
    'COUNTRY_HOUSE',
    'CAMPING',
    'ROOM',
    'MOTEL',
    'RESORT',
    'APART_HOTEL',
    'ESTANCIA',
    'BED_AND_BREAKFAST'
] as const;

/**
 * Field length limits. Same three fields the publish mini form edits, so the
 * numbers must match it — a host who fills `name` in one screen and edits it in
 * the other cannot be told two different maximums.
 */
const SUMMARY_COUNTER_ID = `${buildFieldId({ prefix: ACCOMMODATION_FIELD_PREFIX, name: 'summary' })}-counter`;
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 100;
const SUMMARY_MIN_LENGTH = 10;
const SUMMARY_MAX_LENGTH = 300;
const DESCRIPTION_MIN_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 2000;

/**
 * Caps a value at the field's maximum, as the native `maxLength` it replaces
 * did: the kit `Textarea` takes no `maxLength` unless it also draws its own
 * counter, and this section keeps the `CharacterCounter` that shows the minimum.
 */
function capLength(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
}

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
    /**
     * Whether the published-slug opt-in notice/checkbox should render next to
     * the `name` field — i.e. the name changed on a published listing.
     */
    readonly shouldOfferSlugRefreshNearName?: boolean;
    /**
     * Same opt-in, next to the `type` field — i.e. the type changed on a
     * published listing (HOS-879). `nearName` and `nearType` are independent:
     * either, both, or neither can be true, but both control the SAME
     * `refreshSlugFromName` state (see below) — there is only one opt-in, just
     * rendered wherever the host is looking.
     */
    readonly shouldOfferSlugRefreshNearType?: boolean;
    readonly refreshSlugFromName?: boolean;
    readonly onRefreshSlugFromNameChange?: (value: boolean) => void;
}

/** Disambiguator for the two possible render positions of the shared opt-in. */
type SlugRefreshPosition = 'name' | 'type';

/** Props for the shared published-slug opt-in notice. */
interface SlugRefreshNoticeProps {
    readonly position: SlugRefreshPosition;
    readonly t: TranslationFn;
    readonly refreshSlugFromName: boolean;
    readonly onRefreshSlugFromNameChange?: (value: boolean) => void;
}

/**
 * The published-slug opt-in notice + checkbox, rendered next to whichever
 * field (`name`, `type`, or both) actually changed (HOS-879 UX follow-up).
 *
 * It is ONE logical control that can render in two DOM positions at once, so
 * each instance gets its own id via `buildFieldId`'s `suffix` — two `<input>`s
 * sharing an id would break the `label`/`input` association for assistive
 * tech. Both instances read and write the same `refreshSlugFromName` state
 * from the parent, so checking either one moves both in lockstep.
 */
function SlugRefreshNotice({
    position,
    t,
    refreshSlugFromName,
    onRefreshSlugFromNameChange
}: SlugRefreshNoticeProps) {
    const checkboxId = buildFieldId({
        prefix: ACCOMMODATION_FIELD_PREFIX,
        name: 'slugRefresh',
        suffix: position
    });

    return (
        <div className={styles.notice}>
            <p className={styles.hint}>
                {t(
                    'host.properties.editor.slugRefresh.notice',
                    'Tu ficha ya está publicada. Por defecto la dirección web actual se mantiene aunque cambies el nombre o el tipo.'
                )}
            </p>
            <p className={styles.hint}>
                {t(
                    'host.properties.editor.slugRefresh.warning',
                    'Si cambiás la dirección web, podés afectar cómo aparece hoy en Google o en enlaces que ya compartiste.'
                )}
            </p>
            <Checkbox
                id={checkboxId}
                checked={refreshSlugFromName}
                onChange={(event) => onRefreshSlugFromNameChange?.(event.target.checked)}
                label={t(
                    'host.properties.editor.slugRefresh.checkbox',
                    'Cambiar igual la dirección web para que siga estos cambios'
                )}
            />
        </div>
    );
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
    shouldOfferSlugRefreshNearName = false,
    shouldOfferSlugRefreshNearType = false,
    refreshSlugFromName = false,
    onRefreshSlugFromNameChange
}: BasicInfoSectionProps) {
    const { t } = createTranslations(locale);
    const idOf = (name: string) => ({ prefix: ACCOMMODATION_FIELD_PREFIX, name });

    return (
        <Section
            title={t('host.properties.editor.groups.basicInfo', 'Cómo se presenta tu alojamiento')}
            helpId={sectionHelpId({ vertical: 'accommodation', slug: 'datos' })}
        >
            <div className={styles.grid}>
                <Field
                    locale={locale}
                    idParts={idOf('name')}
                    label={t('host.properties.editor.field.name', 'Nombre')}
                    error={errors.name}
                    required
                >
                    <TextInput
                        value={data.name}
                        onChange={(e) => onFieldChange('name', e.target.value)}
                        maxLength={NAME_MAX_LENGTH}
                        aria-describedby={`${buildFieldId(idOf('name'))}-counter`}
                    />
                    <CharacterCounter
                        id={`${buildFieldId(idOf('name'))}-counter`}
                        locale={locale}
                        current={data.name.length}
                        min={NAME_MIN_LENGTH}
                        max={NAME_MAX_LENGTH}
                        testId="name-char-counter"
                    />
                </Field>

                <Field
                    locale={locale}
                    idParts={idOf('type')}
                    label={t('host.properties.editor.field.type', 'Tipo')}
                    error={errors.type}
                >
                    <Select
                        value={data.type}
                        onChange={(e) => onFieldChange('type', e.target.value)}
                    >
                        {ACCOMMODATION_TYPE_VALUES.map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(`host.miniForm.types.${value}`, value)}
                            </option>
                        ))}
                    </Select>
                </Field>

                {/*
                 * The id `acc-destination` became `acc-destinationId`: the old
                 * slug dropped the `Id` the Zod key carries, which is the drift
                 * `buildFieldId` removes. Ids are internal, so the rename is safe.
                 */}
                <Field
                    locale={locale}
                    idParts={idOf('destinationId')}
                    label={t('host.properties.editor.field.destination', 'Destino')}
                    error={errors.destinationId}
                    required
                >
                    <Select
                        value={data.destinationId}
                        onChange={(e) => onFieldChange('destinationId', e.target.value)}
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
                    </Select>
                </Field>

                {shouldOfferSlugRefreshNearName ? (
                    <div className={styles.full}>
                        <SlugRefreshNotice
                            position="name"
                            t={t}
                            refreshSlugFromName={refreshSlugFromName}
                            onRefreshSlugFromNameChange={onRefreshSlugFromNameChange}
                        />
                    </div>
                ) : null}
                {shouldOfferSlugRefreshNearType ? (
                    <div className={styles.full}>
                        <SlugRefreshNotice
                            position="type"
                            t={t}
                            refreshSlugFromName={refreshSlugFromName}
                            onRefreshSlugFromNameChange={onRefreshSlugFromNameChange}
                        />
                    </div>
                ) : null}

                <div className={styles.full}>
                    <Field
                        locale={locale}
                        idParts={idOf('summary')}
                        label={t('host.properties.editor.field.summary', 'Descripción corta')}
                        error={errors.summary}
                        required
                    >
                        <Textarea
                            value={data.summary}
                            onChange={(e) =>
                                onFieldChange(
                                    'summary',
                                    capLength(e.target.value, SUMMARY_MAX_LENGTH)
                                )
                            }
                            rows={3}
                            aria-describedby={SUMMARY_COUNTER_ID}
                        />
                        <CharacterCounter
                            id={SUMMARY_COUNTER_ID}
                            locale={locale}
                            current={data.summary.length}
                            min={SUMMARY_MIN_LENGTH}
                            max={SUMMARY_MAX_LENGTH}
                            testId="summary-char-counter"
                        />
                    </Field>
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

                <div className={styles.full}>
                    <Field
                        locale={locale}
                        id={DESCRIPTION_ID}
                        label={t('host.properties.editor.field.description', 'Descripción')}
                        error={errors.description}
                    >
                        {/*
                         * The entitlement gates RICH text (formatting), NOT the
                         * ability to write a description. Without
                         * `can_use_rich_description` the host still edits a plain
                         * description; the gate only unlocks the formatted editor.
                         */}
                        <PlanEntitlementGate
                            entitlementKey="can_use_rich_description"
                            locale={locale}
                            fallback={
                                <>
                                    {/*
                                     * Sits ABOVE the textarea, in the slot the rich
                                     * editor's toolbar occupies (HOS-800), and names
                                     * the field it is about (HOS-2488), so it reads as
                                     * a missing toolbar and never as a locked button.
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
                                                'Texto con formato en la descripción: negritas, listas y más. Disponible en planes superiores.'
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
                                    <Textarea
                                        value={data.description}
                                        onChange={(e) =>
                                            onFieldChange(
                                                'description',
                                                capLength(e.target.value, DESCRIPTION_MAX_LENGTH)
                                            )
                                        }
                                        rows={6}
                                        placeholder={t(
                                            'host.properties.editor.richText.placeholder',
                                            'Describí tu propiedad con detalle...'
                                        )}
                                        aria-describedby={`${DESCRIPTION_COUNTER_ID} ${DESCRIPTION_FORMAT_UPSELL_ID}`}
                                    />
                                </>
                            }
                        >
                            <RichTextEditor
                                id={DESCRIPTION_ID}
                                locale={locale}
                                value={data.description}
                                onChange={(value) => onFieldChange('description', value)}
                                placeholder={t(
                                    'host.properties.editor.richText.placeholder',
                                    'Describí tu propiedad con detalle...'
                                )}
                                hasError={Boolean(errors.description)}
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
                    </Field>
                    {/*
                     * Independent entitlement from `can_use_rich_description`: an
                     * owner can have AI-improve without rich text and vice versa.
                     * Both branches share the same `data.description` contract.
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
            </div>
        </Section>
    );
}
