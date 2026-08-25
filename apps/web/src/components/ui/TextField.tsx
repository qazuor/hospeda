/**
 * @file TextField.tsx
 * @description Shared form-field wrapper that owns the DOM `id`, the
 * `aria-invalid` / `aria-describedby` pairing and the `<FieldError>` render as
 * ONE unit (HOS-385).
 *
 * ## Why this exists
 *
 * Four naming layers described the same field and drifted apart independently:
 * the Zod key (`facebook`), the React state key (`facebookUrl`), the DOM id
 * (`acc-facebook`) and the error element id. HOS-373 had to introduce per-editor
 * lookup tables just so focus-on-error could find an input, and a wrong row in
 * those tables failed SILENTLY.
 *
 * Here the id is derived from the Zod key by {@link buildFieldId} and used for
 * every one of those roles at once, so nothing is left to keep in sync.
 *
 * ## What it deliberately does not do
 *
 * It does not style the label or the control — see `TextField.module.css` for
 * why (the sections' `.fieldLabel` genuinely differs, and unifying it would move
 * the layout). Pass the section's own classes through `labelClassName` and
 * `className`.
 */

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import { cn } from '@/lib/cn';
import type { BuildFieldIdParams } from '@/lib/forms/build-field-id';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { CharacterCounter } from './CharacterCounter';
import styles from './TextField.module.css';

/** Attributes the wrapper owns; a caller passing them would defeat the point. */
type OwnedAttributes = 'id' | 'aria-invalid' | 'aria-describedby';

/** Props shared by every rendered control type. */
interface TextFieldCommonProps {
    /** Editor-level namespace, e.g. `'acc'` or `'ce'`. */
    readonly prefix: string;
    /** The Zod field path this control edits, e.g. `'facebook'`. */
    readonly name: string;
    /**
     * Disambiguator when one Zod key renders as several controls (e.g. `phone`
     * → country + number). Read it from the editor's shared suffix constant —
     * never hand-write it here, or the focus site can disagree with this one.
     */
    readonly suffix?: string;
    /** Already-translated label text. This component never calls `t()`. */
    readonly label: ReactNode;
    /** Validation message. Falsy renders no error and leaves the control valid. */
    readonly error?: string | null;
    /** Class for the `<label>` — pass the section's own `styles.fieldLabel`. */
    readonly labelClassName?: string;
    /** Extra content rendered between the label and the control. */
    readonly beforeControl?: ReactNode;
    /**
     * Whether the wrapper renders the `<FieldError>` itself. Defaults to `true`.
     *
     * Set `false` when ONE Zod field is edited by SEVERAL controls and the error
     * belongs below the group rather than below this control — `phone` and
     * `whatsapp` are a country combobox plus a number input inside a
     * `<fieldset>`, with the message under the whole fieldset. Rendering it here
     * would move it into the number column, a silent visual change.
     *
     * The wrapper still owns `aria-invalid` and `aria-describedby`, so the
     * caller only chooses WHERE the message goes, never what it is keyed by.
     * Build that element's id with {@link buildFieldErrorId} and the same
     * params — never by hand.
     */
    readonly renderError?: boolean;
    /**
     * Renders a `used/total` readout under the control and points the field's
     * `aria-describedby` at it (HOS-783 B5).
     *
     * Ignored unless the control also carries a numeric `maxLength` and a
     * string `value` — a counter without a limit has nothing to count towards,
     * and an uncontrolled control has no length to read.
     */
    readonly counter?: {
        /** Active UI locale, for the `used/total` string. */
        readonly locale: SupportedLocale;
        /** Minimum length enforced for the field, when present. */
        readonly min?: number;
        /**
         * Set when the field may be left empty, so `min` governs only once
         * there IS content — an empty optional field is valid, not short.
         */
        readonly optional?: boolean;
        /** Optional test hook forwarded to the counter element. */
        readonly testId?: string;
    };
}

/**
 * Builds the id of a field's error element, from the same params that build the
 * control's id.
 *
 * Only needed when {@link TextField} is used with `renderError={false}` and the
 * caller places the `<FieldError>` itself. Using this rather than writing the id
 * out is what keeps the externally-placed message and the control's
 * `aria-describedby` pointing at each other.
 *
 * @param params - The same prefix/name/suffix passed to the field.
 */
export function buildFieldErrorId(params: BuildFieldIdParams): string {
    return fieldErrorId(buildFieldId(params));
}

/** Props for {@link TextField}, discriminated by the control being rendered. */
export type TextFieldProps = TextFieldCommonProps &
    (
        | ({ readonly as?: 'input' } & Omit<ComponentPropsWithoutRef<'input'>, OwnedAttributes>)
        | ({ readonly as: 'textarea' } & Omit<
              ComponentPropsWithoutRef<'textarea'>,
              OwnedAttributes
          >)
        | ({ readonly as: 'select' } & Omit<ComponentPropsWithoutRef<'select'>, OwnedAttributes>)
    );

/**
 * Renders a labelled form control wired to its own error message.
 *
 * The control's `id`, the label's `htmlFor` and the error element's `id` all
 * come from a single {@link buildFieldId} call, so they cannot drift.
 * `aria-describedby` points at the error only while there IS an error — an
 * `aria-describedby` aimed at an element that is not rendered is a dangling
 * reference, and `FieldError` renders nothing when the message is falsy.
 *
 * @param props - Field identity, label, error, plus the native control's own props.
 */
export function TextField(props: TextFieldProps) {
    const {
        prefix,
        name,
        suffix,
        label,
        error,
        labelClassName,
        beforeControl,
        renderError = true,
        counter,
        as = 'input',
        className,
        ...controlProps
    } = props as TextFieldCommonProps & {
        readonly as?: 'input' | 'textarea' | 'select';
        readonly className?: string;
    } & Record<string, unknown>;

    const id = buildFieldId({ prefix, name, suffix });
    const errorId = fieldErrorId(id);
    const hasError = Boolean(error);

    const maxLength = controlProps.maxLength;
    const value = controlProps.value;
    const showCounter =
        counter !== undefined && typeof maxLength === 'number' && typeof value === 'string';
    const counterId = `${id}-counter`;

    // Both ids or neither: an `aria-describedby` aimed at an element that is
    // not rendered is a dangling reference.
    const describedBy =
        [hasError ? errorId : null, showCounter ? counterId : null].filter(Boolean).join(' ') ||
        undefined;

    const sharedControlProps = {
        id,
        className,
        'aria-invalid': hasError,
        'aria-describedby': describedBy
    };

    return (
        <>
            <label
                htmlFor={id}
                className={labelClassName}
            >
                {label}
            </label>

            {beforeControl}

            {as === 'textarea' ? (
                <textarea
                    {...(controlProps as ComponentPropsWithoutRef<'textarea'>)}
                    {...sharedControlProps}
                />
            ) : as === 'select' ? (
                <select
                    {...(controlProps as ComponentPropsWithoutRef<'select'>)}
                    {...sharedControlProps}
                />
            ) : (
                <input
                    {...(controlProps as ComponentPropsWithoutRef<'input'>)}
                    {...sharedControlProps}
                />
            )}

            {showCounter && (
                <CharacterCounter
                    id={counterId}
                    locale={counter.locale}
                    current={(value as string).length}
                    min={counter.min}
                    optional={counter.optional}
                    max={maxLength as number}
                    testId={counter.testId}
                />
            )}

            {renderError && (
                <FieldError
                    id={errorId}
                    message={error}
                    className={cn(styles.errorSpacing)}
                />
            )}
        </>
    );
}
