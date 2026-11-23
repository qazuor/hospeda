/**
 * CopyField — a read-only value with a «Copiar» button that SAYS it copied
 * (HOS-2502, spec §6.1).
 *
 * The result of the copy is announced through a polite live region, so a
 * screen-reader user hears «Copiado» (or the failure) instead of a silent
 * click. The same text is shown to sighted users next to the button and fades
 * back after a moment. When the browser refuses the clipboard, the value is
 * selected so the user can copy it by hand.
 *
 * @module components/account/ui/CopyField
 */
import { CheckIcon, CopyIcon } from '@repo/icons';
import { useEffect, useId, useRef, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import styles from './CopyField.module.css';
import { cx } from './cx';
import { Field } from './Field';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { TextInput } from './TextInput';

/** How long the «Copiado» confirmation stays, in milliseconds. */
export const COPY_FEEDBACK_MS = 2500;

type CopyStatus = 'idle' | 'copied' | 'failed';

/** Props of {@link CopyField}. */
export interface CopyFieldProps {
    /** Visible label of the field. */
    readonly label: string;
    /** The value to show and copy. */
    readonly value: string;
    /** Locale for the button and the announcements. */
    readonly locale: SupportedLocale;
    /** Helper text under the field. */
    readonly hint?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit copy field.
 *
 * @param props - See {@link CopyFieldProps}.
 * @returns A labelled read-only input with a copy button and a live region.
 */
export function CopyField({ label, value, locale, hint, className, helpId }: CopyFieldProps) {
    const t = createT(locale);
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<CopyStatus>('idle');

    useEffect(() => {
        if (status === 'idle') return;
        const timer = setTimeout(() => setStatus('idle'), COPY_FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [status]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setStatus('copied');
        } catch {
            inputRef.current?.select();
            setStatus('failed');
        }
    };

    const message =
        status === 'copied'
            ? t('account.ui.copyField.copied')
            : status === 'failed'
              ? t('account.ui.copyField.failed')
              : '';

    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(styles.root, className)}
        >
            <Field
                label={label}
                locale={locale}
                id={id}
                hint={hint}
            >
                <div className={styles.row}>
                    <TextInput
                        ref={inputRef}
                        readOnly
                        value={value}
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        variant="secondary"
                        onClick={handleCopy}
                    >
                        {status === 'copied' ? (
                            <CheckIcon
                                size={16}
                                aria-hidden="true"
                            />
                        ) : (
                            <CopyIcon
                                size={16}
                                aria-hidden="true"
                            />
                        )}
                        {t('account.ui.copyField.copy')}
                    </Button>
                </div>
            </Field>
            <p
                className={styles.status}
                data-status={status}
                role="status"
                aria-live="polite"
            >
                {message}
            </p>
        </div>
    );
}
