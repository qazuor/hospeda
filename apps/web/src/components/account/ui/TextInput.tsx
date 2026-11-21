/**
 * TextInput — the single-line text control of the Mi Cuenta kit
 * (HOS-2413 T-006).
 *
 * 44px tall, 16px text, `control-bg` background and `control-border` edge.
 * Inside a {@link Field} it picks up its id, `aria-describedby` and
 * `aria-invalid`; outside one it takes them as plain props.
 *
 * @module components/account/ui/TextInput
 */

import type { InputHTMLAttributes, Ref } from 'react';
import styles from './Control.module.css';
import { cx } from './cx';
import { useFieldControl } from './field-context';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link TextInput}. */
export interface TextInputProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
    /** Force the invalid look outside a Field. */
    readonly invalid?: boolean;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Ref to the underlying `<input>`. */
    readonly ref?: Ref<HTMLInputElement>;
}

/**
 * The kit text input.
 *
 * @param props - See {@link TextInputProps}.
 * @returns An `<input>` element.
 */
export function TextInput({
    invalid,
    className,
    helpId,
    type = 'text',
    id,
    required,
    ref,
    'aria-describedby': describedBy,
    ...rest
}: TextInputProps) {
    const control = useFieldControl({ id, describedBy, invalid, required });
    return (
        <input
            {...rest}
            {...control}
            {...helpAttr({ helpId })}
            ref={ref}
            type={type}
            className={cx(styles.control, className)}
        />
    );
}
