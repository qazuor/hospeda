/**
 * @file BasicInfoSection.client.tsx
 * @description Identity + descriptive fields of the listing owner editor
 * (HOS-258): name, destination, type, summary, description, rich description.
 *
 * Mirrors `host/editor/BasicInfoSection.client.tsx`: receives the whole
 * `data` object, a typed slice of `errors`, and the shared `onFieldChange`.
 * HOS-2488: one kit `Section` with a 1-3 column grid (container query); every
 * field is a kit `Field` + control, so each one has a visible label, a 44px
 * control and its own hint and error. Ids stay `buildFieldId` ids.
 */

import type { JSX } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { Checkbox } from '@/components/account/ui/Checkbox';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Select } from '@/components/account/ui/Select';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';
import type { DestinationOption } from '@/components/listing/destination-option';
import { BusinessLinesField } from '@/components/listing/editor/BusinessLinesField.client';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { LISTING_VERTICAL_FORM_CONFIG } from '@/lib/listing/listing-vertical-form-config';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { LISTING_FIELD_PREFIX } from './field-ids';
import type { ListingEditData, ListingFieldChange } from './listing-edit-data';
import styles from './listing-section.module.css';

/** Max length of the summary, shared with the schema (T-020). */
const SUMMARY_MAX_LENGTH = 300;

/**
 * `richDescription` is a contenteditable named by `ariaLabel` (a `<label>` cannot
 * name a `role="textbox"`). Its id is still DERIVED, which is the half that was
 * drifting; the kit `Field` supplies the visible label.
 */
const RICH_DESCRIPTION_ID = buildFieldId({
    prefix: LISTING_FIELD_PREFIX,
    name: 'richDescription'
});

export interface BasicInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly vertical: VenueOrExperience;
    readonly data: ListingEditData;
    readonly destinations: readonly DestinationOption[];
    readonly destinationsLoadFailed: boolean;
    readonly errors: Readonly<{
        name?: string;
        destinationId?: string;
        summary?: string;
        description?: string;
        businessLines?: string;
    }>;
    readonly onFieldChange: ListingFieldChange;
    readonly shouldOfferSlugRefresh?: boolean;
    /** UUID of the listing; the business-line removal notice reads its sections. */
    readonly listingId?: string;
}

export function BasicInfoSection({
    locale,
    vertical,
    data,
    destinations,
    destinationsLoadFailed,
    errors,
    onFieldChange,
    shouldOfferSlugRefresh = false,
    listingId
}: BasicInfoSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const config = LISTING_VERTICAL_FORM_CONFIG[vertical];
    const typeOptions = config.typeOptions;
    const idOf = (name: string): { readonly prefix: string; readonly name: string } => ({
        prefix: LISTING_FIELD_PREFIX,
        name
    });

    return (
        <Section
            id="editor-basicInfo"
            title={t('listing.owner.editor.groups.basicInfo', 'Identidad y descripción')}
            helpId={sectionHelpId({ vertical, slug: 'datos' })}
        >
            <div className={styles.grid}>
                {/* HOS-166 D-1: name, identity field, owner-editable */}
                <Field
                    locale={locale}
                    idParts={idOf('name')}
                    label={t('listing.owner.editor.sections.name', 'Nombre del comercio')}
                    error={errors.name}
                >
                    <TextInput
                        value={data.name}
                        onChange={(event) => {
                            onFieldChange('name', event.target.value);
                        }}
                    />
                </Field>
                {/* HOS-166 D-1 destinationId. `destinationsLoadFailed` surfaces a
                    failed SSR catalog fetch instead of silently omitting a REQUIRED
                    field; HOS-260 does the same for an empty catalog. */}
                {destinationsLoadFailed ? (
                    <div className={styles.full}>
                        <Alert
                            tone="danger"
                            locale={locale}
                        >
                            {t(
                                'listing.owner.editor.sections.destinationLoadError',
                                'No pudimos cargar el listado de ciudades / destinos. Recargá la página para reintentar.'
                            )}
                        </Alert>
                    </div>
                ) : destinations.length > 0 ? (
                    <Field
                        locale={locale}
                        idParts={idOf('destinationId')}
                        label={t('listing.owner.editor.sections.destination', 'Ciudad / Destino')}
                        error={errors.destinationId}
                    >
                        <Select
                            value={data.destinationId}
                            onChange={(event) => {
                                onFieldChange('destinationId', event.target.value);
                            }}
                        >
                            <option value="">—</option>
                            {destinations.map((d) => (
                                <option
                                    key={d.id}
                                    value={d.id}
                                >
                                    {d.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                ) : (
                    <div className={styles.full}>
                        <Alert
                            tone="danger"
                            locale={locale}
                        >
                            {t(
                                'listing.owner.editor.sections.destinationEmpty',
                                'Todavía no hay ciudades / destinos cargados. Contactanos para poder completar este campo.'
                            )}
                        </Alert>
                    </div>
                )}

                {/* T-020: `type` is the Zod key, `listingType` the React state key
                    (HOS-385 unifies the id layer, not the state layer). */}
                <Field
                    locale={locale}
                    idParts={idOf('type')}
                    label={t('listing.owner.editor.sections.type', 'Categoría')}
                    hint={
                        config.showsTypeDescription && data.listingType
                            ? t(`venue.typeDescriptions.${data.listingType}`, '')
                            : undefined
                    }
                >
                    <Select
                        value={data.listingType}
                        onChange={(event) => {
                            onFieldChange('listingType', event.target.value);
                        }}
                    >
                        <option value="">—</option>
                        {typeOptions.map((opt) => (
                            <option
                                key={opt}
                                value={opt}
                            >
                                {config.resolveTypeLabel({ t, type: opt })}
                            </option>
                        ))}
                    </Select>
                </Field>
                {shouldOfferSlugRefresh ? (
                    <div className={styles.full}>
                        <div className={styles.notice}>
                            <p className={styles.hint}>
                                {t(
                                    'listing.owner.editor.slugRefresh.notice',
                                    'Esta ficha ya está publicada. Por defecto la dirección web actual se mantiene aunque cambies el nombre.'
                                )}
                            </p>
                            <p className={styles.hint}>
                                {t(
                                    'listing.owner.editor.slugRefresh.warning',
                                    'Si cambiás la dirección web, podés afectar cómo aparece hoy en Google o en enlaces que ya compartiste.'
                                )}
                            </p>
                            <Checkbox
                                checked={data.refreshSlugFromName}
                                onChange={(event) => {
                                    onFieldChange('refreshSlugFromName', event.target.checked);
                                }}
                                label={t(
                                    'listing.owner.editor.slugRefresh.checkbox',
                                    'Cambiar igual la dirección web para que siga este nuevo nombre'
                                )}
                            />
                        </div>
                    </div>
                ) : null}

                {/* HOS-1787 leaf 5.6: business lines. The component renders nothing
                    for a vertical with a single catalog line (AC:5:9). */}
                {config.showsBusinessLines ? (
                    <div className={styles.full}>
                        <BusinessLinesField
                            locale={locale}
                            vertical={vertical}
                            type={data.listingType}
                            selected={data.businessLines}
                            onChange={(next) => {
                                onFieldChange('businessLines', next);
                            }}
                            errors={errors}
                            listingId={listingId}
                        />
                    </div>
                ) : null}

                {/* T-020: summary (min 10 / max 300), kit counter */}
                <div className={styles.full}>
                    <Field
                        locale={locale}
                        idParts={idOf('summary')}
                        label={t('listing.owner.editor.sections.summary', 'Resumen')}
                        error={errors.summary}
                    >
                        <Textarea
                            value={data.summary}
                            rows={3}
                            minLength={10}
                            limit={SUMMARY_MAX_LENGTH}
                            locale={locale}
                            onChange={(event) => {
                                onFieldChange('summary', event.target.value);
                            }}
                        />
                    </Field>
                </div>

                {/* HOS-166 judgment-day W2: description, owner-editable (D-1) */}
                <div className={styles.full}>
                    <Field
                        locale={locale}
                        idParts={idOf('description')}
                        label={t('listing.owner.editor.sections.description', 'Descripción')}
                        error={errors.description}
                    >
                        <Textarea
                            value={data.description}
                            rows={5}
                            onChange={(event) => {
                                onFieldChange('description', event.target.value);
                            }}
                        />
                    </Field>
                </div>

                {/* HOS-371: TipTap, persisted as Markdown (the stored shape is
                    unchanged). Deliberately NOT behind `PlanEntitlementGate`: that
                    gate reads the ACCOMMODATION entitlement set, so gating a
                    listing field on it would deny it to every listing owner.
                    HOS-829: no `placeholder`, the owner asked for the hint to go. */}
                <div className={styles.full}>
                    <Field
                        locale={locale}
                        id={RICH_DESCRIPTION_ID}
                        label={t(
                            'listing.owner.editor.sections.richDescription',
                            'Descripción ampliada'
                        )}
                    >
                        <RichTextEditor
                            id={RICH_DESCRIPTION_ID}
                            locale={locale}
                            value={data.richDescription}
                            ariaLabel={t(
                                'listing.owner.editor.sections.richDescription',
                                'Descripción ampliada'
                            )}
                            onChange={(value) => {
                                onFieldChange('richDescription', value);
                            }}
                        />
                    </Field>
                </div>
            </div>
        </Section>
    );
}
