/**
 * Textarea — the multi-line control of the Mi Cuenta kit (HOS-2413 T-007).
 * Native editing and resizing with the shared token-painted control surface.
 *
 * With a `limit` it shows a counter that is part of `aria-describedby`. The
 * counter itself is NOT live (it would announce on every keystroke): a
 * separate, permanent `aria-live="polite"` region speaks only when the text
 * crosses 90% of the limit and again at 100%. Over the limit the counter turns
 * `status-danger-fg`. `softLimit` lets the text go over the limit (no native
 * `maxLength`) and warns instead of blocking.
 *
 * @module components/account/ui/Textarea
 */

import { type ChangeEvent, type Ref, type TextareaHTMLAttributes, useId, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './Control.module.css';
import { cx } from './cx';
import { joinDescribedBy, useFieldControl } from './field-context';
import { type HelpAnchor, helpAttr } from './help-anchor';
import counterStyles from './Textarea.module.css';

/** Counter threshold level. */
type CounterLevel = 'ok' | 'near' | 'at' | 'over';

/** Fraction of the limit at which the polite warning first speaks. */
const NEAR_THRESHOLD = 0.9;

/**
 * Classifies a text length against a limit.
 *
 * @param input - Options object.
 * @param input.length - Current text length.
 * @param input.limit - The limit.
 * @returns `ok` below 90%, `near` from 90%, `at` exactly at the limit, `over` above it.
 */
export function counterLevel({
    length,
    limit
}: {
    readonly length: number;
    readonly limit: number;
}): CounterLevel {
    if (length > limit) return 'over';
    if (length === limit) return 'at';
    if (length >= Math.ceil(limit * NEAR_THRESHOLD)) return 'near';
    return 'ok';
}

type NativeTextareaProps = Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'className' | 'maxLength'
>;

/** Props of {@link Textarea}. */
export type TextareaProps = NativeTextareaProps &
    (
        | {
              readonly limit?: undefined;
              readonly softLimit?: undefined;
              readonly locale?: SupportedLocale;
          }
        | {
              /** Character limit; enables the counter. */
              readonly limit: number;
              /** Let the text go over the limit and warn instead of blocking. */
              readonly softLimit?: boolean;
              /** Locale for the counter and its announcements. */
              readonly locale: SupportedLocale;
          }
    ) & {
        /** Force the invalid look outside a Field. */
        readonly invalid?: boolean;
        /** Extra class from the caller (layout only). */
        readonly className?: string;
        /** Optional help anchor rendered as `data-help`. */
        readonly helpId?: HelpAnchor;
        /** Ref to the underlying `<textarea>`. */
        readonly ref?: Ref<HTMLTextAreaElement>;
    };

/**
 * The kit textarea.
 *
 * @param props - See {@link TextareaProps}.
 * @returns A `<textarea>`, wrapped with a counter when `limit` is set.
 */
export function Textarea({
    limit,
    softLimit,
    locale,
    invalid,
    className,
    helpId,
    id,
    required,
    value,
    defaultValue,
    onChange,
    ref,
    'aria-describedby': describedBy,
    ...rest
}: TextareaProps) {
    const counterId = useId();
    const [uncontrolledLength, setUncontrolledLength] = useState(String(defaultValue ?? '').length);
    const length = value === undefined ? uncontrolledLength : String(value).length;
    const hasLimit = limit !== undefined && locale !== undefined;
    const level = hasLimit ? counterLevel({ length, limit }) : 'ok';
    const overLimit = hasLimit && level === 'over';
    const control = useFieldControl({
        id,
        describedBy: joinDescribedBy(describedBy, hasLimit ? counterId : undefined),
        invalid: invalid ?? (overLimit && softLimit !== true ? true : undefined),
        required
    });

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setUncontrolledLength(event.target.value.length);
        onChange?.(event);
    };

    const textarea = (
        <textarea
            {...rest}
            {...control}
            {...helpAttr({ helpId })}
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            maxLength={hasLimit && softLimit !== true ? limit : undefined}
            onChange={handleChange}
            className={cx(styles.control, styles.textarea, className)}
        />
    );

    if (!hasLimit) return textarea;

    const t = createT(locale);
    const params = {
        current: length,
        max: limit,
        remaining: Math.max(limit - length, 0),
        over: Math.max(length - limit, 0)
    };
    const announcement =
        level === 'near'
            ? t('account.ui.charNearLimit', undefined, params)
            : level === 'at'
              ? t('account.ui.charAtLimit', undefined, params)
              : level === 'over'
                ? t('account.ui.charOverLimit', undefined, params)
                : '';

    return (
        <div className={counterStyles.wrap}>
            {textarea}
            <p
                id={counterId}
                className={cx(counterStyles.counter, overLimit && counterStyles.over)}
            >
                {t('account.ui.charCount', undefined, params)}
            </p>
            <p
                aria-live="polite"
                className={counterStyles.visuallyHidden}
            >
                {announcement}
            </p>
        </div>
    );
}
