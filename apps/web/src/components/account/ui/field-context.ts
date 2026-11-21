/**
 * Field context for the Mi Cuenta kit (HOS-2413 T-006).
 *
 * `Field` provides the control id, the `aria-describedby` list and the
 * invalid/required flags; the kit controls (TextInput, Select, Textarea, …)
 * read them so a caller writes `<Field><TextInput /></Field>` and never wires
 * ids by hand.
 *
 * @module components/account/ui/field-context
 */

import { createContext, useContext } from 'react';

/** What a Field shares with the control inside it. */
export interface FieldContextValue {
    /** DOM id of the control (the label's `htmlFor`). */
    readonly id: string;
    /** Space-separated ids of the hint and error nodes that exist. */
    readonly describedBy: string | undefined;
    /** True when the field has an error. */
    readonly invalid: boolean;
    /** True when the field is required. */
    readonly required: boolean;
}

/** `null` outside a Field. */
export const FieldContext = createContext<FieldContextValue | null>(null);

/** Control props a kit control resolves against its Field. */
export interface ControlAttrs {
    readonly id: string | undefined;
    readonly 'aria-describedby': string | undefined;
    readonly 'aria-invalid': true | undefined;
    readonly 'aria-required': true | undefined;
}

/**
 * Joins `aria-describedby` id lists, skipping empty ones.
 *
 * @param ids - Id lists (each may be space-separated or undefined).
 * @returns The joined list, or `undefined` when empty.
 */
export function joinDescribedBy(...ids: readonly (string | undefined)[]): string | undefined {
    const joined = ids.filter(Boolean).join(' ');
    return joined === '' ? undefined : joined;
}

/**
 * Resolves a control's id and ARIA attributes against its Field.
 *
 * Explicit props win over the Field's; `aria-describedby` is merged. A required
 * field gets `aria-required`, never the native `required` attribute, so the
 * browser's own validation bubbles do not compete with the form's messages.
 *
 * @param input - Options object.
 * @param input.id - Explicit id, if the caller set one.
 * @param input.describedBy - Explicit `aria-describedby`.
 * @param input.invalid - Explicit invalid flag.
 * @param input.required - Explicit required flag.
 * @returns The attributes to spread on the native control.
 */
export function useFieldControl({
    id,
    describedBy,
    invalid,
    required
}: {
    readonly id?: string;
    readonly describedBy?: string;
    readonly invalid?: boolean;
    readonly required?: boolean;
}): ControlAttrs {
    const field = useContext(FieldContext);
    const isInvalid = invalid ?? field?.invalid ?? false;
    const isRequired = required ?? field?.required ?? false;
    return {
        id: field?.id ?? id,
        'aria-describedby': joinDescribedBy(field?.describedBy, describedBy),
        'aria-invalid': isInvalid ? true : undefined,
        'aria-required': isRequired ? true : undefined
    };
}
