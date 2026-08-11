/**
 * @file EventOrganizerPicker.client.tsx
 * @description Organizer select + inline-create block for the event create form
 * (HOS-374 §5.2.2).
 *
 * Extracted from `EventCreateForm.client.tsx` so that file stays under the
 * repo's 500-line ceiling. The seam is deliberate rather than cosmetic: every
 * piece of state involved in CREATING an organizer lives here and nowhere else,
 * which is what structurally guarantees the property the form depends on — a
 * failed organizer creation cannot touch the event fields the editor already
 * typed. The parent owns only the selected `value`, because it needs it to
 * validate the event payload.
 *
 * ## Three catalog states, kept distinct
 *
 *  - **Loaded with items** — a `<select>` of existing organizers plus a link to
 *    switch into create mode.
 *  - **Load FAILED** (`loadFailed`) — an explicit error, AND the inline-create
 *    block. This deliberately diverges from `CommerceCreateForm`, which only
 *    shows an error: its `destinationId` is optional, so a dead catalog is
 *    survivable. `organizerId` is a hard-required UUID on
 *    `EventCreateHttpSchema`, so leaving the editor with an error and no path
 *    forward would make a transient GET failure a permanent block. Creating an
 *    organizer is an independent POST, unaffected by the failed GET.
 *  - **Genuinely empty** (fetch succeeded, zero rows) — a neutral notice plus
 *    the same inline-create block. Never collapsed into the failure branch: one
 *    means "retry might help", the other means "you are the first".
 *
 * ## Why creation is its own action, not part of the event submit
 *
 * Bundling them would mean that when the organizer half succeeds and the event
 * half then fails validation, a retry creates a SECOND duplicate organizer —
 * nothing dedupes them. Two distinct actions mean the organizer is created
 * exactly once, when the editor asks for it.
 *
 * `EventOrganizerCreateHttpSchema` requires only `name` (min 3, max 100), so
 * the inline form is a single field.
 */

import { EventOrganizerCreateHttpSchema } from '@repo/schemas';
import { type JSX, useState } from 'react';
import { eventOrganizerApi } from '@/lib/api/endpoints-protected';
import type { TranslationFn } from '@/lib/i18n';

/** Just `name` — the only field `EventOrganizerCreateHttpSchema` genuinely requires. */
const ORGANIZER_NAME_SCHEMA = EventOrganizerCreateHttpSchema.shape.name;

/** Minimal organizer shape needed to populate the select. */
export interface EventOrganizerOption {
    /** Organizer UUID, submitted as the event's `organizerId`. */
    readonly id: string;
    /** Display name. */
    readonly name: string;
}

/** Props for {@link EventOrganizerPicker}. */
export interface EventOrganizerPickerProps {
    /** Organizer catalog fetched SSR by the page. */
    readonly initialOrganizers: readonly EventOrganizerOption[];
    /**
     * `true` when the SSR catalog fetch FAILED, as opposed to succeeding with
     * zero rows. The two render differently on purpose (see the module doc).
     */
    readonly loadFailed: boolean;
    /** Currently selected organizer id, owned by the parent form. */
    readonly value: string;
    /** Called with the newly selected organizer id. */
    readonly onChange: (organizerId: string) => void;
    /** Validation message for the organizer field, owned by the parent form. */
    readonly fieldErrorMessage: string | undefined;
    /** id of the parent's `FieldError` element, for `aria-describedby`. */
    readonly fieldErrorElementId: string;
    /** Translator from the parent, so both share one `createTranslations` call. */
    readonly t: TranslationFn;
    /** CSS-module classes from the parent form, so the picker inherits its styling. */
    readonly styles: Readonly<Record<string, string>>;
}

/**
 * EventOrganizerPicker — organizer select with inline creation.
 *
 * @param props - See {@link EventOrganizerPickerProps}.
 */
export function EventOrganizerPicker({
    initialOrganizers,
    loadFailed,
    value,
    onChange,
    fieldErrorMessage,
    fieldErrorElementId,
    t,
    styles
}: EventOrganizerPickerProps): JSX.Element {
    const [organizers, setOrganizers] =
        useState<readonly EventOrganizerOption[]>(initialOrganizers);
    const [showCreate, setShowCreate] = useState(loadFailed || initialOrganizers.length === 0);
    const [newName, setNewName] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const hasOrganizers = organizers.length > 0;

    async function handleCreate(): Promise<void> {
        const parsedName = ORGANIZER_NAME_SCHEMA.safeParse(newName);
        if (!parsedName.success) {
            setCreateError(
                t(
                    'account.myContent.events.create.organizer.nameInvalid',
                    'El nombre debe tener entre 3 y 100 caracteres.'
                )
            );
            return;
        }

        setIsCreating(true);
        setCreateError(null);

        const created = await eventOrganizerApi.create({ data: { name: parsedName.data } });

        if (created.ok) {
            // TYPE-WORKAROUND: `eventOrganizerApi.create` returns the raw
            // `Record<string, unknown>` API payload — only `id`/`name` are read.
            const id = created.data.id as string;
            const createdName = (created.data.name as string | undefined) ?? parsedName.data;
            setOrganizers((prev) => [{ id, name: createdName }, ...prev]);
            onChange(id);
            setShowCreate(false);
            setNewName('');
            setIsCreating(false);
            return;
        }

        setCreateError(
            t(
                'account.myContent.events.create.organizer.error',
                'No pudimos crear el organizador. Probá de nuevo.'
            )
        );
        setIsCreating(false);
    }

    return (
        <>
            {loadFailed && (
                <p
                    className={styles.error}
                    role="alert"
                    data-testid="event-organizer-load-error"
                >
                    {t(
                        'account.myContent.events.create.organizer.loadError',
                        'No pudimos cargar el listado de organizadores. Recargá la página para reintentar, o creá uno nuevo abajo.'
                    )}
                </p>
            )}

            {!loadFailed && !hasOrganizers && (
                <p
                    className={styles.hint}
                    data-testid="event-organizer-empty-notice"
                >
                    {t(
                        'account.myContent.events.create.organizer.empty',
                        'Todavía no hay organizadores cargados. Creá el primero para poder publicar tu evento.'
                    )}
                </p>
            )}

            {!showCreate && hasOrganizers && (
                <>
                    <select
                        id="ec-organizerId"
                        className={styles.input}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        aria-invalid={fieldErrorMessage ? 'true' : 'false'}
                        aria-describedby={fieldErrorMessage ? fieldErrorElementId : undefined}
                        required
                    >
                        <option value="">—</option>
                        {organizers.map((organizer) => (
                            <option
                                key={organizer.id}
                                value={organizer.id}
                            >
                                {organizer.name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => setShowCreate(true)}
                        data-testid="event-organizer-create-toggle"
                    >
                        {t(
                            'account.myContent.events.create.organizer.createNew',
                            '+ Crear organizador nuevo'
                        )}
                    </button>
                </>
            )}

            {showCreate && (
                <div
                    className={styles.organizerCreateBlock}
                    data-testid="event-organizer-create-block"
                >
                    <input
                        id="ec-organizer-name"
                        type="text"
                        className={styles.input}
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        placeholder={t(
                            'account.myContent.events.create.organizer.namePlaceholder',
                            'Nombre del organizador'
                        )}
                    />
                    <div className={styles.organizerCreateActions}>
                        <button
                            type="button"
                            className={styles.organizerCreateSubmit}
                            disabled={isCreating}
                            onClick={() => void handleCreate()}
                            data-testid="event-organizer-create-submit"
                        >
                            {isCreating
                                ? t(
                                      'account.myContent.events.create.organizer.creating',
                                      'Creando...'
                                  )
                                : t(
                                      'account.myContent.events.create.organizer.submit',
                                      'Crear organizador'
                                  )}
                        </button>
                        {hasOrganizers && (
                            <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => {
                                    setShowCreate(false);
                                    setCreateError(null);
                                }}
                                data-testid="event-organizer-create-cancel"
                            >
                                {t('account.myContent.events.create.organizer.cancel', 'Cancelar')}
                            </button>
                        )}
                    </div>
                    {createError && (
                        <p
                            className={styles.error}
                            role="alert"
                            data-testid="event-organizer-create-error"
                        >
                            {createError}
                        </p>
                    )}
                </div>
            )}
        </>
    );
}
