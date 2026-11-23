/**
 * Composer — the reply box under a {@link ConversationThread} (HOS-2481).
 *
 * A form with the kit `Textarea` (16px text, so iOS never zooms on focus) and
 * a 44px send button. It sits at the bottom of its scroll container with the
 * safe-area inset, so on a phone it stays above the home indicator.
 *
 * Sending NEVER reloads or navigates the page: the submit event's default is
 * always prevented, and the text goes to `onSend`. The composer clears and
 * refocuses at once; the caller appends the message optimistically and owns
 * the retry when it fails (HOS-2439). Ctrl/Cmd + Enter sends, Enter alone adds
 * a line.
 *
 * @module components/account/ui/Composer
 */

import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import styles from './Composer.module.css';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { Textarea } from './Textarea';

/** Default message limit, the API's own (5000 characters). */
const DEFAULT_LIMIT = 5000;

/** Props of {@link Composer}. */
export interface ComposerProps {
    /** Locale for the labels and the counter. */
    readonly locale: SupportedLocale;
    /** Receives the trimmed text. Never called with an empty text. */
    readonly onSend: (input: { readonly body: string }) => void;
    /** Character limit. @default 5000 */
    readonly limit?: number;
    /** Translated visually hidden label of the text box. */
    readonly label?: string;
    /** Translated placeholder. */
    readonly placeholder?: string;
    /** Blocks sending (the text box stays usable). */
    readonly disabled?: boolean;
    /** An error to show above the box (rendered as an alert). */
    readonly error?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit composer.
 *
 * @param props - See {@link ComposerProps}.
 * @returns A `<form>` that never submits natively.
 */
export function Composer({
    locale,
    onSend,
    limit = DEFAULT_LIMIT,
    label,
    placeholder,
    disabled = false,
    error,
    className,
    helpId
}: ComposerProps) {
    const t = createT(locale);
    const id = useId();
    const errorId = useId();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [body, setBody] = useState('');
    const trimmed = body.trim();
    const canSend = !disabled && trimmed.length > 0 && body.length <= limit;

    const send = () => {
        if (!canSend) return;
        onSend({ body: trimmed });
        setBody('');
        textareaRef.current?.focus();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        send();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            send();
        }
    };

    return (
        <form
            {...helpAttr({ helpId })}
            className={cx(styles.root, className)}
            onSubmit={handleSubmit}
            noValidate
            data-composer=""
        >
            {error !== undefined && error !== null && (
                <p
                    id={errorId}
                    className={styles.error}
                    role="alert"
                >
                    {error}
                </p>
            )}
            <label
                htmlFor={id}
                className={styles.visuallyHidden}
            >
                {label ?? t('account.ui.composer.label')}
            </label>
            <div className={styles.row}>
                <Textarea
                    id={id}
                    ref={textareaRef}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder ?? t('account.ui.composer.placeholder')}
                    rows={2}
                    limit={limit}
                    locale={locale}
                    aria-describedby={error ? errorId : undefined}
                    className={styles.textarea}
                />
                <Button
                    type="submit"
                    size="lg"
                    disabled={!canSend}
                    className={styles.send}
                >
                    {t('account.ui.composer.send')}
                </Button>
            </div>
        </form>
    );
}
