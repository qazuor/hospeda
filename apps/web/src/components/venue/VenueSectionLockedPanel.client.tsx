/**
 * @file VenueSectionLockedPanel.client.tsx
 * @description The `locked` treatment shared by the three venue section
 * managers (HOS-1854, DEC-FAC-025).
 *
 * A locked section is not an error state: the owner's data is theirs and stays
 * visible, the upsell is proactive (it appears on the first render instead of
 * waiting for a 403), and the one write that stays allowed is emptying the
 * section — removing data is coherent with "building is not viewing"
 * (DEC-FAC-041). That write is the `delete` intent, which the API accepts on a
 * locked section; editing a single dish is a `write` and still answers 403.
 *
 * The component owns the presentation and the confirmation dialog. The
 * read-only rendering of the section's own data stays with each manager: only
 * the manager knows whether it holds courses and dishes, specials, or agenda
 * entries.
 *
 * @module components/venue/VenueSectionLockedPanel
 */

import { LockIcon } from '@repo/icons';
import type { JSX, ReactNode } from 'react';
import { ConfirmDeleteDialog } from '@/components/shared/ui/ConfirmDeleteDialog.client';
import type { ListingPlanGate } from '@/hooks/useListingPlanGate';
import type { SectionVaciarState } from '@/hooks/useSectionVaciar';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './VenueSectionLockedPanel.module.css';

type UpsellTranslator = (key: string, fallback?: string, params?: { plan: string }) => string;

/** Render a catalog-plan message or its neutral fallback for a gated feature. */
export function translateUpsell(input: {
    readonly t: UpsellTranslator;
    readonly planName: string | null | undefined;
    readonly key: string;
    readonly fallback: string;
    readonly noPlanKey: string;
    readonly noPlanFallback: string;
}): string {
    return input.planName
        ? input.t(input.key, input.fallback, { plan: input.planName })
        : input.t(input.noPlanKey, input.noPlanFallback);
}

/**
 * The state a section manager receives from its page.
 *
 * `absent` never reaches a manager: the resolver removes that section from the
 * registry, so its slug redirects to the hub before a page renders.
 */
export type VenueSectionState = 'available' | 'locked';

/** Props for {@link VenueSectionLockedPanel}. */
export interface VenueSectionLockedPanelProps {
    /** DOM id the locked section's controls (the vaciar button) reference. */
    readonly id: string;
    /** Why the section is locked: a plan, or a trial that has not started. */
    readonly gate: Exclude<ListingPlanGate, 'open'>;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** i18n key of the "plan" upsell, naming the section it unlocks. */
    readonly messageKey: string;
    /** Spanish fallback for {@link messageKey}. */
    readonly messageFallback: string;
    /** Localized name of the cheapest catalog plan that unlocks this section. */
    readonly planName?: string | null;
    /** Spanish fallback used when no sellable catalog plan unlocks this section. */
    readonly noPlanMessageFallback?: string;
    /** i18n key of the pre-trial wording ("unlocks when you publish"). */
    readonly preTrialMessageKey: string;
    /** Spanish fallback for {@link preTrialMessageKey}. */
    readonly preTrialMessageFallback: string;
    /** Name of the section, used by the confirmation dialog and the vaciar button. */
    readonly sectionLabel: string;
    /** Whether the section actually holds data — "Vaciar" only exists then. */
    readonly hasData: boolean;
    /** Confirmation/clear interaction state from `useSectionVaciar`. */
    readonly vaciar: SectionVaciarState;
    /** Test hook for the panel; the default is the shared locked notice. */
    readonly testId?: string;
    /** Read-only rendering of the section's stored data. */
    readonly children: ReactNode;
}

/**
 * Renders the proactive upsell, the read-only data, and — only when there is
 * data — the "Vaciar" action with its product-styled confirmation.
 */
export function VenueSectionLockedPanel({
    id,
    gate,
    locale,
    messageKey,
    messageFallback,
    planName,
    noPlanMessageFallback,
    preTrialMessageKey,
    preTrialMessageFallback,
    sectionLabel,
    hasData,
    vaciar,
    testId = 'venue-section-locked-notice',
    children
}: VenueSectionLockedPanelProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.locked}>
            <div
                id={id}
                className={styles.notice}
                role="status"
                data-testid={testId}
            >
                <LockIcon
                    size={16}
                    className={styles.icon}
                    aria-hidden="true"
                />
                <p className={styles.text}>
                    {gate === 'preTrial'
                        ? t(preTrialMessageKey, preTrialMessageFallback)
                        : planName
                          ? t(messageKey, messageFallback, { plan: planName })
                          : noPlanMessageFallback
                            ? t(`${messageKey}NoPlan`, noPlanMessageFallback)
                            : t(messageKey, messageFallback)}
                    {gate === 'plan' ? (
                        <>
                            {' '}
                            <a
                                className={styles.link}
                                href={buildUrl({
                                    locale,
                                    path: PRICING_PAGE_PATH_BY_AUDIENCE.venue
                                })}
                            >
                                {t('venue.owner.editor.menuManager.seePlans', 'Ver planes')}
                            </a>
                        </>
                    ) : null}
                </p>
            </div>

            <div className={styles.readOnly}>{children}</div>

            {hasData ? (
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.vaciarButton}
                        disabled={vaciar.isBusy}
                        aria-describedby={id}
                        data-testid="venue-section-vaciar"
                        onClick={vaciar.request}
                    >
                        {t('venue.owner.editor.lockedSection.vaciar', 'Vaciar')}
                    </button>
                </div>
            ) : null}

            <ConfirmDeleteDialog
                isOpen={vaciar.isDialogOpen}
                title={t('venue.owner.editor.lockedSection.vaciarTitle', 'Vaciar la sección')}
                message={t(
                    'venue.owner.editor.lockedSection.vaciarMessage',
                    'Se van a borrar los datos guardados de esta sección. Esta acción no se puede deshacer.'
                )}
                detail={sectionLabel}
                confirmLabel={t(
                    'venue.owner.editor.lockedSection.vaciarConfirm',
                    'Vaciar la sección'
                )}
                busyLabel={t('venue.owner.editor.lockedSection.vaciarBusy', 'Vaciando…')}
                cancelLabel={t('venue.owner.editor.lockedSection.cancel', 'Cancelar')}
                closeLabel={t('common.close', 'Cerrar')}
                isBusy={vaciar.isBusy}
                onConfirm={vaciar.confirm}
                onCancel={vaciar.cancel}
            />
        </div>
    );
}
