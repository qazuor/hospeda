/**
 * @file EditableNote.tsx
 * @description The inline personal note of a bookmark card (HOS-2445,
 * HOS-2480).
 *
 * The note (bookmark `description`) reads as text; activating it opens a
 * textarea. It is a direct-action control (D8 «dos modelos de guardado»): it
 * saves on blur and reports through the kit `AutoSaveChip` (saving, saved,
 * failed with retry). Save and Cancel stay as explicit buttons.
 *
 * - Max 300 characters with a live counter; Escape cancels.
 * - Cancel/Escape never save: the blur that follows them is ignored.
 * - A failed draft is not re-sent on every later blur, only on retry or edit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AutoSaveChip, type AutoSaveStatus, Button } from '@/components/account/ui';
import { translateApiError } from '@/lib/api-errors';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import styles from './EditableNote.module.css';

const NOTE_MAX_LENGTH = 300;
const TEXTAREA_MIN_ROWS = 3;
const TEXTAREA_MAX_ROWS = 6;

/** Props of {@link EditableNote}. */
export interface EditableNoteProps {
    /** Bookmark id (PATCH target). */
    readonly bookmarkId: string;
    /** Current persisted value (null or empty means no note). */
    readonly initialValue: string | null | undefined;
    /** Called after a successful save with the new note. */
    readonly onSaved?: (newValue: string) => void;
    /** API origin without trailing slash. */
    readonly apiBase: string;
    /** Locale for the copy and for translating API errors. */
    readonly locale: SupportedLocale;
}

/** Row count for the auto-growing textarea (3 to 6). */
function computeRows(value: string): number {
    return Math.min(TEXTAREA_MAX_ROWS, Math.max(TEXTAREA_MIN_ROWS, value.split('\n').length));
}

/**
 * Inline note editor for one bookmark.
 *
 * @param props - See {@link EditableNoteProps}.
 * @returns The read view or the editor, plus the autosave chip.
 */
export function EditableNote({
    bookmarkId,
    initialValue,
    onSaved,
    apiBase,
    locale
}: EditableNoteProps) {
    const t = createT(locale);
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(initialValue ?? '');
    const [isSaving, setIsSaving] = useState(false);
    // Last persisted value: keeps the read view right without a parent re-render.
    const [persistedValue, setPersistedValue] = useState(initialValue ?? '');
    const [status, setStatus] = useState<AutoSaveStatus | null>(null);
    const [savedAt, setSavedAt] = useState<Date | undefined>(undefined);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Set by Escape/Cancel so the blur that follows never saves a discarded note.
    const cancelledRef = useRef(false);
    // Draft whose save failed: blur does not retry it until the draft changes.
    const failedDraftRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isEditing) {
            setDraft(initialValue ?? '');
            setPersistedValue(initialValue ?? '');
        }
    }, [initialValue, isEditing]);

    useEffect(() => {
        if (isEditing) textareaRef.current?.focus();
    }, [isEditing]);

    const handleEdit = useCallback(() => {
        cancelledRef.current = false;
        failedDraftRef.current = null;
        setStatus(null);
        setDraft(persistedValue);
        setIsEditing(true);
    }, [persistedValue]);

    const handleCancel = useCallback(() => {
        cancelledRef.current = true;
        setDraft(persistedValue);
        setStatus(null);
        setIsEditing(false);
    }, [persistedValue]);

    const handleSave = useCallback(async () => {
        if (isSaving) return;
        setIsSaving(true);
        setStatus('saving');
        try {
            const res = await fetch(`${apiBase}/api/v1/protected/user-bookmarks/${bookmarkId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: draft })
            });
            if (!res.ok) {
                let apiError: { code?: string; message?: string } | undefined;
                try {
                    const body = (await res.json()) as {
                        error?: { code?: string; message?: string };
                    };
                    apiError = body.error;
                } catch {
                    // Not JSON: the fallback copy is used.
                }
                throw new Error(
                    translateApiError({
                        error: apiError,
                        locale,
                        fallback: t('account.favorites.errors.saveFailed')
                    })
                );
            }
            setPersistedValue(draft);
            onSaved?.(draft);
            failedDraftRef.current = null;
            setIsEditing(false);
            setSavedAt(new Date());
            setStatus('saved');
        } catch (err) {
            failedDraftRef.current = draft;
            setStatus('error');
            addToast({
                type: 'error',
                message:
                    err instanceof Error ? err.message : t('account.favorites.errors.saveFailed')
            });
            // The editor stays open with the draft so the user can retry.
        } finally {
            setIsSaving(false);
        }
    }, [apiBase, bookmarkId, draft, isSaving, onSaved, locale, t]);

    /**
     * Saves when the textarea loses focus, so a typed note is never dropped
     * (HOS-2445). Focus moving to Save/Cancel is left to those buttons.
     */
    const handleBlur = useCallback(
        (event: React.FocusEvent<HTMLTextAreaElement>) => {
            const next = event.relatedTarget as Node | null;
            if (next && event.currentTarget.parentElement?.contains(next)) return;
            if (isSaving || cancelledRef.current) return;
            if (draft === failedDraftRef.current) return;
            if (draft === persistedValue) {
                setIsEditing(false);
                return;
            }
            if (draft.length > NOTE_MAX_LENGTH) return;
            void handleSave();
        },
        [draft, persistedValue, isSaving, handleSave]
    );

    const isOverLimit = draft.length > NOTE_MAX_LENGTH;
    const displayValue = persistedValue.trim();
    const chip =
        status === null ? null : (
            <AutoSaveChip
                status={status}
                savedAt={savedAt}
                locale={locale}
                onRetry={() => {
                    failedDraftRef.current = null;
                    void handleSave();
                }}
            />
        );

    if (isEditing) {
        return (
            <div className={styles.note}>
                <div className={styles.editor}>
                    <textarea
                        ref={textareaRef}
                        className={styles.textarea}
                        aria-label={t('account.favorites.notes.label')}
                        value={draft}
                        rows={computeRows(draft)}
                        maxLength={NOTE_MAX_LENGTH + 1}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') handleCancel();
                        }}
                        onBlur={handleBlur}
                        disabled={isSaving}
                    />
                    <div className={styles.footer}>
                        <span
                            className={isOverLimit ? styles.countOver : styles.count}
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            {draft.length}/{NOTE_MAX_LENGTH}
                        </span>
                        <div className={styles.actions}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                {t('account.favorites.notes.cancel')}
                            </Button>
                            <Button
                                size="sm"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    void handleSave();
                                }}
                                disabled={isOverLimit}
                                loading={isSaving}
                            >
                                {t('account.favorites.notes.save')}
                            </Button>
                        </div>
                    </div>
                </div>
                {chip}
            </div>
        );
    }

    const visible =
        displayValue.length > 0 ? displayValue : t('account.favorites.notes.placeholder');
    return (
        <div className={styles.note}>
            <button
                type="button"
                className={
                    displayValue.length > 0 ? styles.trigger : `${styles.trigger} ${styles.empty}`
                }
                onClick={handleEdit}
                aria-label={`${t('account.favorites.notes.edit')}: ${visible}`}
            >
                {visible}
            </button>
            {chip}
        </div>
    );
}
