/** Minimal event draft create step, validated against the HTTP contract. */
import { EventCategoryEnum, EventCreateHttpSchema } from '@repo/schemas';
import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import styles from '@/components/account/CreateStep.module.css';
import { CreateTextField } from '@/components/account/CreateTextField';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Select } from '@/components/account/ui/Select';
import { TextInput } from '@/components/account/ui/TextInput';
import { eventEditApi } from '@/lib/api/endpoints-protected';
import { useZodForm } from '@/lib/forms/use-zod-form';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { type EventOrganizerOption, EventOrganizerPicker } from './EventOrganizerPicker.client';

const EVENT_CREATE_FORM_SCHEMA = EventCreateHttpSchema.pick({
    name: true,
    description: true,
    category: true,
    startDate: true,
    endDate: true,
    organizerId: true
}).refine((data) => data.endDate >= data.startDate, {
    message: 'account.myContent.events.create.dateOrderError',
    path: ['endDate']
});

export type { EventOrganizerOption };
export interface EventCreateFormProps {
    readonly locale: SupportedLocale;
    readonly organizers: readonly EventOrganizerOption[];
    readonly organizersLoadFailed?: boolean;
}

export function EventCreateForm({
    locale,
    organizers,
    organizersLoadFailed = false
}: EventCreateFormProps): JSX.Element {
    const { t } = createTranslations(locale);
    const { fieldErrors, formError, validate, handleApiError, setFormError } = useZodForm({
        schema: EVENT_CREATE_FORM_SCHEMA,
        t
    });
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [organizerId, setOrganizerId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        formRef.current?.setAttribute('data-hydrated', 'true');
    }, []);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setFormError(null);
        const parsed = validate({
            name,
            description,
            category: category || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            organizerId: organizerId || undefined
        });
        if (!parsed.success) return;
        setIsSubmitting(true);
        const created = await eventEditApi.create({ data: parsed.data });
        if (created.ok) {
            window.location.href = buildUrl({
                locale,
                path: `mi-cuenta/eventos/${created.data.id as string}/editar`
            });
            return;
        }
        handleApiError(
            created.error,
            t(
                'account.myContent.events.create.error',
                'No pudimos crear el evento. Probá de nuevo.'
            )
        );
        setIsSubmitting(false);
    }

    return (
        <Section
            title={t('account.myContent.events.create.sectionTitle')}
            helpId="section:content.event-create"
        >
            <form
                ref={formRef}
                className={styles.fields}
                onSubmit={(event) => void handleSubmit(event)}
                noValidate
            >
                <CreateTextField
                    id="ec-name"
                    locale={locale}
                    label={t('account.myContent.events.create.field.name', 'Nombre')}
                    hint={t('account.myContent.events.create.hint.name')}
                    error={fieldErrors.name}
                    value={name}
                    onChange={setName}
                    min={5}
                    max={200}
                />
                <Field
                    id="ec-category"
                    locale={locale}
                    label={t('account.myContent.events.create.field.category', 'Categoría')}
                    hint={t('account.myContent.events.create.hint.category')}
                    error={fieldErrors.category}
                    required
                >
                    <Select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                    >
                        <option value="">
                            {t('account.myContent.events.create.placeholder.category')}
                        </option>
                        {Object.values(EventCategoryEnum).map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(`events.categories.${value.toLowerCase()}`)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <CreateTextField
                    id="ec-description"
                    locale={locale}
                    label={t('account.myContent.events.create.field.description', 'Descripción')}
                    hint={t('account.myContent.events.create.hint.description')}
                    error={fieldErrors.description}
                    value={description}
                    onChange={setDescription}
                    min={50}
                    max={2000}
                    rows={6}
                />
                <Field
                    id="ec-startDate"
                    locale={locale}
                    label={t('account.myContent.events.create.field.startDate', 'Comienza')}
                    hint={t('account.myContent.events.create.hint.startDate')}
                    error={fieldErrors.startDate}
                    required
                >
                    <TextInput
                        type="datetime-local"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                    />
                </Field>
                <Field
                    id="ec-endDate"
                    locale={locale}
                    label={t('account.myContent.events.create.field.endDate', 'Termina')}
                    hint={t('account.myContent.events.create.hint.endDate')}
                    error={fieldErrors.endDate}
                    required
                >
                    <TextInput
                        type="datetime-local"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                    />
                </Field>
                <EventOrganizerPicker
                    locale={locale}
                    initialOrganizers={organizers}
                    loadFailed={organizersLoadFailed}
                    value={organizerId}
                    onChange={setOrganizerId}
                    fieldErrorMessage={fieldErrors.organizerId}
                    t={t}
                />
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
                    data-testid="event-create-submit"
                >
                    {isSubmitting
                        ? t('account.myContent.events.create.submitting', 'Creando...')
                        : t('account.myContent.events.create.submit', 'Crear evento')}
                </Button>
            </form>
        </Section>
    );
}
