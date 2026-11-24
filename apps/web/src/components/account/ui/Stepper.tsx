/**
 * Stepper — where a person is in a short multi-step flow (HOS-2485, spec
 * HOS-2414 §6.2). Consumer: the add-on purchase (choose → target → confirm).
 * Only for a flow that really moves between screens: a single-page form gets
 * no stepper (HOS-2601 removed it from the profile completion).
 *
 * A labelled `<ol>`; the current step carries `aria-current="step"` and the
 * finished ones a hidden translated «completed». Above the list, a
 * «Step 2 of 3» line says the same in words. Display only: moving between
 * steps (and the back step) belongs to the flow that owns the state.
 *
 * @module components/account/ui/Stepper
 */

import { CheckIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Stepper.module.css';
import linkStyles from './TextLink.module.css';

/** One step of a {@link Stepper}. */
export interface StepperStep {
    /** Stable id of the step. */
    readonly id: string;
    /** Translated, short label. */
    readonly label: ReactNode;
}

/** Props of {@link Stepper}. */
export interface StepperProps {
    /** The steps, in order. */
    readonly steps: readonly StepperStep[];
    /**
     * Index (0-based) of the current step, clamped to `0…steps.length`.
     * `steps.length` means every step is done (no step is current).
     */
    readonly current: number;
    /** Translated accessible name of the flow (e.g. «Compra de complemento»). */
    readonly label: string;
    /** Locale for the fixed copy. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit stepper.
 *
 * @param props - See {@link StepperProps}.
 * @returns A labelled `<nav>`, or `null` with no steps.
 */
export function Stepper({ steps, current, label, locale, className, helpId }: StepperProps) {
    if (steps.length === 0) return null;
    const t = createT(locale);
    const at = Math.min(Math.max(current, 0), steps.length);
    return (
        <nav
            {...helpAttr({ helpId })}
            aria-label={label}
            className={cx(styles.root, className)}
        >
            <p className={styles.progress}>
                {t('account.ui.stepper.progress', undefined, {
                    current: Math.min(at + 1, steps.length),
                    total: steps.length
                })}
            </p>
            <ol className={styles.list}>
                {steps.map((step, index) => {
                    const state = index < at ? 'done' : index === at ? 'current' : 'upcoming';
                    return (
                        <li
                            key={step.id}
                            data-state={state}
                            aria-current={state === 'current' ? 'step' : undefined}
                            className={cx(styles.step, styles[state])}
                        >
                            <span
                                className={styles.marker}
                                aria-hidden="true"
                            >
                                {state === 'done' ? <CheckIcon size="xs" /> : index + 1}
                            </span>
                            <span className={styles.label}>
                                {step.label}
                                {state === 'done' ? (
                                    <span className={linkStyles.visuallyHidden}>
                                        {` (${t('account.ui.stepper.done')})`}
                                    </span>
                                ) : null}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
