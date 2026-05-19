/**
 * @file EditableNote.tsx
 * @description Inline editable note sub-component for bookmark cards.
 *
 * Renders a user's personal note (bookmark `description`) as static text.
 * Clicking the text (or the edit icon) expands a textarea with Save/Cancel
 * buttons. The caller owns the persisted value — this component calls
 * `onSaved` on success and leaves persistence to the parent.
 *
 * Features:
 * - Max 300 characters with a live character counter.
 * - Auto-grow textarea capped at 6 rows.
 * - Escape key cancels editing.
 * - Enter key on Save button confirms (natural form UX).
 * - ARIA: textarea is labelled via `aria-label`; buttons have explicit text.
 * - On save error an `addToast` is called and the previous value is kept.
 */

import { addToast } from '@/store/toast-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './EditableNote.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_MAX_LENGTH = 300;
const TEXTAREA_MIN_ROWS = 3;
const TEXTAREA_MAX_ROWS = 6;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditableNoteProps {
    /** Bookmark database ID used to call PATCH endpoint. */
    readonly bookmarkId: string;
    /** Current persisted value (may be null or empty string). */
    readonly initialValue: string | null | undefined;
    /**
     * Called after a successful save with the new description string.
     * The parent should update its local copy of the bookmark.
     * Optional: when omitted, the component still updates its own read view
     * via the local `persistedValue` mirror. SSR hosts (e.g. the collection
     * detail Astro page) cannot pass functions across the island boundary,
     * so they omit it and rely on the local mirror instead.
     */
    readonly onSaved?: (newValue: string) => void;
    /** Full base API URL (e.g. `http://localhost:3001`) without trailing slash. */
    readonly apiBase: string;
    /** Placeholder shown when the note is empty and not editing. */
    readonly placeholder: string;
    /** Label for the Save button. */
    readonly saveLabel: string;
    /** Label for the Cancel button. */
    readonly cancelLabel: string;
    /** Accessible label for the textarea (`aria-label`). */
    readonly textareaLabel: string;
    /** Accessible label for the edit trigger button. */
    readonly editButtonLabel: string;
    /** i18n fallback message for save errors. */
    readonly saveErrorMessage: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Inline note editor for a single bookmark card.
 *
 * State is kept local to the card — no lifting required. The component
 * only calls `onSaved` on a successful PATCH response; the parent stores
 * the canonical value and passes it back via `initialValue` on re-render.
 */
export function EditableNote({
    bookmarkId,
    initialValue,
    onSaved,
    apiBase,
    placeholder,
    saveLabel,
    cancelLabel,
    textareaLabel,
    editButtonLabel,
    saveErrorMessage
}: EditableNoteProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(initialValue ?? '');
    const [isSaving, setIsSaving] = useState(false);
    // Tracks the last persisted value. Lets the read view stay up-to-date even
    // when the host page is SSR-rendered and never re-passes a new initialValue
    // (collection detail page is the main consumer of this fallback).
    const [persistedValue, setPersistedValue] = useState(initialValue ?? '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveButtonRef = useRef<HTMLButtonElement>(null);

    // Reset draft + mirror whenever the persisted value changes (e.g. after a
    // successful save the parent passes the new value back in).
    useEffect(() => {
        if (!isEditing) {
            setDraft(initialValue ?? '');
            setPersistedValue(initialValue ?? '');
        }
    }, [initialValue, isEditing]);

    // Auto-focus textarea when editing starts.
    useEffect(() => {
        if (isEditing) {
            textareaRef.current?.focus();
        }
    }, [isEditing]);

    /** Compute dynamic row count for auto-grow (3-6 rows). */
    function computeRows(value: string): number {
        const lineCount = value.split('\n').length;
        return Math.min(TEXTAREA_MAX_ROWS, Math.max(TEXTAREA_MIN_ROWS, lineCount));
    }

    const handleEdit = useCallback(() => {
        setDraft(initialValue ?? '');
        setIsEditing(true);
    }, [initialValue]);

    const handleCancel = useCallback(() => {
        setDraft(initialValue ?? '');
        setIsEditing(false);
    }, [initialValue]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        },
        [handleCancel]
    );

    const handleSave = useCallback(async () => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            const url = `${apiBase}/api/v1/protected/user-bookmarks/${bookmarkId}`;
            const res = await fetch(url, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: draft })
            });

            if (!res.ok) {
                let msg = saveErrorMessage;
                try {
                    const body = (await res.json()) as { error?: { message?: string } };
                    if (body.error?.message) msg = body.error.message;
                } catch {
                    // ignore JSON parse errors
                }
                throw new Error(msg);
            }

            setPersistedValue(draft);
            onSaved?.(draft);
            setIsEditing(false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : saveErrorMessage;
            addToast({ type: 'error', message: msg });
            // Keep editor open with current draft so the user can retry.
        } finally {
            setIsSaving(false);
        }
    }, [apiBase, bookmarkId, draft, isSaving, onSaved, saveErrorMessage]);

    const currentLength = draft.length;
    const isOverLimit = currentLength > NOTE_MAX_LENGTH;
    // Use the locally-tracked persisted value so the read view reflects the
    // last save even when the host page never re-renders (SSR collection page).
    const displayValue = persistedValue.trim();
    const hasNote = displayValue.length > 0;

    // ── Editing view ──────────────────────────────────────────────────────────

    if (isEditing) {
        return (
            <div className={styles.editorWrap}>
                <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    aria-label={textareaLabel}
                    value={draft}
                    rows={computeRows(draft)}
                    maxLength={NOTE_MAX_LENGTH + 1} // allow one extra to show over-limit UI
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                />
                <div className={styles.editorFooter}>
                    <span
                        className={isOverLimit ? styles.charCountOver : styles.charCount}
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {currentLength}/{NOTE_MAX_LENGTH}
                    </span>
                    <div className={styles.editorActions}>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            ref={saveButtonRef}
                            type="button"
                            className={styles.saveBtn}
                            onClick={() => {
                                void handleSave();
                            }}
                            disabled={isSaving || isOverLimit}
                            aria-busy={isSaving}
                        >
                            {saveLabel}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Read view ─────────────────────────────────────────────────────────────

    return (
        <button
            type="button"
            className={hasNote ? styles.noteDisplay : styles.notePlaceholder}
            onClick={handleEdit}
            aria-label={editButtonLabel}
            title={editButtonLabel}
        >
            {hasNote ? displayValue : placeholder}
        </button>
    );
}
