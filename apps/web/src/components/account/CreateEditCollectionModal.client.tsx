/**
 * @file CreateEditCollectionModal.client.tsx
 * @description React island modal for creating or editing a user bookmark collection.
 *
 * Modes: CREATE (no `collection` prop) or EDIT (`collection` provided).
 * API: POST/PATCH /api/v1/protected/user-bookmark-collections via useCollectionMutation.
 * T-047c will implement the color and icon picker UIs.
 *
 * Hydration: caller must use `client:load`.
 */

import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CollectionColorPicker, CollectionIconPicker } from './CollectionPickers';
import styles from './CreateEditCollectionModal.module.css';
import { useCollectionMutation } from './useCollectionMutation';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters for the collection name field */
const NAME_MAX_LENGTH = 60;

/** Maximum characters for the collection description field */
const DESCRIPTION_MAX_LENGTH = 300;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The minimal shape of an existing collection passed in EDIT mode.
 * All fields are readonly; optional fields may be null (as returned by the API).
 */
export interface CollectionForEdit {
    readonly id: string;
    readonly name: string;
    readonly description?: string | null;
    readonly color?: string | null;
    readonly icon?: string | null;
}

/**
 * Props for the CreateEditCollectionModal component.
 *
 * The modal is fully controlled: the parent manages `isOpen` and calls `onClose`
 * to close it. Pass a `collection` to enter EDIT mode; omit it for CREATE mode.
 */
export interface CreateEditCollectionModalProps {
    /** Whether the modal is open. Controlled. */
    readonly isOpen: boolean;
    /** Called when the user requests to close (Escape, click outside, X button). */
    readonly onClose: () => void;
    /**
     * Called after a successful save. Receives the created or updated collection.
     * T-047b will wire this; the skeleton leaves it unused.
     */
    readonly onSaved?: (collection: { id: string; name: string }) => void;
    /** Locale for i18n. */
    readonly locale: SupportedLocale;
    /**
     * When provided, the modal is in EDIT mode and pre-fills the form fields.
     * When undefined, the modal is in CREATE mode.
     */
    readonly collection?: CollectionForEdit;
    /**
     * When true and the modal is in CREATE mode, a warning banner is shown
     * inside the modal and the submit button is disabled.
     * This provides better UX when the user hits the limit while the modal
     * is open (race condition guard — the 403 API fallback handles the actual
     * enforcement).
     */
    readonly isAtLimit?: boolean;
    /**
     * The plan-level maximum number of collections allowed.
     * Used to render the limit-reached banner with the actual cap number.
     * Only meaningful when `isAtLimit` is true.
     */
    readonly collectionMax?: number;
}

/** Internal form state for the modal */
interface ModalFormState {
    name: string;
    description: string;
    color: string;
    icon: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal for creating or editing a bookmark collection.
 * CREATE mode: no `collection` prop. EDIT mode: pass an existing collection.
 */
export function CreateEditCollectionModal({
    isOpen,
    onClose,
    onSaved,
    locale,
    collection,
    isAtLimit = false,
    collectionMax
}: CreateEditCollectionModalProps) {
    const t = createT(locale);
    const isEditMode = Boolean(collection);

    /**
     * In CREATE mode, if the user is at the plan limit, we show a banner and
     * block submission. In EDIT mode the limit is irrelevant (editing an
     * existing collection never creates a new one).
     */
    const showLimitBanner = !isEditMode && isAtLimit;

    // ── Form state ────────────────────────────────────────────────────────

    const [form, setForm] = useState<ModalFormState>(() => ({
        name: collection?.name ?? '',
        description: collection?.description ?? '',
        color: collection?.color ?? '',
        icon: collection?.icon ?? ''
    }));

    /** Inline validation error for the name field */
    const [nameError, setNameError] = useState<string | null>(null);

    // ── Mutation callbacks (stable reference via useMemo) ─────────────────

    const mutationCallbacks = useMemo(
        () => ({ onSaved, onClose, setNameError }),
        [onSaved, onClose]
    );

    const { isSubmitting, submit } = useCollectionMutation({
        collectionId: collection?.id,
        callbacks: mutationCallbacks,
        locale
    });

    // ── Sync with collection prop in EDIT mode ────────────────────────────

    useEffect(() => {
        if (isOpen) {
            setForm({
                name: collection?.name ?? '',
                description: collection?.description ?? '',
                color: collection?.color ?? '',
                icon: collection?.icon ?? ''
            });
            setNameError(null);
        }
    }, [isOpen, collection]);

    // ── Reset form on close ───────────────────────────────────────────────

    const handleClose = useCallback(() => {
        // Prevent accidental close while a request is in flight
        if (isSubmitting) return;
        setForm({ name: '', description: '', color: '', icon: '' });
        setNameError(null);
        onClose();
    }, [onClose, isSubmitting]);

    // ESC, focus trap, scroll lock, focus management, click outside — all
    // owned by the shared <Dialog> wrapper.

    // ── Field change handlers ─────────────────────────────────────────────

    function handleNameChange(event: React.ChangeEvent<HTMLInputElement>): void {
        setForm((prev) => ({ ...prev, name: event.target.value }));
        if (nameError) setNameError(null);
    }

    function handleDescriptionChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
        setForm((prev) => ({ ...prev, description: event.target.value }));
    }

    // ── Submit ────────────────────────────────────────────────────────────

    function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        // Local validation: name is required
        const trimmedName = form.name.trim();
        if (trimmedName.length === 0) {
            setNameError('El nombre es requerido');
            return;
        }

        // Delegate to mutation hook (async, non-blocking for the handler)
        void submit(form);
    }

    // ── Computed values ───────────────────────────────────────────────────

    const modalTitle = isEditMode
        ? t('account.favorites.collections.edit', 'Editar colección')
        : t('account.favorites.collections.create', 'Crear colección');

    const submitLabel = isEditMode
        ? t('common.form.save', 'Guardar')
        : t('common.form.create', 'Crear');

    const cancelLabel = t('common.form.cancel', 'Cancelar');

    const MODAL_TITLE_ID = 'create-edit-collection-modal-title';

    // ── JSX ───────────────────────────────────────────────────────────────

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            size="md"
            ariaLabelledBy={MODAL_TITLE_ID}
            closeOnEscape={!isSubmitting}
            closeOnOverlayClick={!isSubmitting}
        >
            <DialogHeader
                titleId={MODAL_TITLE_ID}
                onClose={handleClose}
                closeLabel={t('common.modal.close', 'Cerrar')}
            >
                {modalTitle}
            </DialogHeader>

            <DialogBody>
                {/* ── Limit banner (CREATE mode only, when plan cap reached) ── */}
                {showLimitBanner && (
                    <div
                        className={styles.limitBanner}
                        role="alert"
                        aria-live="assertive"
                    >
                        {t(
                            'account.favorites.collections.limit_reached',
                            'Ya alcanzaste el máximo de {{max}} colecciones',
                            { max: collectionMax ?? 0 }
                        )}
                    </div>
                )}

                {/* ── Form ────────────────────────────────────────────── */}
                <form
                    className={styles.form}
                    onSubmit={handleSubmit}
                    noValidate
                >
                    {/* Name field (required) */}
                    <div className={styles.field}>
                        <div className={styles.labelRow}>
                            <label
                                className={styles.label}
                                htmlFor="collection-name"
                            >
                                {t('account.favorites.collections.fields.name', 'Nombre')}
                                <span
                                    className={styles.required}
                                    aria-hidden="true"
                                >
                                    {' '}
                                    *
                                </span>
                            </label>
                            <span
                                className={styles.counter}
                                aria-live="polite"
                                aria-label={t(
                                    'common.form.charCounter',
                                    '{{current}} de {{max}} caracteres',
                                    {
                                        current: form.name.length,
                                        max: NAME_MAX_LENGTH
                                    }
                                )}
                            >
                                {form.name.length}/{NAME_MAX_LENGTH}
                            </span>
                        </div>
                        <input
                            id="collection-name"
                            type="text"
                            className={`${styles.input}${nameError ? ` ${styles.inputError}` : ''}`}
                            value={form.name}
                            onChange={handleNameChange}
                            maxLength={NAME_MAX_LENGTH}
                            aria-required="true"
                            aria-describedby={nameError ? 'collection-name-error' : undefined}
                            autoComplete="off"
                        />
                        {nameError && (
                            <p
                                id="collection-name-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {nameError}
                            </p>
                        )}
                    </div>

                    {/* Description field (optional) */}
                    <div className={styles.field}>
                        <div className={styles.labelRow}>
                            <label
                                className={styles.label}
                                htmlFor="collection-description"
                            >
                                {t(
                                    'account.favorites.collections.fields.description',
                                    'Descripción'
                                )}
                            </label>
                            <span
                                className={styles.counter}
                                aria-live="polite"
                                aria-label={t(
                                    'common.form.charCounter',
                                    '{{current}} de {{max}} caracteres',
                                    {
                                        current: form.description.length,
                                        max: DESCRIPTION_MAX_LENGTH
                                    }
                                )}
                            >
                                {form.description.length}/{DESCRIPTION_MAX_LENGTH}
                            </span>
                        </div>
                        <textarea
                            id="collection-description"
                            className={styles.textarea}
                            value={form.description}
                            onChange={handleDescriptionChange}
                            maxLength={DESCRIPTION_MAX_LENGTH}
                            rows={3}
                            aria-describedby="collection-description-hint"
                        />
                        <p
                            id="collection-description-hint"
                            className={styles.hint}
                        >
                            {t(
                                'account.favorites.collections.fields.descriptionHint',
                                'Opcional. Describe para qué usarás esta colección.'
                            )}
                        </p>
                    </div>

                    {/* Color picker */}
                    <div className={styles.field}>
                        <span
                            id="color-picker-label"
                            className={styles.label}
                        >
                            {t('account.favorites.collections.fields.color', 'Color')}
                        </span>
                        <CollectionColorPicker
                            value={form.color}
                            onChange={(color) => setForm((prev) => ({ ...prev, color }))}
                            locale={locale}
                            labelId="color-picker-label"
                        />
                    </div>

                    {/* Icon picker */}
                    <div className={styles.field}>
                        <span
                            id="icon-picker-label"
                            className={styles.label}
                        >
                            {t('account.favorites.collections.fields.icon', 'Ícono')}
                        </span>
                        <CollectionIconPicker
                            value={form.icon}
                            onChange={(icon) => setForm((prev) => ({ ...prev, icon }))}
                            locale={locale}
                            labelId="icon-picker-label"
                        />
                    </div>

                    {/* ── Action buttons ───────────────────────────────── */}
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={handleClose}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={
                                form.name.trim().length === 0 || isSubmitting || showLimitBanner
                            }
                            aria-busy={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span
                                        className={styles.spinner}
                                        aria-hidden="true"
                                    />
                                    {submitLabel}
                                </>
                            ) : (
                                submitLabel
                            )}
                        </button>
                    </div>
                </form>
            </DialogBody>
        </Dialog>
    );
}
