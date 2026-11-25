/**
 * Checkbox and CheckboxGroup — native checkboxes for the Mi Cuenta kit
 * (HOS-2413 T-007).
 *
 * Native semantics with token-painted CSS check and mixed-state glyphs;
 * `indeterminate` is set on the DOM
 * node (it has no HTML attribute). The label row is the 44px target. A group
 * is a `<fieldset>` with a `<legend>`.
 *
 * @module components/account/ui/Checkbox
 */

import { type InputHTMLAttributes, type ReactNode, type Ref, useEffect, useRef } from 'react';
import styles from './Choice.module.css';
import { ChoiceGroup, type ChoiceGroupProps } from './ChoiceGroup';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link Checkbox}. */
export interface CheckboxProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type' | 'children'> {
    /** Visible label. */
    readonly label: ReactNode;
    /** Optional supporting text under the label. */
    readonly description?: ReactNode;
    /** Mixed state (a parent of partially selected children). */
    readonly indeterminate?: boolean;
    /** Marks the checkbox invalid. */
    readonly invalid?: boolean;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Ref to the underlying `<input>`. */
    readonly ref?: Ref<HTMLInputElement>;
}

/**
 * The kit checkbox.
 *
 * @param props - See {@link CheckboxProps}.
 * @returns A `<label>` wrapping a native checkbox.
 */
export function Checkbox({
    label,
    description,
    indeterminate = false,
    invalid,
    className,
    helpId,
    disabled,
    ref,
    ...rest
}: CheckboxProps) {
    const inner = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (inner.current) inner.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const setRef = (node: HTMLInputElement | null) => {
        inner.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as { current: HTMLInputElement | null }).current = node;
    };

    return (
        <label
            {...helpAttr({ helpId })}
            className={cx(styles.choice, disabled && styles.disabled, className)}
        >
            <input
                {...rest}
                ref={setRef}
                type="checkbox"
                disabled={disabled}
                aria-invalid={invalid ? true : undefined}
                className={styles.input}
            />
            <span className={styles.text}>
                <span>{label}</span>
                {description ? <span className={styles.description}>{description}</span> : null}
            </span>
        </label>
    );
}

/** Props of {@link CheckboxGroup}. */
export type CheckboxGroupProps = ChoiceGroupProps;

/**
 * A `<fieldset>` of checkboxes with a visible legend.
 *
 * @param props - See {@link CheckboxGroupProps}.
 * @returns A `<fieldset>` element.
 */
export function CheckboxGroup(props: CheckboxGroupProps) {
    return <ChoiceGroup {...props} />;
}
