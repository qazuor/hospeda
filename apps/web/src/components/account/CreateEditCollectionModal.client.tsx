/**
 * @file CreateEditCollectionModal.client.tsx
 * @description Create or edit a bookmark collection in the kit `Dialog`
 * (HOS-2480). Modes: CREATE (no `collection` prop) or EDIT (`collection`
 * provided). API: POST/PATCH through `useCollectionMutation`.
 *
 * In CREATE mode a `lockedReason` (from the collections gate, the same one
 * «Crear colección» and «Mover» read) shows as an Alert and blocks the submit:
 * the API's 403 stays the real enforcement.
 */

import { UserBookmarkCollectionCreateInputSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Dialog, Field, Textarea, TextInput } from '@/components/account/ui';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import styles from './CollectionForm.module.css';
import { CollectionColorPicker, CollectionIconPicker } from './CollectionPickers';
import { useCollectionMutation } from './useCollectionMutation';

/**
 * Client-validated form schema: the user-editable fields only. `userId` is
 * resolved server-side from the session, so it is never a form field.
 */
const CollectionFormSchema = UserBookmarkCollectionCreateInputSchema.omit({ userId: true });

/** Maximum characters for the collection name field. */
const NAME_MAX_LENGTH = 60;

/** Maximum characters for the collection description field. */
const DESCRIPTION_MAX_LENGTH = 300;

/** Form element id, so the footer submit button can live outside the form. */
const FORM_ID = 'collection-form';

/** The minimal shape of an existing collection passed in EDIT mode. */
export interface CollectionForEdit {
    readonly id: string;
    readonly name: string;
    readonly description?: string | null;
    readonly color?: string | null;
    readonly icon?: string | null;
}

/** Props of {@link CreateEditCollectionModal}. Fully controlled. */
export interface CreateEditCollectionModalProps {
    /** Whether the modal is open. */
    readonly isOpen: boolean;
    /** Called when the user asks to close (Escape, scrim, close button, Cancel). */
    readonly onClose: () => void;
    /** Called after a successful save with the created or updated collection. */
    readonly onSaved?: (collection: { id: string; name: string }) => void;
    /** Locale for i18n. */
    readonly locale: SupportedLocale;
    /** EDIT mode when given; CREATE mode otherwise. */
    readonly collection?: CollectionForEdit;
    /**
     * Why creating is locked (from the collections gate), or null when it is
     * not. Only read in CREATE mode.
     */
    readonly lockedReason?: string | null;
    /** HOS-2544: catalog names of the plans that carry collections (entitlement toast). */
    readonly gatePlanNames?: readonly string[];
}

/** Internal form state. */
interface ModalFormState {
    readonly name: string;
    readonly description: string;
    readonly color: string;
    readonly icon: string;
}

/** Initial form values for a collection (or an empty form). */
function formFor(collection?: CollectionForEdit): ModalFormState {
    return {
        name: collection?.name ?? '',
        description: collection?.description ?? '',
        color: collection?.color ?? '',
        icon: collection?.icon ?? ''
    };
}

/**
 * Modal for creating or editing a bookmark collection.
 *
 * @param props - See {@link CreateEditCollectionModalProps}.
 * @returns The kit Dialog with the collection form.
 */
export function CreateEditCollectionModal({
    isOpen,
    onClose,
    onSaved,
    locale,
    collection,
    lockedReason = null,
    gatePlanNames
}: CreateEditCollectionModalProps) {
    const t = createT(locale);
    const isEditMode = Boolean(collection);
    const createLocked = !isEditMode && lockedReason !== null;

    const [form, setForm] = useState<ModalFormState>(() => formFor(collection));
    // Server-side 409 NAME_TAKEN; client-side errors live in `fieldErrors`.
    const [nameError, setNameError] = useState<string | null>(null);

    const { fieldErrors, validate, clearError } = useZodForm({
        schema: CollectionFormSchema,
        t
    });

    const mutationCallbacks = useMemo(
        () => ({ onSaved, onClose, setNameError }),
        [onSaved, onClose]
    );

    const { isSubmitting, submit } = useCollectionMutation({
        collectionId: collection?.id,
        callbacks: mutationCallbacks,
        locale,
        gatePlanNames
    });

    useEffect(() => {
        if (isOpen) {
            setForm(formFor(collection));
            setNameError(null);
        }
    }, [isOpen, collection]);

    const handleClose = useCallback(() => {
        // Never close while a request is in flight.
        if (isSubmitting) return;
        setForm(formFor());
        setNameError(null);
        onClose();
    }, [onClose, isSubmitting]);

    function handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
        const name = event.target.value;
        setForm((prev) => ({ ...prev, name }));
        if (nameError) setNameError(null);
        clearError('name');
    }

    function handleDescriptionChange(event: ChangeEvent<HTMLTextAreaElement>): void {
        const description = event.target.value;
        setForm((prev) => ({ ...prev, description }));
        clearError('description');
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (createLocked) return;
        // Same schema the API validates create/update bodies with.
        const parsed = validate({
            name: form.name.trim(),
            description: form.description.trim() || null,
            color: form.color.trim() || null,
            icon: form.icon.trim() || null
        });
        if (!parsed.success) return;
        // The hook trims and null-converts itself; `parsed` is only the gate.
        void submit(form);
    }

    const nameFieldError = nameError ?? fieldErrors.name;
    const title = isEditMode
        ? t('account.favorites.collections.edit')
        : t('account.favorites.collections.create');

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(next) => {
                if (!next) handleClose();
            }}
            title={title}
            locale={locale}
            dismissible={!isSubmitting}
            footer={
                <>
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                    >
                        {t('common.form.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        form={FORM_ID}
                        loading={isSubmitting}
                        disabled={form.name.trim().length === 0 || createLocked}
                    >
                        {isEditMode ? t('common.form.save') : t('common.form.create')}
                    </Button>
                </>
            }
        >
            {createLocked ? (
                <Alert
                    tone="warning"
                    locale={locale}
                >
                    {lockedReason}
                </Alert>
            ) : null}
            <form
                id={FORM_ID}
                className={styles.form}
                onSubmit={handleSubmit}
                noValidate
            >
                <Field
                    id="collection-name"
                    label={t('account.favorites.collections.fields.name')}
                    locale={locale}
                    error={nameFieldError}
                    required
                >
                    <TextInput
                        type="text"
                        value={form.name}
                        onChange={handleNameChange}
                        maxLength={NAME_MAX_LENGTH}
                        autoComplete="off"
                    />
                </Field>
                <Field
                    id="collection-description"
                    label={t('account.favorites.collections.fields.description')}
                    locale={locale}
                    hint={t('account.favorites.collections.fields.descriptionHint')}
                    error={fieldErrors.description}
                    optional
                >
                    <Textarea
                        value={form.description}
                        onChange={handleDescriptionChange}
                        limit={DESCRIPTION_MAX_LENGTH}
                        locale={locale}
                        rows={3}
                    />
                </Field>
                <div>
                    <span
                        id="color-picker-label"
                        className={styles.pickerLabel}
                    >
                        {t('account.favorites.collections.fields.color')}
                    </span>
                    <CollectionColorPicker
                        value={form.color}
                        onChange={(color) => setForm((prev) => ({ ...prev, color }))}
                        locale={locale}
                        labelId="color-picker-label"
                    />
                </div>
                <div>
                    <span
                        id="icon-picker-label"
                        className={styles.pickerLabel}
                    >
                        {t('account.favorites.collections.fields.icon')}
                    </span>
                    <CollectionIconPicker
                        value={form.icon}
                        onChange={(icon) => setForm((prev) => ({ ...prev, icon }))}
                        locale={locale}
                        labelId="icon-picker-label"
                    />
                </div>
            </form>
        </Dialog>
    );
}
