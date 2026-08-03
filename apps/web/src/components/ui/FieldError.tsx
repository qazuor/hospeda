/**
 * @file FieldError.tsx
 * @description Shared inline field-error primitive (HOS-190 slice 2). Drop-in
 * replacement for the `{errors.field && <p id="..." role="alert">{msg}</p>}`
 * block every hand-rolled form in `apps/web` repeats (ContactForm,
 * ContributionForm, ChangePasswordForm, CommerceLead, PromotionForm...).
 *
 * Renders nothing when `message` is falsy, so it is safe to always mount:
 * `<FieldError id={fieldErrorId('email')} message={fieldErrors.email} />`.
 *
 * The associated input/select/textarea is responsible for wiring the a11y
 * pairing itself (this component does not touch the input):
 * ```tsx
 * <input
 *   id="cf-email"
 *   aria-invalid={!!fieldErrors.email}
 *   aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
 * />
 * <FieldError id={fieldErrorId('email')} message={fieldErrors.email} />
 * ```
 */

import { cn } from '@/lib/cn';
import styles from './FieldError.module.css';

/** Props for {@link FieldError}. */
export interface FieldErrorProps {
    /** Element id — must match the input's `aria-describedby`. */
    readonly id: string;
    /** Error message to render. Renders nothing when falsy/empty. */
    readonly message?: string | null;
    /** Optional extra class name, appended after the default error styling. */
    readonly className?: string;
}

/**
 * Builds the conventional `<fieldName>-error` id for a field, so the input's
 * `aria-describedby` and this component's `id` prop always stay in sync from
 * a single source (`fieldErrorId('email')` used on both sides).
 *
 * @param fieldName - The field's name/path (e.g. `'email'`, `'contactInfo.mobilePhone'`).
 */
export function fieldErrorId(fieldName: string): string {
    return `${fieldName}-error`;
}

/**
 * Maps a Zod field path to the DOM `id` of the input that should receive focus
 * when that field fails validation (HOS-373 phase 2).
 *
 * Deliberately an explicit table rather than a template. Three naming layers
 * have drifted apart independently in the editors, so no string rule can bridge
 * them:
 *
 * | Zod key         | React state key | DOM id             |
 * |-----------------|-----------------|--------------------|
 * | `facebook`      | `facebookUrl`   | `acc-facebook`     |
 * | `destinationId` | `destinationId` | `acc-destination`  |
 * | `phone`         | `phone`         | `acc-phone-number` |
 *
 * The last row is also why one Zod field can only point at ONE id: phone and
 * whatsapp are composed from a country combobox plus a number input, and the
 * number input is the right target (it is what `aria-describedby` already
 * points at).
 */
export type FieldInputIdMap = Readonly<Record<string, string>>;

/**
 * Resolves the input id to focus for a failed field, or `undefined` when the
 * field is not mapped.
 *
 * Returning `undefined` is a real answer, not a failure: some fields have no
 * single focusable input (an aggregate error over a group), and callers handle
 * those separately.
 *
 * @param fieldName - Dotted Zod path, e.g. `'contactInfo.mobilePhone'`.
 * @param map - The editor's field-to-input-id table.
 */
export function fieldInputId(fieldName: string, map: FieldInputIdMap): string | undefined {
    return map[fieldName];
}

/**
 * FieldError — inline, accessible validation message for a single form field.
 *
 * Renders a `role="alert"` paragraph so assistive tech announces the error
 * as soon as it appears (matches `ConversationReply.client.tsx`'s existing
 * pattern, the best-reviewed error handling among the studied forms).
 */
export function FieldError({ id, message, className }: FieldErrorProps) {
    if (!message) {
        return null;
    }

    return (
        <p
            id={id}
            className={cn(styles.error, className)}
            role="alert"
        >
            {message}
        </p>
    );
}
