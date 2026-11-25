/**
 * ChoiceGroup — the `<fieldset>/<legend>` shell shared by CheckboxGroup and
 * RadioGroup (HOS-2413 T-007). Internal: not exported from the kit entry.
 * Native grouping semantics remain independent of the token-painted choice chrome.
 *
 * @module components/account/ui/ChoiceGroup
 */

import { AlertCircleIcon } from '@repo/icons';
import { type ReactNode, useId } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './Choice.module.css';
import { cx } from './cx';
import { joinDescribedBy } from './field-context';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props shared by CheckboxGroup and RadioGroup. */
export interface ChoiceGroupProps {
    /** Visible legend: the group's accessible name. */
    readonly legend: ReactNode;
    /** Locale for the hidden error prefix. */
    readonly locale: SupportedLocale;
    /** Helper text under the group. */
    readonly hint?: ReactNode;
    /** Error text under the group. */
    readonly error?: ReactNode;
    /** Disables every choice inside. */
    readonly disabled?: boolean;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** The choices. */
    readonly children: ReactNode;
}

/**
 * Renders the fieldset, legend, items, hint and error.
 *
 * @param props - See {@link ChoiceGroupProps}.
 * @returns A `<fieldset>` element.
 */
export function ChoiceGroup({
    legend,
    locale,
    hint,
    error,
    disabled,
    helpId,
    className,
    children
}: ChoiceGroupProps) {
    const id = useId();
    const t = createT(locale);
    const hasHint = hint !== undefined && hint !== null && hint !== false;
    const hasError = error !== undefined && error !== null && error !== false;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    return (
        <fieldset
            {...helpAttr({ helpId })}
            disabled={disabled}
            aria-describedby={joinDescribedBy(
                hasHint ? hintId : undefined,
                hasError ? errorId : undefined
            )}
            aria-invalid={hasError ? true : undefined}
            className={cx(styles.fieldset, className)}
        >
            <legend className={styles.legend}>{legend}</legend>
            <div className={styles.items}>{children}</div>
            {hasHint ? (
                <p
                    id={hintId}
                    className={styles.hint}
                >
                    {hint}
                </p>
            ) : null}
            {hasError ? (
                <p
                    id={errorId}
                    className={styles.error}
                >
                    <AlertCircleIcon
                        size="sm"
                        className={styles.errorIcon}
                        aria-hidden="true"
                    />
                    <span className={styles.visuallyHidden}>{t('account.ui.errorPrefix')} </span>
                    <span>{error}</span>
                </p>
            ) : null}
        </fieldset>
    );
}
