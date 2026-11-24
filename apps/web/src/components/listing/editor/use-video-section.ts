/**
 * @file use-video-section.ts
 * @description State + persistence for the owner editors' video widget
 * (accommodation G7 smoke H-121; venue HOS-2258).
 *
 * Deliberately NOT built on `useAccommodationSectionForm`: that hook's diff
 * engine maps one flat form-local key to one flat HTTP key, and the PATCH body
 * videos travel in differs per surface (`media: { videos }` for an
 * accommodation, a top-level `videos` for a venue). The hook therefore knows no
 * endpoint: the caller hands it a `save` function and the copy scope.
 * `PhotoSection.client.tsx` already establishes the precedent that a
 * self-contained widget with its own persistence is normal in this editor.
 *
 * HOS-2489: the «Fotos» page is an `auto` section (spec HOS-2415 §6.2), so the
 * widget has no Save button of its own any more. A complete, changed list is
 * saved when a field loses focus, on Enter, and right after a row is removed,
 * and every save reports to the shell's auto-save chip. A row whose link is
 * still empty is a draft: nothing is sent and nothing is flagged until the
 * owner fills it, and the unsaved-changes guard still covers it.
 */

import { useCallback, useState } from 'react';
import { runEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { getVideoSectionCopy, type VideoCopyScope } from './video-section-copy';

const CAPTION_MIN = 3;
const CAPTION_MAX = 100;

/** A video as the widget reads it (the stored entity). */
export interface VideoEntry {
    readonly url: string;
    readonly caption?: string | undefined;
    readonly description?: string | undefined;
}

/** A video as `save` receives it: only what the server accepts. */
export interface VideoPayload {
    readonly url: string;
    readonly caption?: string;
}

/** What a caller's `save` reports back. */
export interface VideoSaveResult {
    readonly ok: boolean;
    /** HTTP status of a failed save, when known (a 403 gets its own copy). */
    readonly status?: number | undefined;
}

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
    /** Drops a row and saves the remaining list at once. */
    readonly removeRow: (index: number) => void;
    readonly setRowField: (index: number, field: 'url' | 'caption', value: string) => void;
    /** Saves the current rows when they changed and are complete (field blur). */
    readonly commit: () => void;
    /** Enter inside a field: same as {@link UseVideoSectionResult.commit}. */
    readonly handleSubmit: (event: React.FormEvent) => void;
}

/** Converts the read-only entity videos into editable rows. */
function toRows(videos: readonly VideoEntry[]): readonly VideoRow[] {
    return videos.map((v) => ({ url: v.url, caption: v.caption ?? '' }));
}

/**
 * Validates one row client-side before submit.
 *
 * Mirrors the server's actual constraints (`@repo/schemas`): `url` must be an
 * http(s) URL, `caption` — when non-empty — must be 3–100 chars. An empty
 * caption is valid (omitted from the payload).
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
 * Drives the video widget: local rows, dirty tracking, validation, and the
 * caller-provided save.
 *
 * @param params - Locale, the entity's current videos, how to persist and the copy scope.
 * @returns The widget's state and handlers.
 */
export function useVideoSection({
    locale,
    initialVideos,
    save,
    copyScope,
    maxVideos
}: {
    readonly locale: SupportedLocale;
    readonly initialVideos: readonly VideoEntry[];
    readonly save: (videos: readonly VideoPayload[]) => Promise<VideoSaveResult>;
    readonly copyScope: VideoCopyScope;
    /** Most videos the surface accepts; absent means no cap (accommodation). */
    readonly maxVideos?: number | undefined;
}): UseVideoSectionResult {
    const { t } = createTranslations(locale);
    const copy = getVideoSectionCopy({ scope: copyScope });

    const [rows, setRows] = useState<readonly VideoRow[]>(toRows(initialVideos));
    const [baseline, setBaseline] = useState<readonly VideoRow[]>(toRows(initialVideos));
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const isDirty = JSON.stringify(rows) !== JSON.stringify(baseline);

    useUnsavedChangesGuard({
        isDirty,
        // This widget shares its page with `PhotoSection`'s alt-text nudge
        // (HOS-1018). Passing the locale is what lets the leave-warning
        // registry translate the COMBINED dialog when both are active; while
        // this guard is alone on a page it is unused and the copy below shows
        // verbatim, exactly as before.
        locale,
        title: t('common.confirmations.unsavedChanges.title', 'Cambios sin guardar'),
        confirmLabel: t('common.confirmations.unsavedChanges.confirm', 'Sí, descartar'),
        cancelLabel: t('common.confirmations.unsavedChanges.cancel', 'Seguir editando'),
        message: t(copy.unsavedChanges.key, copy.unsavedChanges.fallback)
    });

    const commitRows = useCallback(
        async (next: readonly VideoRow[]): Promise<void> => {
            if (JSON.stringify(next) === JSON.stringify(baseline)) return;
            // A row still waiting for its link is a draft, not an error.
            if (next.some((row) => row.url.trim() === '')) return;

            if (maxVideos !== undefined && next.length > maxVideos) {
                setFormError(t(copy.tooMany.key, copy.tooMany.fallback));
                return;
            }
            for (const row of next) {
                const invalidField = validateRow(row);
                if (invalidField !== null) {
                    setFormError(
                        invalidField === 'url'
                            ? t(copy.urlInvalid.key, copy.urlInvalid.fallback)
                            : t(copy.captionInvalid.key, copy.captionInvalid.fallback)
                    );
                    return;
                }
            }

            setFormError(null);
            setIsSaving(true);
            await runEditorAutoSave({
                save: async () => {
                    try {
                        const result = await save(
                            next.map((row) => ({
                                url: row.url,
                                ...(row.caption.length > 0 ? { caption: row.caption } : {})
                            }))
                        );
                        if (result.ok) {
                            setBaseline(next);
                        } else if (result.status === 403) {
                            // HOS-2258: the plan has no video entitlement; nothing was stored.
                            setFormError(t(copy.forbidden.key, copy.forbidden.fallback));
                        } else {
                            setFormError(t(copy.saveFailed.key, copy.saveFailed.fallback));
                        }
                        return result.ok;
                    } catch {
                        setFormError(t(copy.network.key, copy.network.fallback));
                        return false;
                    }
                },
                retry: () => {
                    void commitRows(next);
                }
            });
            setIsSaving(false);
        },
        [baseline, copy, maxVideos, save, t]
    );

    const addRow = useCallback(() => {
        setRows((prev) => [...prev, { url: '', caption: '' }]);
    }, []);

    const removeRow = useCallback(
        (index: number) => {
            const next = rows.filter((_, i) => i !== index);
            setRows(next);
            void commitRows(next);
        },
        [rows, commitRows]
    );

    const setRowField = useCallback((index: number, field: 'url' | 'caption', value: string) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    }, []);

    const commit = useCallback(() => {
        void commitRows(rows);
    }, [rows, commitRows]);

    const handleSubmit = useCallback(
        (event: React.FormEvent) => {
            event.preventDefault();
            commit();
        },
        [commit]
    );

    return {
        rows,
        isDirty,
        isSaving,
        formError,
        addRow,
        removeRow,
        setRowField,
        commit,
        handleSubmit
    };
}
