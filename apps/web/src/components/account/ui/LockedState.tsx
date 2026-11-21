/**
 * LockedState — one way to say «this is not available to you» (HOS-2413 T-028,
 * D9 «sin acceso único», with the D22 trial hook prepared).
 *
 * Four parts: the lock (decorative), what the feature is, WHY it is locked (in
 * text) and the next action. No enabled form control is ever rendered inside,
 * so a locked feature cannot be half-used.
 *
 * - `plan`: `plan`-tone pills with the plan names the caller read from the
 *   catalog (`PlanRef`), «Ver planes» as `accent`, and «Empezar prueba» only
 *   when `onStartTrial` is supplied.
 * - `role`: an `accent` join action.
 * - `permission`: no button, only a link.
 *
 * The kit never holds a plan name, price or limit: `check:commercial-values`
 * stays green because every such value arrives through `reason`.
 *
 * @module components/account/ui/LockedState
 */

import { LockIcon } from '@repo/icons';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import { LinkButton } from './LinkButton';
import styles from './LockedState.module.css';
import type { LockReason } from './lock-reason';
import { StatusPill } from './StatusPill';
import { TextLink } from './TextLink';

/** Props of {@link LockedState}. */
export interface LockedStateProps {
    /** Why it is locked, with everything the copy needs. */
    readonly reason: LockReason;
    /** Locale for the copy. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit locked state.
 *
 * @param props - See {@link LockedStateProps}.
 * @returns A `<div>` with the lock, the feature, the reason and the next step.
 */
export function LockedState({ reason, locale, className, helpId }: LockedStateProps) {
    const t = createT(locale);
    return (
        <div
            {...helpAttr({ helpId })}
            data-reason={reason.kind}
            className={cx(styles.root, className)}
        >
            <span
                className={styles.lock}
                aria-hidden="true"
            >
                <LockIcon size="md" />
            </span>
            <h3 className={styles.feature}>{reason.feature}</h3>
            <p className={styles.description}>{reason.description}</p>

            {reason.kind === 'plan' ? (
                <>
                    <div className={styles.plans}>
                        <p className={styles.why}>{t('account.ui.locked.planWhy')}</p>
                        {reason.plans.map((plan) => (
                            <StatusPill
                                key={plan.name}
                                tone="plan"
                            >
                                {plan.name}
                            </StatusPill>
                        ))}
                    </div>
                    <div className={styles.actions}>
                        <LinkButton
                            href={reason.plansHref}
                            variant="accent"
                        >
                            {t('account.ui.locked.seePlans')}
                        </LinkButton>
                        {reason.onStartTrial ? (
                            <Button
                                variant="secondary"
                                onClick={reason.onStartTrial}
                            >
                                {t('account.ui.locked.startTrial')}
                            </Button>
                        ) : null}
                    </div>
                </>
            ) : null}

            {reason.kind === 'role' ? (
                <>
                    <p className={styles.why}>{t('account.ui.locked.roleWhy')}</p>
                    <div className={styles.actions}>
                        <LinkButton
                            href={reason.joinHref}
                            variant="accent"
                        >
                            {t('account.ui.locked.join')}
                        </LinkButton>
                    </div>
                </>
            ) : null}

            {reason.kind === 'permission' ? (
                <>
                    <p className={styles.why}>{t('account.ui.locked.permissionWhy')}</p>
                    <TextLink href={reason.helpHref}>
                        {t('account.ui.locked.permissionLink')}
                    </TextLink>
                </>
            ) : null}
        </div>
    );
}
