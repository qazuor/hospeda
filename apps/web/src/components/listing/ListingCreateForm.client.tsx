/** Minimal owner create step: create a draft, then open its full editor. */
import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import styles from '@/components/account/CreateStep.module.css';
import { CreateTextField } from '@/components/account/CreateTextField';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Select } from '@/components/account/ui/Select';
import type { DestinationOption } from '@/components/listing/destination-option';
import { useZodForm } from '@/lib/forms/use-zod-form';
import { sectionHelpId } from '@/lib/help/section-help-id';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { LISTING_VERTICAL_FORM_CONFIG } from '@/lib/listing/listing-vertical-form-config';
import { createOwnerListing, type VenueOrExperience } from '@/lib/listing/owner-listings';
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
    const [destinationId, setDestinationId] = useState('');
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
            destinationId: destinationId || undefined
        };
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
                        required
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
                    variant="accent"
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
