/**
 * Stepper — the progress of a short multi-part task (HOS-2501, HOS-2416 §5.1).
 *
 * A presentational ordered list: one item per step, each `done`, `current` or
 * `upcoming`. The current step carries `aria-current="step"`, and the state is
 * always spelled out for assistive technology (never color alone). It is NOT
 * navigation: steps are not links; the page decides what each state means.
 * Below 30rem of container width only the current step keeps its label.
 *
 * @module components/account/ui/Stepper
 */

import { CheckIcon } from '@repo/icons';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Stepper.module.css';

/** The state of one step. */
export type StepState = 'done' | 'current' | 'upcoming';

/** One step of a {@link Stepper}. */
export interface StepperStep {
    /** Stable key of the step. */
    readonly id: string;
    /** Visible, translated label. */
    readonly label: string;
    /** Where the user is relative to this step. */
    readonly state: StepState;
}

/** Props of {@link Stepper}. */
export interface StepperProps {
    /** The steps, in order. */
    readonly steps: readonly StepperStep[];
    /** Locale for the fixed copy. */
    readonly locale: SupportedLocale;
    /** Accessible name of the list (e.g. «Progreso»). */
    readonly label: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Derives the states of an ordered list of steps from the index of the current one.
 *
 * @param input - Options object.
 * @param input.ids - Step ids in order.
 * @param input.currentIndex - Index of the current step; `ids.length` marks everything done.
 * @returns The state of each step: `done` before the current one, `upcoming` after it.
 */
export function stepStates({
    ids,
    currentIndex
}: {
    readonly ids: readonly string[];
    readonly currentIndex: number;
}): readonly { readonly id: string; readonly state: StepState }[] {
    return ids.map((id, index) => ({
        id,
        state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
    }));
}

/**
 * The kit stepper.
 *
 * @param props - See {@link StepperProps}.
 * @returns An `<ol>` of numbered steps.
 */
export function Stepper({ steps, locale, label, className, helpId }: StepperProps) {
    const t = createT(locale);
    return (
        <ol
            {...helpAttr({ helpId })}
            aria-label={label}
            className={cx(styles.root, className)}
        >
            {steps.map((step, index) => (
                <li
                    key={step.id}
                    className={cx(styles.step, styles[step.state])}
                    aria-current={step.state === 'current' ? 'step' : undefined}
                    data-state={step.state}
                >
                    <span
                        className={styles.marker}
                        aria-hidden="true"
                    >
                        {step.state === 'done' ? <CheckIcon size="sm" /> : index + 1}
                    </span>
                    <span className={styles.label}>
                        {step.label}
                        <span className={styles.visuallyHidden}>
                            {' '}
                            {t(`account.ui.stepper.${step.state}`)}
                        </span>
                    </span>
                </li>
            ))}
        </ol>
    );
}
