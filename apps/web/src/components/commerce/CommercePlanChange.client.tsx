/**
 * @file CommercePlanChange.client.tsx
 * @description Tier-change CTA + flow for an owner who already holds a
 * commerce subscription for one vertical (HOS-1119; downgrades added by
 * HOS-1122).
 *
 * Mounted once per vertical the owner already subscribes to
 * (`mi-cuenta/comercio/index.astro` — see that file's doc for why this is
 * mounted THERE rather than on `mi-cuenta/suscripcion`). Renders nothing when
 * there is no OTHER tier to move to: a single-tier vertical, or a catalogue
 * whose every other tier costs exactly the same, both degrade to no CTA.
 *
 * ## Three steps, mirroring the accommodation flow
 *
 * 1. **picker** — every tier priced differently from the current one, each
 *    card carrying a note that says what choosing it does.
 * 2. **keep** — downgrades only, and only when the cheaper cap does not cover
 *    everything: `CommerceDowngradeKeepPanel`, fed by the READ-ONLY preview.
 * 3. **scheduled** — a downgrade never redirects and never reloads, because
 *    nothing has changed yet. It says when it will.
 *
 * An upgrade keeps its original behaviour exactly: redirect to MercadoPago for
 * the prorated delta, or reload when it applied at once during a trial.
 *
 * ## Why the preview is fetched before the POST rather than read off it
 *
 * The change-plan response carries a `commerceRestrictionPreview` too, and
 * using THAT would mean scheduling the downgrade first and re-posting the keep
 * set afterwards. The schedule would already exist for an owner who closed the
 * tab mid-decision. `fetchCommerceDowngradePreview` is read-only precisely so
 * that state cannot happen — the same order, and the same reason,
 * `PlanChangeFlow` uses `billingApi.previewDowngrade`.
 */

import type { CommerceDowngradePreview, CommerceKeepSelections } from '@repo/schemas';
import type { JSX } from 'react';
import { useState } from 'react';
import { Dialog } from '@/components/shared/ui/Dialog.client';
import { storePendingCheckoutSubId } from '@/lib/billing/checkout-pending';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { changeCommercePlan, fetchCommerceDowngradePreview } from '@/lib/commerce/owner-listings';
import type { CommercePlanOption } from '@/lib/commerce/plan-options';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CommerceDowngradeKeepPanel } from './CommerceDowngradeKeepPanel.client';
import styles from './CommercePlanChange.module.css';
import { CommercePlanPicker } from './CommercePlanPicker.client';

/** Which way the chosen tier moves, decided on price — the API's own predicate. */
type ChangeDirection = 'upgrade' | 'downgrade';

/** Step discriminator for the flow. */
type FlowStep = 'picker' | 'keep' | 'scheduled';

/** Props for {@link CommercePlanChange}. */
export interface CommercePlanChangeProps {
    /** Which vertical this subscription belongs to. */
    readonly vertical: CommerceVertical;
    /** Slug of the owner's current tier for this vertical. */
    readonly currentPlanSlug: string;
    /** Display name of the current tier (rendered next to the CTA). */
    readonly currentPlanName: string;
    /** Every active tier of the vertical (unfiltered — this component filters). */
    readonly plans: readonly CommercePlanOption[];
    /**
     * End of the period the owner has already paid for, ISO 8601, or `null`
     * when unknown (HOS-1122). A downgrade takes effect then; when it is
     * absent the copy says so in words rather than inventing a date.
     */
    readonly currentPeriodEnd?: string | null;
    /** Active locale for translations and price formatting. */
    readonly locale: SupportedLocale;
}

/**
 * CommercePlanChange — "cambiar de plan" CTA + tier-change flow for an
 * existing commerce subscription.
 *
 * @param props - {@link CommercePlanChangeProps}.
 */
export function CommercePlanChange({
    vertical,
    currentPlanSlug,
    currentPlanName,
    plans,
    currentPeriodEnd = null,
    locale
}: CommercePlanChangeProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [step, setStep] = useState<FlowStep>('picker');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pendingSlug, setPendingSlug] = useState<string | null>(null);
    const [preview, setPreview] = useState<CommerceDowngradePreview | null>(null);
    const [scheduledFor, setScheduledFor] = useState<string | null>(null);

    const currentPlan = plans.find((plan) => plan.slug === currentPlanSlug);

    // Split on PRICE, not on `sortOrder`, because price is the exact predicate
    // the API decides by: `change-plan.ts` charges for a dearer target,
    // schedules a cheaper one, and 422s only on an equal one. The two agree in
    // today's catalogue, which is precisely why picking the wrong one would go
    // unnoticed — a future tier that sorts later but is not dearer would be
    // offered as an upgrade here and scheduled as a downgrade there.
    const changeOptions = currentPlan
        ? plans.filter((plan) => plan.monthlyPriceArs !== currentPlan.monthlyPriceArs)
        : [];

    /**
     * Which direction a slug moves in. Reads the same `monthlyPriceArs` the
     * filter above does, so the note a card shows and the branch taken on
     * confirm can never disagree.
     */
    function directionOf(planSlug: string): ChangeDirection {
        const target = plans.find((plan) => plan.slug === planSlug);
        return target && currentPlan && target.monthlyPriceArs < currentPlan.monthlyPriceArs
            ? 'downgrade'
            : 'upgrade';
    }

    const effectiveDateLabel =
        currentPeriodEnd === null ? null : formatDate({ date: currentPeriodEnd, locale });

    // Nothing to move to — degrade to no CTA at all (single-tier verticals, or
    // a catalogue where every other tier costs the same). Matches the checkout
    // picker's own safe degradation with 0/1 available plans.
    if (changeOptions.length === 0) {
        return null;
    }

    /** The per-card copy: what choosing this tier actually does. */
    const planNotes: Record<string, string> = {};
    for (const plan of changeOptions) {
        planNotes[plan.slug] =
            directionOf(plan.slug) === 'downgrade'
                ? effectiveDateLabel === null
                    ? t(
                          'commerce.owner.planChange.note.downgradeNoDate',
                          'Sin cargo. Empieza a regir al final del período que ya pagaste.'
                      )
                    : t(
                          'commerce.owner.planChange.note.downgrade',
                          'Sin cargo. Empieza a regir el {date}.'
                      ).replace('{date}', effectiveDateLabel)
                : t(
                      'commerce.owner.planChange.note.upgrade',
                      'Pagás la diferencia proporcional ahora y empieza a regir enseguida.'
                  );
    }

    function closeFlow(): void {
        setIsPickerOpen(false);
        setStep('picker');
        setPendingSlug(null);
        setPreview(null);
        setScheduledFor(null);
        setErrorMessage(null);
    }

    /**
     * Maps an API failure onto the owner-facing copy for its status.
     *
     * `scope` matters because the two endpoints in this flow answer 422 for
     * DIFFERENT reasons, and the copy for one is a lie about the other. On
     * change-plan it means "that tier costs the same as yours"; on the preview
     * it means "the target tier's listing cap could not be resolved". The route
     * raises that second 422 rather than returning an empty preview precisely
     * so nobody reads it as "nothing is at stake" — rendering it as a
     * same-price message would put the lie back one layer up.
     */
    function showApiError(status: number | undefined, scope: 'preview' | 'change'): void {
        const generic = t(
            'commerce.owner.planChange.error.generic',
            'No pudimos cambiar tu plan. Probá de nuevo más tarde.'
        );
        if (status === undefined) {
            setErrorMessage(generic);
            return;
        }
        if (scope === 'preview' && status === 422) {
            setErrorMessage(
                t(
                    'commerce.owner.planChange.error.previewUnavailable',
                    'No pudimos calcular qué fichas quedarían fuera de ese plan. Probá de nuevo más tarde.'
                )
            );
            return;
        }
        setErrorMessage(t(`commerce.owner.planChange.error.${status}`, generic));
    }

    /** Step 1 → 2, or straight to the POST when there is nothing to choose. */
    async function handlePick(planSlug: string): Promise<void> {
        setErrorMessage(null);

        if (directionOf(planSlug) === 'upgrade') {
            await submit(planSlug, undefined);
            return;
        }

        setIsSubmitting(true);
        setPendingSlug(planSlug);
        try {
            const result = await fetchCommerceDowngradePreview({ vertical, planSlug });

            if (!result.ok) {
                // Including the 422 the preview raises when the target tier's
                // cap is unresolvable. Falling through to "nothing is over the
                // cap" here would restrict the owner's listings by the default
                // order having told them nothing was at stake.
                showApiError(result.error.status, 'preview');
                return;
            }

            if (!result.data.hasExcess) {
                // The cheaper tier still covers everything — nothing to choose.
                await submit(planSlug, undefined);
                return;
            }

            setPreview(result.data);
            setStep('keep');
        } catch {
            showApiError(undefined, 'preview');
        } finally {
            setIsSubmitting(false);
        }
    }

    /** Step 2 → POST, carrying the owner's selection. */
    async function handleKeepConfirm(keepSelections: CommerceKeepSelections): Promise<void> {
        if (pendingSlug === null) {
            return;
        }
        await submit(pendingSlug, keepSelections);
    }

    async function submit(
        planSlug: string,
        keepSelections: CommerceKeepSelections | undefined
    ): Promise<void> {
        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const result = await changeCommercePlan({ vertical, planSlug, keepSelections });

            if (!result.ok) {
                showApiError(result.error.status, 'change');
                return;
            }

            if (result.data.status === 'pending_payment') {
                storePendingCheckoutSubId(result.data.localSubscriptionId);
                window.location.href = result.data.checkoutUrl;
                return;
            }

            if (result.data.status === 'scheduled') {
                // NOT a reload: nothing has changed yet, and reloading would
                // show the owner their unchanged current plan as though the
                // request had been dropped.
                setScheduledFor(result.data.effectiveAt);
                setStep('scheduled');
                return;
            }

            // `active` — applied at once (the subscription was trialing), no
            // charge. Reload so the page re-fetches the new current plan.
            window.location.reload();
        } catch {
            showApiError(undefined, 'change');
        } finally {
            setIsSubmitting(false);
        }
    }

    const targetPlanName =
        plans.find((plan) => plan.slug === pendingSlug)?.name ?? pendingSlug ?? '';

    return (
        <div className={styles.summary}>
            <span className={styles.currentPlan}>
                {t('commerce.owner.planChange.currentLabel', 'Plan actual')}
                {': '}
                <strong>{currentPlanName}</strong>
            </span>
            <button
                type="button"
                className={styles.changeCta}
                onClick={() => {
                    setErrorMessage(null);
                    setStep('picker');
                    setIsPickerOpen(true);
                }}
            >
                {t('commerce.owner.planChange.cta', 'Cambiar de plan')}
            </button>

            <Dialog
                isOpen={isPickerOpen}
                onClose={closeFlow}
                ariaLabel={t('commerce.owner.planPicker.title', 'Elegí tu plan')}
                size="md"
            >
                {errorMessage && (
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {errorMessage}
                    </p>
                )}

                {step === 'picker' && (
                    <CommercePlanPicker
                        plans={changeOptions}
                        planNotes={planNotes}
                        locale={locale}
                        isPending={isSubmitting}
                        onConfirm={(planSlug) => void handlePick(planSlug)}
                        onCancel={closeFlow}
                    />
                )}

                {step === 'keep' && preview !== null && (
                    <CommerceDowngradeKeepPanel
                        preview={preview}
                        targetPlanName={targetPlanName}
                        effectiveDateLabel={effectiveDateLabel}
                        locale={locale}
                        isPending={isSubmitting}
                        onConfirm={(keepSelections) => void handleKeepConfirm(keepSelections)}
                        onBack={() => {
                            setStep('picker');
                            setPreview(null);
                            setPendingSlug(null);
                        }}
                    />
                )}

                {step === 'scheduled' && scheduledFor !== null && (
                    <div className={styles.scheduled}>
                        <h2 className={styles.scheduledTitle}>
                            {t('commerce.owner.planChange.scheduled.title', 'Cambio programado')}
                        </h2>
                        <p className={styles.scheduledBody}>
                            {t(
                                'commerce.owner.planChange.scheduled.body',
                                'Tu plan pasa a {plan} el {date}. Hasta entonces no cambia nada: seguís con {current} y todas tus fichas visibles.'
                            )
                                .replace('{plan}', targetPlanName)
                                .replace('{date}', formatDate({ date: scheduledFor, locale }))
                                .replace('{current}', currentPlanName)}
                        </p>
                        <button
                            type="button"
                            className={styles.scheduledClose}
                            onClick={closeFlow}
                        >
                            {t('common.close', 'Cerrar')}
                        </button>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
