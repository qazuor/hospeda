/**
 * @file EventCreateForm.client.tsx
 * @description Editor self-service event create form island (HOS-374 §5.2.2).
 *
 * Collects ONLY the minimum fields `EventCreateHttpSchema` genuinely requires
 * at create time — `name`, `description`, `category`, `startDate`, `endDate`,
 * `organizerId` — then redirects to the real editor
 * (`EventEditor.client.tsx`) where the author fills in everything else.
 * Mirrors `PostCreateForm.client.tsx`'s "collect the minimum, redirect to the
 * editor" shape, which itself mirrors `CommerceCreateForm.client.tsx` (HOS-374
 * §5.2.1/§5.2.2 — that form is the explicit mold for both).
 *
 * Deliberately excluded from this form:
 *  - `slug` — server-derived from `name` when absent.
 *  - `isFeatured` / `isVirtual` / `isPrivate` / `requiresRegistration` — all
 *    default to `false` server-side; none of them is an authoring decision at
 *    create time.
 *  - `capacity` / `price` / `currency` / `registrationUrl` — optional,
 *    editable afterward in the real editor.
 *  - `locationId` — optional per the schema, same reasoning `PostCreateForm`
 *    used for `destinationId`: it is a real field with no picker here, left
 *    for the editor to fill in later rather than duplicating an SSR catalog
 *    fetch this minimal form does not need.
 *  - `authorId` — injected server-side from the actor (HOS-374 D-2); the
 *    protected HTTP schema does not even accept it.
 *
 * ## The `organizerId` problem (the reason this form is not a smaller copy of
 * `PostCreateForm`)
 *
 * Unlike `locationId`, `organizerId` is a REQUIRED UUID on
 * `EventCreateHttpSchema` — there is no way to submit an event without one.
 * An editor whose organizer is not yet in the catalog would be stuck with no
 * path forward, so this form lets them create one inline
 * (`eventOrganizerApi.create`, gated server-side on `EVENT_ORGANIZER_CREATE`,
 * which EDITOR holds — see `packages/seed/src/required/rolePermissions.seed.ts`).
 *
 * All of that — the select, the three catalog states, and the inline create —
 * lives in `EventOrganizerPicker.client.tsx`, not here. See its module doc for
 * why the load-failed branch diverges from `CommerceCreateForm` and why
 * creation is a separate call rather than part of this form's submit.
 *
 * This form keeps ONLY the selected `organizerId`, because it needs it to
 * validate the event payload. Every piece of state involved in creating an
 * organizer lives inside the picker, which is what makes "a failed organizer
 * creation cannot wipe the event fields the editor already typed" a structural
 * property rather than something this component has to remember not to break.
 *
 * Native HTML form + `useZodForm` (no TanStack Form, per web conventions).
 * Validates against a `.pick()` SUBSET of the REAL `EventCreateHttpSchema`
 * (imported from `@repo/schemas`, never hand-rolled) — the exact schema the
 * create endpoint itself validates against, scoped to the fields this form
 * collects, plus one client-only `.refine()`: `EventCreateHttpSchema` has no
 * check that `endDate` is not before `startDate`, so an event ending before
 * it starts would otherwise submit successfully. That check is added here.
 *
 * Hydration: caller MUST use `client:load` (the primary interactive surface
 * of the create page).
 */

import { EventCategoryEnum, EventCreateHttpSchema } from '@repo/schemas';
import { type FormEvent, type JSX, useState } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import { eventEditApi } from '@/lib/api/endpoints-protected';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './EventCreateForm.module.css';
import { type EventOrganizerOption, EventOrganizerPicker } from './EventOrganizerPicker.client';

/** Fields this form collects — a subset of the real create schema, plus a client-only date-order check. */
const EVENT_CREATE_FORM_SCHEMA = EventCreateHttpSchema.pick({
    name: true,
    description: true,
    category: true,
    startDate: true,
    endDate: true,
    organizerId: true
}).refine((data) => data.endDate >= data.startDate, {
    // A real i18n key, not free text: `resolveValidationMessage` looks it up
    // via `t()` and falls back to this key itself only if the translation is
    // missing (see `zodIssuesToFieldErrors` / `resolveValidationMessage`). Kept
    // as a sibling of `.error` (not nested under it) — `.error` is also used
    // as a plain string for the general submit-failure banner, and a JSON key
    // cannot be both a string and an object at once.
    message: 'account.myContent.events.create.dateOrderError',
    path: ['endDate']
});

/**
 * The nine `EventCategoryEnum` values with their labels, written out key by
 * key (not interpolated) so a missing translation is visible to a static
 * scan of the locale files. Mirrors `BasicInfoSection.client.tsx`'s
 * `CATEGORY_OPTIONS` exactly (same i18n keys, `events.categories.*`) so the
 * create form and the real editor's category picker never drift apart.
 */
const CATEGORY_OPTIONS = (
    t: (key: string, fallback?: string) => string
): ReadonlyArray<{ value: string; label: string }> => [
    { value: EventCategoryEnum.MUSIC, label: t('events.categories.music', 'Música') },
    { value: EventCategoryEnum.CULTURE, label: t('events.categories.culture', 'Cultura') },
    { value: EventCategoryEnum.SPORTS, label: t('events.categories.sports', 'Deportes') },
    {
        value: EventCategoryEnum.GASTRONOMY,
        label: t('events.categories.gastronomy', 'Gastronomía')
    },
    { value: EventCategoryEnum.FESTIVAL, label: t('events.categories.festival', 'Festival') },
    { value: EventCategoryEnum.NATURE, label: t('events.categories.nature', 'Naturaleza') },
    { value: EventCategoryEnum.THEATER, label: t('events.categories.theater', 'Teatro') },
    { value: EventCategoryEnum.WORKSHOP, label: t('events.categories.workshop', 'Taller') },
    { value: EventCategoryEnum.OTHER, label: t('events.categories.other', 'Otro') }
];

// Re-exported so the page and tests keep importing the option type from the
// form they mount, rather than from an implementation detail of its organizer
// block.
export type { EventOrganizerOption };

/** Props for {@link EventCreateForm}. */
export interface EventCreateFormProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Organizer catalog options for the select (see the module doc). */
    readonly organizers: readonly EventOrganizerOption[];
    /**
     * `true` when the SSR organizer catalog fetch failed (as opposed to
     * succeeding with a genuinely empty catalog). Defaults to `false` so
     * existing callers/tests that omit it keep the base behaviour — see the
     * module doc for why this branch differs from `CommerceCreateForm`'s.
     */
    readonly organizersLoadFailed?: boolean;
}

/**
 * EventCreateForm — editor self-service event create island.
 * Submits a minimal, unmoderated event and redirects to its operational editor.
 *
 * @param props - See {@link EventCreateFormProps}.
 */
export function EventCreateForm({
    locale,
    organizers: initialOrganizers,
    organizersLoadFailed = false
}: EventCreateFormProps): JSX.Element {
    const { t } = createTranslations(locale);

    const { fieldErrors, formError, validate, handleApiError } = useZodForm({
        schema: EVENT_CREATE_FORM_SCHEMA,
        t
    });

    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Only the SELECTED organizer lives here — every piece of state involved in
    // creating one lives inside EventOrganizerPicker. That is what makes "a
    // failed organizer creation cannot wipe the typed event fields" structural
    // rather than a thing this component has to remember not to break.
    const [organizerId, setOrganizerId] = useState('');

    const categoryOptions = CATEGORY_OPTIONS(t);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const parsed = validate({
            name,
            description,
            category: category || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            organizerId: organizerId || undefined
        });
        if (!parsed.success) {
            return;
        }

        setIsSubmitting(true);

        const created = await eventEditApi.create({ data: parsed.data });

        if (created.ok) {
            // TYPE-WORKAROUND: `eventEditApi.create` returns the raw
            // `Record<string, unknown>` API payload — only `id` is read here,
            // to build the editor redirect.
            const id = created.data.id as string;
            window.location.href = buildUrl({
                locale,
                path: `mi-cuenta/eventos/${id}/editar`
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
        <form
            className={styles.form}
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
        >
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="ec-name"
                >
                    {t('account.myContent.events.create.field.name', 'Nombre')}
                </label>
                <input
                    id="ec-name"
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={fieldErrors.name ? 'true' : 'false'}
                    aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
                    required
                />
                <FieldError
                    id={fieldErrorId('name')}
                    message={fieldErrors.name}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="ec-category"
                >
                    {t('account.myContent.events.create.field.category', 'Categoría')}
                </label>
                <select
                    id="ec-category"
                    className={styles.input}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    aria-invalid={fieldErrors.category ? 'true' : 'false'}
                    aria-describedby={fieldErrors.category ? fieldErrorId('category') : undefined}
                    required
                >
                    <option value="">—</option>
                    {categoryOptions.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                        >
                            {opt.label}
                        </option>
                    ))}
                </select>
                <FieldError
                    id={fieldErrorId('category')}
                    message={fieldErrors.category}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="ec-description"
                >
                    {t('account.myContent.events.create.field.description', 'Descripción')}
                </label>
                <textarea
                    id="ec-description"
                    className={styles.textarea}
                    rows={6}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    aria-invalid={fieldErrors.description ? 'true' : 'false'}
                    aria-describedby={
                        fieldErrors.description ? fieldErrorId('description') : undefined
                    }
                    required
                />
                <span className={styles.hint}>
                    {t(
                        'account.myContent.events.create.hint.description',
                        'Entre 50 y 2000 caracteres. El resumen del listado sale de acá.'
                    )}
                </span>
                <FieldError
                    id={fieldErrorId('description')}
                    message={fieldErrors.description}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="ec-startDate"
                >
                    {t('account.myContent.events.create.field.startDate', 'Comienza')}
                </label>
                <input
                    id="ec-startDate"
                    type="datetime-local"
                    className={styles.input}
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    aria-invalid={fieldErrors.startDate ? 'true' : 'false'}
                    aria-describedby={fieldErrors.startDate ? fieldErrorId('startDate') : undefined}
                    required
                />
                <FieldError
                    id={fieldErrorId('startDate')}
                    message={fieldErrors.startDate}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="ec-endDate"
                >
                    {t('account.myContent.events.create.field.endDate', 'Termina')}
                </label>
                <input
                    id="ec-endDate"
                    type="datetime-local"
                    className={styles.input}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    aria-invalid={fieldErrors.endDate ? 'true' : 'false'}
                    aria-describedby={fieldErrors.endDate ? fieldErrorId('endDate') : undefined}
                    required
                />
                <FieldError
                    id={fieldErrorId('endDate')}
                    message={fieldErrors.endDate}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="ec-organizerId"
                >
                    {t('account.myContent.events.create.field.organizerId', 'Organiza')}
                </label>

                <EventOrganizerPicker
                    initialOrganizers={initialOrganizers}
                    loadFailed={organizersLoadFailed}
                    value={organizerId}
                    onChange={setOrganizerId}
                    fieldErrorMessage={fieldErrors.organizerId}
                    fieldErrorElementId={fieldErrorId('organizerId')}
                    t={t}
                    styles={styles}
                />

                <FieldError
                    id={fieldErrorId('organizerId')}
                    message={fieldErrors.organizerId}
                />
            </div>

            {formError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            <button
                type="submit"
                className={styles.submit}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                data-testid="event-create-submit"
            >
                {isSubmitting
                    ? t('account.myContent.events.create.submitting', 'Creando...')
                    : t('account.myContent.events.create.submit', 'Crear evento')}
            </button>
        </form>
    );
}
