/**
 * @file use-video-section.ts
 * @description State + persistence for the accommodation editor's video widget
 * (G7 smoke, H-121).
 *
 * Deliberately NOT built on `useAccommodationSectionForm`: that hook's diff
 * engine maps one flat form-local key to one flat HTTP key
 * (`fieldKeyMap`), and the PATCH body videos actually travel in is nested —
 * `media: { videos: [...] }` (HOS-372's `HttpMediaUpdateSchema`). Bending the
 * shared five-page engine to emit a nested shape for this one field was not
 * worth the risk to the other five pages that depend on it staying flat.
 * `PhotoSection.client.tsx` already establishes the precedent that a self-
 * contained widget with its own persistence is normal in this editor.
 */

import { useCallback, useState } from 'react';
import type { AccommodationVideoEntry } from '@/lib/api/types';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';

const CAPTION_MIN = 3;
const CAPTION_MAX = 100;

/** One video row as the widget edits it (before caption trimming for submit). */
export interface VideoRow {
    readonly url: string;
    readonly caption: string;
}

/** What the hook hands back to `VideoSection.client.tsx`. */
export interface UseVideoSectionResult {
    readonly rows: readonly VideoRow[];
    readonly isDirty: boolean;
    readonly isSaving: boolean;
    readonly formError: string | null;
    readonly addRow: () => void;
    readonly removeRow: (index: number) => void;
    readonly setRowField: (index: number, field: 'url' | 'caption', value: string) => void;
    readonly handleSubmit: (event: React.FormEvent) => Promise<void>;
}

/** Converts the read-only entity videos into editable rows. */
function toRows(videos: readonly AccommodationVideoEntry[]): readonly VideoRow[] {
    return videos.map((v) => ({ url: v.url, caption: v.caption ?? '' }));
}

/**
 * Validates one row client-side before submit.
 *
 * Mirrors the server's actual constraints (`HttpVideoSchema` / `VideoSchema` in
 * `@repo/schemas`): `url` must be an http(s) URL, `caption` — when non-empty —
 * must be 3–100 chars. An empty caption is valid (omitted from the payload).
 */
function validateRow(row: VideoRow): 'url' | 'caption' | null {
    try {
        const parsed = new URL(row.url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'url';
    } catch {
        return 'url';
    }
    if (
        row.caption.length > 0 &&
        (row.caption.length < CAPTION_MIN || row.caption.length > CAPTION_MAX)
    ) {
        return 'caption';
    }
    return null;
}

/**
 * Drives the video widget: local rows, dirty tracking, validation, and a
 * direct PATCH against the SAME endpoint every other section saves through
 * (`media: { videos }` — HOS-372).
 *
 * @param params - Locale, accommodation id, and the entity's current videos.
 * @returns The widget's state and handlers.
 */
export function useVideoSection({
    locale,
    accommodationId,
    initialVideos
}: {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialVideos: readonly AccommodationVideoEntry[];
}): UseVideoSectionResult {
    const { t } = createTranslations(locale);

    const [rows, setRows] = useState<readonly VideoRow[]>(toRows(initialVideos));
    const [baseline, setBaseline] = useState<readonly VideoRow[]>(toRows(initialVideos));
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const isDirty = JSON.stringify(rows) !== JSON.stringify(baseline);

    useUnsavedChangesGuard({
        isDirty,
        message: t(
            'host.properties.editor.unsavedChanges',
            'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
        )
    });

    const addRow = useCallback(() => {
        setRows((prev) => [...prev, { url: '', caption: '' }]);
    }, []);

    const removeRow = useCallback((index: number) => {
        setRows((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const setRowField = useCallback((index: number, field: 'url' | 'caption', value: string) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    }, []);

    const handleSubmit = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            setFormError(null);

            if (!isDirty) {
                addToast({
                    type: 'info',
                    message: t(
                        'host.properties.editor.toast.noChanges',
                        'No hay cambios para guardar'
                    )
                });
                return;
            }

            for (const row of rows) {
                const invalidField = validateRow(row);
                if (invalidField === 'url') {
                    setFormError(
                        t(
                            'host.properties.editor.video.urlInvalid',
                            'Ingresá una URL de video válida'
                        )
                    );
                    return;
                }
                if (invalidField === 'caption') {
                    setFormError(
                        t(
                            'host.properties.editor.video.captionInvalid',
                            'El título debe tener entre 3 y 100 caracteres, o dejalo vacío'
                        )
                    );
                    return;
                }
            }

            setIsSaving(true);
            try {
                const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
                const result = await accommodationEditApi.update({
                    id: accommodationId,
                    data: {
                        media: {
                            videos: rows.map((row) => ({
                                url: row.url,
                                ...(row.caption.length > 0 ? { caption: row.caption } : {})
                            }))
                        }
                    }
                });

                if (result.ok) {
                    setBaseline(rows);
                    addToast({
                        type: 'success',
                        message: t('host.properties.editor.video.saveSuccess', 'Videos guardados')
                    });
                } else {
                    setFormError(
                        t(
                            'host.properties.editor.video.saveFailed',
                            'No se pudieron guardar los videos'
                        )
                    );
                }
            } catch {
                setFormError(t('host.properties.editor.error.network', 'Error de conexión'));
            } finally {
                setIsSaving(false);
            }
        },
        [accommodationId, isDirty, rows, t]
    );

    return { rows, isDirty, isSaving, formError, addRow, removeRow, setRowField, handleSubmit };
}
