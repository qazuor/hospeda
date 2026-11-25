/**
 * Select — the native `<select>` of the Mi Cuenta kit (HOS-2413 T-007).
 *
 * 44px tall with 16px text. Native semantics preserve mobile pickers, keyboard
 * operation and screen-reader support; custom token-painted appearance replaces
 * browser chrome, with a decorative CSS chevron only for dropdowns. Inside a
 * {@link Field} it picks up its id and ARIA attributes.
 *
 * @module components/account/ui/Select
 */

import type { Ref, SelectHTMLAttributes } from 'react';
import styles from './Control.module.css';
import { cx } from './cx';
import { useFieldControl } from './field-context';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link Select}. */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
    /** Force the invalid look outside a Field. */
    readonly invalid?: boolean;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Ref to the underlying `<select>`. */
    readonly ref?: Ref<HTMLSelectElement>;
}

/**
 * The kit select.
 *
 * @param props - See {@link SelectProps}.
 * @returns A wrapper around the native `<select>` element.
 */
export function Select({
    invalid,
    className,
    helpId,
    id,
    required,
    ref,
    'aria-describedby': describedBy,
    children,
    multiple,
    size,
    ...rest
}: SelectProps) {
    const control = useFieldControl({ id, describedBy, invalid, required });
    return (
        <div className={cx(styles.selectWrap, !multiple && (size ?? 0) <= 1 && styles.dropdown)}>
            <select
                {...rest}
                {...control}
                {...helpAttr({ helpId })}
                ref={ref}
                multiple={multiple}
                size={size}
                className={cx(styles.control, styles.select, className)}
            >
                {children}
            </select>
        </div>
    );
}
