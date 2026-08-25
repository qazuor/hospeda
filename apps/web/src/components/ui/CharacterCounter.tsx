/**
 * @file CharacterCounter.tsx
 * @description The `used/total` readout under a length-capped field (HOS-783 B5).
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
export type CharacterCounterState = 'normal' | 'warning' | 'danger';

/**
 * Classifies how close a value is to its limit.
 *
 * The single definition of the threshold. `danger` covers `>=` rather than
 * `>` so a field pinned at its `maxLength` — which is what the browser does,
 * silently — still reads as at the limit instead of merely near it.
 *
 * @param params - Current length and the field's maximum.
 * @returns The severity to render.
 */
export function getCharacterCounterState({
    current,
    max
}: {
    readonly current: number;
    readonly max: number;
}): CharacterCounterState {
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
    /** The field's `maxLength`. */
    readonly max: number;
    /** Optional test hook. */
    readonly testId?: string;
}

/**
 * Renders the `used/total` readout for a length-capped field.
 *
 * @param props - See {@link CharacterCounterProps}.
 *
 * @example
 * ```tsx
 * <CharacterCounter id={`${nameId}-counter`} locale={locale} current={name.length} max={100} />
 * ```
 */
export function CharacterCounter({
    id,
    locale,
    current,
    max,
    testId
}: CharacterCounterProps): JSX.Element {
    const { t } = createTranslations(locale);
    const state = getCharacterCounterState({ current, max });

    return (
        <p
            id={id}
            // `normal` deliberately has no modifier class. Indexing the styles
            // map with it would yield `undefined` and print a literal
            // "undefined" into the class attribute.
            className={cn(styles.counter, state !== 'normal' && styles[`counter--${state}`])}
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
            {t('comments.form.charCount', '{{count}}/{{max}}', {
                count: String(current),
                max: String(max)
            })}
        </p>
    );
}
