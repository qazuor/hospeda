/**
 * @file CharacterCounter.tsx
 * @description The length readout under a capped field, with optional minimum guidance.
 *
 * Shared rather than per-form on purpose: name, summary and description are
 * each edited in TWO places — the publish mini form and the section editor —
 * and a copied threshold is a copied constant that only one side updates. The
 * first cut of B5 landed the counter on the mini form alone, which is what
 * this component exists to stop happening again.
 *
 * @module components/ui/CharacterCounter
 */

import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CharacterCounter.module.css';

/** How full the field is before the counter starts warning. */
const WARNING_RATIO = 0.8;

/** Severity of the readout, also exposed as `data-state`. */
export type CharacterCounterState = 'under-minimum' | 'normal' | 'warning' | 'danger';

/**
 * Classifies how close a value is to its limit.
 *
 * The single definition of the threshold. `danger` covers `>=` rather than
 * `>` so a field pinned at its `maxLength` — which is what the browser does,
 * silently — still reads as at the limit instead of merely near it.
 *
 * @param params - Current length plus the field's bounds.
 * @returns The severity to render.
 */
export function getCharacterCounterState({
    current,
    max,
    min
}: {
    readonly current: number;
    readonly max: number;
    readonly min?: number;
}): CharacterCounterState {
    if (typeof min === 'number' && current < min) return 'under-minimum';
    if (current >= max) return 'danger';
    if (current >= Math.ceil(max * WARNING_RATIO)) return 'warning';
    return 'normal';
}

/** Props for {@link CharacterCounter}. */
export interface CharacterCounterProps {
    /** DOM id, so the field's `aria-describedby` can point here. */
    readonly id: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Current length of the field's value. */
    readonly current: number;
    /** Minimum length enforced for the field, when present. */
    readonly min?: number;
    /** The field's `maxLength`. */
    readonly max: number;
    /** Optional extra class for layout-specific positioning. */
    readonly className?: string;
    /** Optional test hook. */
    readonly testId?: string;
}

/**
 * Renders the length readout for a capped field.
 *
 * @param props - See {@link CharacterCounterProps}.
 *
 * @example
 * ```tsx
 * <CharacterCounter id={`${nameId}-counter`} locale={locale} current={name.length} min={3} max={100} />
 * ```
 */
export function CharacterCounter({
    id,
    locale,
    current,
    min,
    max,
    className,
    testId
}: CharacterCounterProps): JSX.Element {
    const { t } = createTranslations(locale);
    const state = getCharacterCounterState({ current, max, min });

    return (
        <p
            id={id}
            // `normal` deliberately has no modifier class. Indexing the styles
            // map with it would yield `undefined` and print a literal
            // "undefined" into the class attribute.
            className={cn(
                styles.counter,
                className,
                state !== 'normal' && styles[`counter--${state}`]
            )}
            data-state={state}
            data-testid={testId}
            aria-live="polite"
        >
            {/*
             * Lives under `comments` because that is where the repo's only
             * `{{count}}/{{max}}` string already was, and it is already exposed
             * to the client bundle. Referencing it from here keeps it to one
             * call site instead of one per form.
             */}
            {typeof min === 'number'
                ? t('comments.form.charCountWithMin', '{{count}}/{{max}} · mín. {{min}}', {
                      count: String(current),
                      max: String(max),
                      min: String(min)
                  })
                : t('comments.form.charCount', '{{count}}/{{max}}', {
                      count: String(current),
                      max: String(max)
                  })}
            {/*
             * The `under-minimum` state is carried visually by colour alone,
             * which WCAG 1.4.1 does not accept as the sole channel. This spells
             * it out in words instead. It is a `<span>` and NOT an `aria-label`
             * on the paragraph: ARIA forbids naming an element whose role is
             * `generic`, and axe flags it as `aria-prohibited-attr`.
             */}
            {state === 'under-minimum' && (
                <span className="sr-only">
                    {' '}
                    {t(
                        'comments.form.charCountBelowMin',
                        'Todavía no llega al mínimo de {{min}} caracteres',
                        { min: String(min) }
                    )}
                </span>
            )}
        </p>
    );
}
