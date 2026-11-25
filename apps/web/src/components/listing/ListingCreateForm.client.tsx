/** Minimal owner create step: create a draft, then open its full editor. */
import { ExperiencePriceUnitEnum } from '@repo/schemas';
import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import styles from '@/components/account/CreateStep.module.css';
import { CreateTextField } from '@/components/account/CreateTextField';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Checkbox } from '@/components/account/ui/Checkbox';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Select } from '@/components/account/ui/Select';
import { TextInput } from '@/components/account/ui/TextInput';
import type { DestinationOption } from '@/components/listing/destination-option';
import { useZodForm } from '@/lib/forms/use-zod-form';
import { sectionHelpId } from '@/lib/help/section-help-id';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { LISTING_VERTICAL_FORM_CONFIG } from '@/lib/listing/listing-vertical-form-config';
import { createOwnerListing, type VenueOrExperience } from '@/lib/listing/owner-listings';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/listing/price-units';
import { buildUrl } from '@/lib/urls';

export interface ListingCreateFormProps {
    readonly vertical: VenueOrExperience;
    readonly locale: SupportedLocale;
    readonly destinations: readonly DestinationOption[];
    readonly destinationsLoadFailed?: boolean;
}

export function ListingCreateForm({
    vertical,
    locale,
    destinations,
    destinationsLoadFailed = false
}: ListingCreateFormProps): JSX.Element {
    const { t } = createTranslations(locale);
    const config = LISTING_VERTICAL_FORM_CONFIG[vertical];
    const { fieldErrors, formError, validate, handleApiError, setFormError } = useZodForm({
        schema: config.formSchema,
        t
    });
    const [name, setName] = useState('');
    const [listingType, setListingType] = useState('');
    const [summary, setSummary] = useState('');
    const [description, setDescription] = useState('');
    const [destinationId, setDestinationId] = useState('');
    const [priceFromCents, setPriceFromCents] = useState<number | null>(null);
    const [priceUnit, setPriceUnit] = useState('');
    const [isPriceOnRequest, setIsPriceOnRequest] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        formRef.current?.setAttribute('data-hydrated', 'true');
    }, []);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setFormError(null);
        const payload: Record<string, unknown> = {
            name,
            type: listingType || undefined,
            summary,
            description,
            destinationId: destinationId || undefined
        };
        if (config.showsPriceFields) {
            payload.priceFrom = isPriceOnRequest ? null : (priceFromCents ?? undefined);
            payload.priceUnit = isPriceOnRequest ? null : priceUnit || undefined;
            payload.isPriceOnRequest = isPriceOnRequest;
        }
        // Business lines and policies are optional at create and belong to the editor.
        // The venue endpoint derives business lines from the selected type.
        const parsed = validate(payload);
        if (!parsed.success) return;
        setIsSubmitting(true);
        const created = await createOwnerListing(config.buildCreatePayload(parsed.data));
        if (created.ok) {
            window.location.href = buildUrl({
                locale,
                path: `mi-cuenta/comercio/${vertical}/${created.data.id}/editar`
            });
            return;
        }
        handleApiError(
            created.error,
            t(config.labels.createErrorKey, config.labels.createErrorFallback)
        );
        setIsSubmitting(false);
    }

    return (
        <Section
            title={t('listing.owner.create.sectionTitle')}
            description={t('listing.owner.create.sectionHint')}
            helpId={sectionHelpId({ vertical, slug: 'datos' })}
        >
            <form
                ref={formRef}
                className={styles.fields}
                onSubmit={(event) => void handleSubmit(event)}
                noValidate
            >
                <CreateTextField
                    id="cc-name"
                    locale={locale}
                    label={t(config.labels.nameKey, config.labels.nameFallback)}
                    hint={t('listing.owner.create.hint.name')}
                    error={fieldErrors.name}
                    value={name}
                    onChange={setName}
                    min={2}
                    max={100}
                />
                <Field
                    id="cc-type"
                    locale={locale}
                    label={t('listing.owner.create.fields.type', 'Categoría')}
                    hint={
                        config.showsTypeDescription && listingType
                            ? t(`venue.typeDescriptions.${listingType}`, '')
                            : t('listing.owner.create.hint.type')
                    }
                    error={fieldErrors.type}
                    required
                >
                    <Select
                        value={listingType}
                        onChange={(event) => setListingType(event.target.value)}
                    >
                        <option value="">{t('listing.owner.create.placeholder.type')}</option>
                        {config.typeOptions.map((type) => (
                            <option
                                key={type}
                                value={type}
                            >
                                {config.resolveTypeLabel({ t, type })}
                            </option>
                        ))}
                    </Select>
                </Field>
                <CreateTextField
                    id="cc-summary"
                    locale={locale}
                    label={t('listing.owner.create.fields.summary', 'Resumen')}
                    hint={t('listing.owner.create.hint.summary')}
                    error={fieldErrors.summary}
                    value={summary}
                    onChange={setSummary}
                    min={10}
                    max={300}
                    rows={2}
                />
                <CreateTextField
                    id="cc-description"
                    locale={locale}
                    label={t('listing.owner.create.fields.description', 'Descripción')}
                    hint={t('listing.owner.create.hint.description')}
                    error={fieldErrors.description}
                    value={description}
                    onChange={setDescription}
                    min={20}
                    max={2000}
                    rows={5}
                />
                {destinationsLoadFailed || destinations.length === 0 ? (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {destinationsLoadFailed
                            ? t(
                                  'listing.owner.create.fields.destinationLoadError',
                                  'No pudimos cargar el listado de ciudades / destinos. Recargá la página para reintentar.'
                              )
                            : t(
                                  'listing.owner.create.fields.destinationEmpty',
                                  'Todavía no hay ciudades / destinos cargados. Contactanos para poder completar este campo.'
                              )}
                    </Alert>
                ) : (
                    <Field
                        id="cc-destinationId"
                        locale={locale}
                        label={t('listing.owner.create.fields.destination', 'Ciudad / Destino')}
                        hint={t('listing.owner.create.hint.destination')}
                        error={fieldErrors.destinationId}
                        optional
                    >
                        <Select
                            value={destinationId}
                            onChange={(event) => setDestinationId(event.target.value)}
                        >
                            <option value="">
                                {t('listing.owner.create.placeholder.destination')}
                            </option>
                            {destinations.map((destination) => (
                                <option
                                    key={destination.id}
                                    value={destination.id}
                                >
                                    {destination.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                )}
                {config.showsPriceFields && (
                    <>
                        <Checkbox
                            label={t(
                                'listing.owner.editor.sections.isPriceOnRequest',
                                'Precio a consultar'
                            )}
                            checked={isPriceOnRequest}
                            onChange={(event) => setIsPriceOnRequest(event.target.checked)}
                        />
                        <Field
                            id="cc-priceFrom"
                            locale={locale}
                            label={t('listing.owner.editor.sections.priceFrom', 'Precio desde')}
                            hint={t('listing.owner.create.hint.price')}
                            error={fieldErrors.priceFrom}
                            required={!isPriceOnRequest}
                        >
                            <TextInput
                                type="number"
                                min={0}
                                step={1}
                                disabled={isPriceOnRequest}
                                value={centsToPesosInputValue({ cents: priceFromCents })}
                                onChange={(event) =>
                                    setPriceFromCents(
                                        parsePesosInputToCents({ raw: event.target.value })
                                    )
                                }
                            />
                        </Field>
                        <Field
                            id="cc-priceUnit"
                            locale={locale}
                            label={t('listing.owner.editor.sections.priceUnit', 'Unidad de precio')}
                            error={fieldErrors.priceUnit}
                            required={!isPriceOnRequest}
                        >
                            <Select
                                value={priceUnit}
                                disabled={isPriceOnRequest}
                                onChange={(event) => setPriceUnit(event.target.value)}
                            >
                                <option value="">
                                    {t('listing.owner.create.placeholder.priceUnit')}
                                </option>
                                {Object.values(ExperiencePriceUnitEnum).map((unit) => (
                                    <option
                                        key={unit}
                                        value={unit}
                                    >
                                        {t(`listing.owner.editor.priceUnitOption.${unit}`, unit)}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </>
                )}
                {formError && (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {formError}
                    </Alert>
                )}
                <Button
                    type="submit"
                    loading={isSubmitting}
                    data-testid="listing-create-submit"
                >
                    {isSubmitting
                        ? t('listing.owner.create.submitting', 'Creando...')
                        : t(config.labels.submitKey, config.labels.submitFallback)}
                </Button>
            </form>
        </Section>
    );
}
