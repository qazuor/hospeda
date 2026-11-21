/**
 * Field — label, hint and error around one control (HOS-2413 T-006).
 *
 * - The label is ALWAYS visible and associated with the control. A
 *   placeholder never replaces it.
 * - `required` shows a `destructive-text` asterisk plus hidden «obligatorio».
 *   `optional` shows «(opcional)».
 * - `aria-describedby` lists the hint and error ids that exist, in that
 *   order, and the control gets `aria-invalid` while there is an error. An
 *   error shows an icon plus `status-danger-fg` text.
 * - The control inside reads its id and ARIA attributes from this Field (see
 *   `useFieldControl`), so no one wires ids by hand.
 *
 * Native forms only: no form library.
 *
 * @module components/account/ui/Field
 */

import { AlertCircleIcon } from '@repo/icons';
import { type ReactNode, useId } from 'react';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import styles from './Field.module.css';
import { FieldContext, type FieldContextValue, joinDescribedBy } from './field-context';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link Field}. */
export interface FieldProps {
    /** Visible label text. Always rendered. */
    readonly label: ReactNode;
    /** Locale for the hidden «obligatorio», «(opcional)» and error text. */
    readonly locale: SupportedLocale;
    /** Explicit control id. Wins over `idParts`. */
    readonly id?: string;
    /** Build the id with the repo's `buildFieldId` (`{ prefix, name }`). */
    readonly idParts?: { readonly prefix: string; readonly name: string };
    /** Helper text under the control. */
    readonly hint?: ReactNode;
    /** Error text. Presence marks the control invalid. */
    readonly error?: ReactNode;
    /** Marks the field required (asterisk + hidden text). */
    readonly required?: boolean;
    /** Shows «(opcional)» next to the label. */
    readonly optional?: boolean;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** The control. */
    readonly children: ReactNode;
}

/**
 * The kit field wrapper.
 *
 * @param props - See {@link FieldProps}.
 * @returns A `<div>` with the label, the control, the hint and the error.
 */
export function Field({
    label,
    locale,
    id: explicitId,
    idParts,
    hint,
    error,
    required = false,
    optional = false,
    helpId,
    className,
    children
}: FieldProps) {
    const generated = useId();
    const id = explicitId ?? (idParts ? buildFieldId(idParts) : generated);
    const t = createT(locale);
    const hasHint = hint !== undefined && hint !== null && hint !== false;
    const hasError = error !== undefined && error !== null && error !== false;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const value: FieldContextValue = {
        id,
        describedBy: joinDescribedBy(hasHint ? hintId : undefined, hasError ? errorId : undefined),
        invalid: hasError,
        required
    };

    return (
        <FieldContext.Provider value={value}>
            <div
                {...helpAttr({ helpId })}
                className={cx(styles.root, className)}
            >
                <label
                    htmlFor={id}
                    className={styles.label}
                >
                    {label}
                    {required ? (
                        <>
                            <span
                                className={styles.asterisk}
                                aria-hidden="true"
                            >
                                *
                            </span>
                            <span className={styles.visuallyHidden}>
                                {` ${t('account.ui.required')}`}
                            </span>
                        </>
                    ) : null}
                    {!required && optional ? (
                        <span className={styles.optional}>{t('account.ui.optional')}</span>
                    ) : null}
                </label>
                {children}
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
                        <span className={styles.visuallyHidden}>
                            {t('account.ui.errorPrefix')}{' '}
                        </span>
                        <span>{error}</span>
                    </p>
                ) : null}
            </div>
        </FieldContext.Provider>
    );
}
