/**
 * Radio, RadioGroup and the OptionCard variant (HOS-2413 T-007).
 *
 * Native radios with token-painted CSS dots: arrow keys move the selection by themselves. A
 * `RadioGroup` is a `<fieldset>` with a `<legend>` and shares one `name` (and,
 * if wanted, a controlled `value`) with its radios. `variant="card"` draws the
 * radio as an OptionCard: the selected one shows a double border AND the
 * `nav-active-bg` background, never color alone.
 *
 * @module components/account/ui/Radio
 */

import {
    createContext,
    type InputHTMLAttributes,
    type ReactNode,
    type Ref,
    useContext,
    useId
} from 'react';
import styles from './Choice.module.css';
import { ChoiceGroup, type ChoiceGroupProps } from './ChoiceGroup';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';

interface RadioGroupContextValue {
    readonly name: string;
    readonly value: string | undefined;
    readonly onValueChange: ((value: string) => void) | undefined;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

/** Props of {@link Radio}. */
export interface RadioProps
    extends Omit<
        InputHTMLAttributes<HTMLInputElement>,
        'className' | 'type' | 'children' | 'value'
    > {
    /** The value this radio stands for. */
    readonly value: string;
    /** Visible label. */
    readonly label: ReactNode;
    /** Optional supporting text under the label. */
    readonly description?: ReactNode;
    /** `card` draws the radio as an OptionCard. @default 'default' */
    readonly variant?: 'default' | 'card';
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Ref to the underlying `<input>`. */
    readonly ref?: Ref<HTMLInputElement>;
}

/**
 * The kit radio.
 *
 * @param props - See {@link RadioProps}.
 * @returns A `<label>` wrapping a native radio.
 */
export function Radio({
    value,
    label,
    description,
    variant = 'default',
    className,
    helpId,
    disabled,
    onChange,
    ref,
    ...rest
}: RadioProps) {
    const group = useContext(RadioGroupContext);
    const controlled =
        group?.value !== undefined && group.onValueChange !== undefined
            ? { checked: group.value === value }
            : {};

    return (
        <label
            {...helpAttr({ helpId })}
            className={cx(
                styles.choice,
                variant === 'card' && styles.card,
                disabled && styles.disabled,
                className
            )}
        >
            <input
                {...rest}
                {...controlled}
                ref={ref}
                type="radio"
                name={rest.name ?? group?.name}
                value={value}
                disabled={disabled}
                className={styles.input}
                onChange={(event) => {
                    group?.onValueChange?.(value);
                    onChange?.(event);
                }}
            />
            <span className={styles.text}>
                <span>{label}</span>
                {description ? <span className={styles.description}>{description}</span> : null}
            </span>
        </label>
    );
}

/** Props of {@link RadioGroup}. */
export interface RadioGroupProps extends ChoiceGroupProps {
    /** Shared `name`. Generated when omitted. */
    readonly name?: string;
    /** Controlled value (pair with `onValueChange`). */
    readonly value?: string;
    /** Called with the newly selected value. */
    readonly onValueChange?: (value: string) => void;
}

/**
 * A `<fieldset>` of radios with a visible legend and a shared `name`.
 *
 * @param props - See {@link RadioGroupProps}.
 * @returns A `<fieldset>` element.
 */
export function RadioGroup({ name, value, onValueChange, ...group }: RadioGroupProps) {
    const generated = useId();
    return (
        <RadioGroupContext.Provider value={{ name: name ?? generated, value, onValueChange }}>
            <ChoiceGroup {...group} />
        </RadioGroupContext.Provider>
    );
}
