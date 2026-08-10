/**
 * @file use-accommodation-section-form.ts
 * @description Shared form engine for the editor's five form pages (HOS-318 T-019).
 *
 * Splitting the monolithic editor turned one form into five. Copying the submit
 * logic five times would have created five places for a dirty-tracking bug to
 * live (spec risk R-5), so it is written once here.
 *
 * Two behaviours from the pre-split editor are load-bearing and preserved
 * exactly:
 *
 * 1. **The baseline resyncs after a successful save** (HOS-190 F6). Diffing
 *    against the load-time props instead meant that reverting a just-saved field
 *    produced an empty diff ("no changes") while the DB still held the new
 *    value — the change could not be undone without a full page reload.
 * 2. **Latitude and longitude always travel together.**
 *    `httpToDomainAccommodationUpdate` only emits `location.coordinates` when
 *    BOTH are present in the body, so a payload carrying one silently drops the
 *    coordinate update with no error surfaced anywhere.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ZodTypeAny } from 'zod';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { ACCOMMODATION_FIELD_ID_SUFFIXES, ACCOMMODATION_FIELD_PREFIX } from './field-ids';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Maps a form-local field name to the HTTP key the API expects, when they differ. */
export type FieldKeyMap = Readonly<Record<string, string>>;

/** What the hook hands back to a section page. */
export interface AccommodationSectionForm<TValues> {
    readonly values: TValues;
    readonly setValue: <K extends keyof TValues>(field: K, value: TValues[K]) => void;
    readonly fieldErrors: Readonly<Record<string, string>>;
    readonly formError: string | null;
    readonly isSaving: boolean;
    readonly isDirty: boolean;
    readonly handleSubmit: (event: React.FormEvent) => Promise<void>;
    readonly handleCancel: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Drives one section's form: state, partial diff, validation, save, guard.
 *
 * @param params - Locale, accommodation id, the section's initial values, its
 * schema slice, and an optional form-field → HTTP-key map.
 * @returns The form handle for the page to render.
 */
export function useAccommodationSectionForm<TValues extends object>({
    locale,
    accommodationId,
    initialValues,
    ownFields,
    schema,
    fieldKeyMap = {}
}: {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    /**
     * The whole `AccommodationEditData`. The existing section components take
     * the complete object, so the page holds all of it — but only `ownFields`
     * is ever diffed or sent.
     */
    readonly initialValues: TValues;
    /**
     * The fields this page owns. Everything else is carried for rendering only
     * and can never reach the PATCH body — that is what stops one section's save
     * from clobbering another's data.
     */
    readonly ownFields: readonly string[];
    readonly schema: ZodTypeAny;
    readonly fieldKeyMap?: FieldKeyMap;
}): AccommodationSectionForm<TValues> {
    const { t } = createTranslations(locale);

    const [values, setValues] = useState<TValues>(initialValues);
    const [baseline, setBaseline] = useState<TValues>(initialValues);
    const [isSaving, setIsSaving] = useState(false);

    const { fieldErrors, formError, validate, handleApiError, clearError, setFormError } =
        useZodForm({
            schema,
            t,
            fieldIdPrefix: ACCOMMODATION_FIELD_PREFIX,
            fieldIdSuffixes: ACCOMMODATION_FIELD_ID_SUFFIXES
        });

    const setValue = useCallback(
        <K extends keyof TValues>(field: K, value: TValues[K]) => {
            setValues((prev) => ({ ...prev, [field]: value }));
            clearError(fieldKeyMap[field as string] ?? (field as string));
        },
        [clearError, fieldKeyMap]
    );

    const payload = useMemo(
        () =>
            buildPartialPayload({
                // The diff is name-based, so it works on the record view of the
                // entity. The public signature stays `object` because
                // `AccommodationEditData` is an interface, and TypeScript does
                // not consider an interface assignable to an index signature.
                values: values as Record<string, unknown>,
                baseline: baseline as Record<string, unknown>,
                ownFields,
                fieldKeyMap
            }),
        [values, baseline, ownFields, fieldKeyMap]
    );

    const isDirty = Object.keys(payload).length > 0;

    useUnsavedChangesGuard({
        isDirty,
        message: t(
            'host.properties.editor.unsavedChanges',
            'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
        )
    });

    const handleSubmit = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            setFormError(null);

            if (!isDirty) {
                // Never save silently (HOS-190): "Save" must always visibly do
                // something, even when there is nothing to do.
                addToast({
                    type: 'info',
                    message: t(
                        'host.properties.editor.toast.noChanges',
                        'No hay cambios para guardar'
                    )
                });
                return;
            }

            if (!validate(payload).success) return;

            setIsSaving(true);
            try {
                const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
                const result = await accommodationEditApi.update({
                    id: accommodationId,
                    data: payload
                });

                if (result.ok) {
                    setFormError(null);
                    setBaseline(values);
                    addToast({
                        type: 'success',
                        message: t('host.properties.editor.toast.saveSuccess', 'Cambios guardados')
                    });
                } else {
                    handleApiError(
                        result.error,
                        t('host.properties.editor.error.saveFailed', 'Error al guardar')
                    );
                }
            } catch {
                setFormError(t('host.properties.editor.error.network', 'Error de conexión'));
            } finally {
                setIsSaving(false);
            }
        },
        [accommodationId, handleApiError, isDirty, payload, setFormError, t, validate, values]
    );

    const handleCancel = useCallback(() => {
        if (typeof window !== 'undefined') window.history.back();
    }, []);

    return {
        values,
        setValue,
        fieldErrors,
        formError,
        isSaving,
        isDirty,
        handleSubmit,
        handleCancel
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Builds the PATCH body containing only the fields that actually changed.
 *
 * @param params - Current values, the resyncing baseline, and the key map.
 * @returns A partial payload keyed by HTTP field name.
 */
export function buildPartialPayload<TValues extends Record<string, unknown>>({
    values,
    baseline,
    ownFields,
    fieldKeyMap = {}
}: {
    readonly values: TValues;
    readonly baseline: TValues;
    /**
     * Restricts the diff to the page's own fields. Without it, a page that holds
     * the whole entity for rendering would ship every stale field it happens to
     * carry — the exact cross-section clobbering the split exists to prevent.
     */
    readonly ownFields: readonly string[];
    readonly fieldKeyMap?: FieldKeyMap;
}): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const key of ownFields) {
        if (!hasChanged({ current: values[key], initial: baseline[key] })) continue;
        payload[fieldKeyMap[key] ?? key] = values[key];
    }

    // Coordinates are all-or-nothing on the wire: the HTTP→domain mapper only
    // emits `location.coordinates` when BOTH keys are present, so a diff that
    // caught only one would drop the update entirely and report success.
    if (ownFields.includes('latitude') || ownFields.includes('longitude')) {
        const touched = 'latitude' in payload || 'longitude' in payload;
        if (touched) {
            payload.latitude = values.latitude;
            payload.longitude = values.longitude;
        }
    }

    return payload;
}

/**
 * Compares one field, treating arrays by membership rather than identity.
 *
 * @param params - The current and baseline values.
 * @returns True when the field differs.
 */
function hasChanged({
    current,
    initial
}: {
    readonly current: unknown;
    readonly initial: unknown;
}): boolean {
    if (Array.isArray(current) && Array.isArray(initial)) {
        if (current.length !== initial.length) return true;
        return current.some((item) => !initial.includes(item));
    }
    return current !== initial;
}
