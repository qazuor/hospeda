/**
 * InputGroup — a text input with a prefix or suffix addon (HOS-2413 T-006).
 *
 * Addons such as «$», «ARS» or «+54» sit inside the control's border. They are
 * decorative for assistive tech (`aria-hidden`): say what the unit is in the
 * label or the hint.
 *
 * @module components/account/ui/InputGroup
 */

import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Control.module.css';
import { cx } from './cx';
import { useFieldControl } from './field-context';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link InputGroup}. */
export interface InputGroupProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size' | 'prefix'> {
    /** Addon before the input («$», «+54»). */
    readonly prefix?: ReactNode;
    /** Addon after the input («ARS», «m²»). */
    readonly suffix?: ReactNode;
    /** Force the invalid look outside a Field. */
    readonly invalid?: boolean;
    /** Extra class on the wrapper (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help` on the wrapper. */
    readonly helpId?: HelpAnchor;
    /** Ref to the underlying `<input>`. */
    readonly ref?: Ref<HTMLInputElement>;
}

/**
 * The kit input with addons.
 *
 * @param props - See {@link InputGroupProps}.
 * @returns A wrapper `<div>` around an `<input>`.
 */
export function InputGroup({
    prefix,
    suffix,
    invalid,
    className,
    helpId,
    type = 'text',
    id,
    required,
    disabled,
    ref,
    'aria-describedby': describedBy,
    ...rest
}: InputGroupProps) {
    const control = useFieldControl({ id, describedBy, invalid, required });
    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(
                styles.group,
                control['aria-invalid'] && styles.groupInvalid,
                disabled && styles.groupDisabled,
                className
            )}
        >
            {prefix ? (
                <span
                    className={styles.addon}
                    aria-hidden="true"
                    data-addon="prefix"
                >
                    {prefix}
                </span>
            ) : null}
            <input
                {...rest}
                {...control}
                ref={ref}
                type={type}
                disabled={disabled}
                className={styles.bare}
            />
            {suffix ? (
                <span
                    className={styles.addon}
                    aria-hidden="true"
                    data-addon="suffix"
                >
                    {suffix}
                </span>
            ) : null}
        </div>
    );
}
