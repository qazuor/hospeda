/**
 * @file NlSearchInput.tsx
 * @description Pure controlled textarea + submit button for the AI natural-language
 * search feature (SPEC-199 §5.6). This component is intentionally side-effect-free:
 * it does NOT call any API. The parent (AiSearchPanel) owns the query state, the
 * loading status, and all API interactions. This component only renders the input
 * surface and emits events upward.
 *
 * Constraints (per spec Q3 / §4 Non-goals):
 * - No debounce, no typeahead — submit-only.
 * - Max 500 characters enforced on the textarea.
 * - Submit fires on button click OR Enter key (Shift+Enter inserts newline).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { KeyboardEvent, RefObject } from 'react';
import styles from './NlSearchInput.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum allowed query length in characters. */
const MAX_QUERY_LENGTH = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Status of the AI search request from the parent component. */
export type NlSearchStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Props for the NlSearchInput component.
 * All props are readonly — the component is fully controlled by its parent.
 */
export interface NlSearchInputProps {
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
    /** Current query value (controlled). */
    readonly query: string;
    /** Current request status from the parent. */
    readonly status: NlSearchStatus;
    /**
     * Called when the user changes the textarea content.
     * The parent is responsible for capping length before storing.
     * This component enforces MAX_QUERY_LENGTH via `maxLength` on the textarea.
     */
    readonly onChange: (value: string) => void;
    /**
     * Called when the user submits the query (button click or Enter key).
     * Only fires when the query is non-empty/non-whitespace and status !== 'loading'.
     */
    readonly onSubmit: () => void;
    /**
     * Optional ref forwarded to the underlying `<textarea>` element.
     * The parent uses this to programmatically focus the input when the panel opens (W14).
     */
    readonly textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NlSearchInput — pure controlled input + submit button for AI search.
 *
 * Renders a `<textarea>` bound to `query`, a character counter, and a submit
 * button. All state lives in the parent; this component only emits `onChange`
 * and `onSubmit` events.
 *
 * The submit button is disabled when:
 * - `query.trim()` is empty, or
 * - `status === 'loading'`
 *
 * Keyboard: pressing Enter (without Shift) triggers `onSubmit` if enabled.
 * Shift+Enter inserts a newline as normal.
 */
export function NlSearchInput({
    locale,
    query,
    status,
    onChange,
    onSubmit,
    textareaRef
}: NlSearchInputProps) {
    const { t } = createTranslations(locale);

    const isLoading = status === 'loading';
    const isDisabled = isLoading || query.trim().length === 0;
    const charCount = query.length;

    /** Handle Enter key to submit (Shift+Enter = newline). */
    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isDisabled) {
                onSubmit();
            }
        }
    }

    return (
        <div className={styles.root}>
            <div className={styles.textareaWrapper}>
                <textarea
                    ref={textareaRef}
                    id="nl-search-input"
                    className={styles.textarea}
                    value={query}
                    onChange={(e) => onChange(e.currentTarget.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t(
                        'aiSearch.placeholder',
                        'Describí lo que buscás, ej: cabaña para 4 con pileta cerca del río'
                    )}
                    maxLength={MAX_QUERY_LENGTH}
                    aria-label={t(
                        'aiSearch.placeholder',
                        'Describí lo que buscás, ej: cabaña para 4 con pileta cerca del río'
                    )}
                    aria-describedby="nl-search-char-count"
                    disabled={isLoading}
                    rows={3}
                />
                <span
                    id="nl-search-char-count"
                    className={`${styles.charCount}${charCount >= MAX_QUERY_LENGTH ? ` ${styles.charCountLimit}` : ''}`}
                    aria-live="polite"
                    aria-label={t('aiSearch.charCount', '{{count}}/500', { count: charCount })}
                >
                    {t('aiSearch.charCount', '{{count}}/500', { count: charCount })}
                </span>
            </div>

            <button
                type="button"
                className={styles.submit}
                onClick={onSubmit}
                disabled={isDisabled}
                aria-busy={isLoading}
            >
                {isLoading
                    ? t('aiSearch.submitting', 'Analizando...')
                    : t('aiSearch.submit', 'Buscar')}
            </button>
        </div>
    );
}
