/**
 * @file PublishButton.client.tsx
 * @description React island that renders a "Publicar" primary button with an
 * inline confirmation step.
 *
 * Flow:
 *  1. Idle  → shows the "Publicar" button.
 *  2. Click → swaps to inline confirmation with "[Sí, publicar] [Cancelar]".
 *  3. Confirm (Sí) → calls POST /api/v1/protected/accommodations/:id/publish,
 *                    disables UI while pending. A dedicated `/publish`
 *                    endpoint is used instead of the generic update PATCH
 *                    because the update schema strips `lifecycleState`,
 *                    which made the naive approach a silent no-op.
 *  4. Success → reloads the page via window.location.reload() so the card
 *               re-renders with the new ACTIVE status.
 *  5. Error   → shows inline error message, re-enables the button. Two
 *               failures get a dedicated banner instead, because retrying
 *               them changes nothing: `403 subscription_required` (no active
 *               plan — links to the plans page) and `400 VALIDATION_ERROR`
 *               (the publish-completeness gate — links to the editor and
 *               names the fields the server reported).
 *  6. No (cancel) → returns to step 1.
 *
 * ## When the server would refuse, there is no step 1 at all (H-99)
 *
 * When `affordance.canPublish` is false the button is never rendered: the plan
 * link takes its place (or the no-plans notice, or the check-failed status). Publishing used to be offered with the same prominence as Edit and
 * Delete to an owner with no subscription at all, opening a dialog that promised
 * "va a aparecer en el sitio, visible para los turistas" — something that could
 * not happen — and failing only on confirm. Worse, the failure cited missing
 * bathrooms rather than the missing plan, because the server checked
 * completeness first. Both halves are fixed: the guard order flipped
 * server-side, and this button no longer offers what it cannot deliver.
 *
 * ## The rejection names real fields (H-94)
 *
 * The completeness branch used to map ANY 400 onto one fixed sentence naming
 * capacity, guests and bathrooms — its own comment admitted treating "cualquier
 * otro 400 como capacidad incompleta". In production that told a host their
 * guests and bedrooms were missing while the form showed 11 and 3, and never
 * mentioned bathrooms, the one field actually absent. The fields now come from
 * the server's `reason`, resolved through the same shared requirement list the
 * gate rejects from.
 *
 * ## Publishing starts the trial again, and the button reads the verdict (HOS-1183)
 *
 * This has flipped twice. Originally publishing granted a no-card trial and the
 * confirm step announced it. HOS-171 (card-first) moved the trial onto the
 * MercadoPago preapproval the CHECKOUT creates, so publishing required an active
 * subscription, rejected without one, and every billing promise was stripped from
 * the confirm copy. HOS-1012 moved the trial back off MercadoPago — a local row
 * with `mp_subscription_id = NULL`, inserted in the same transaction as the
 * lifecycle flip — so publishing grants it once more.
 *
 * The server followed; this button did not, and that is the bug HOS-1183 fixed.
 * It gated on `hasActivePlan` (`entitlements.plan != null`), which is the
 * server's `has_active_sub` verdict alone, while the server publishes on
 * `first_publish` too. The two publishable verdicts collapsed into one `false`
 * and the button vanished for exactly the owner holding an intact trial.
 *
 * ## The affordance is the server's publish decision (HOS-1668)
 *
 * HOS-1183 fed this button from `GET /protected/accommodations/publish-eligibility`,
 * a second resolver that went down with the legacy billing system and answered
 * 500 while the page failed OPEN and showed "Publicar" anyway. The single
 * `affordance` prop now comes from `resolvePublishAffordance`, which maps
 * `GET /protected/publish/subscribe-destination/{vertical}` — the same predicate
 * PB1 and `listing-access` consult when they reject a publish. A failed read is
 * the `unknown` affordance: a status line, never a button (HOS-1668 C-2). The
 * trial line shows in the one branch where it is true (`affordance.startsTrial`).
 *
 * Mirrors UnpublishButton.client.tsx / DeleteButton.client.tsx (same
 * inline-confirm UX), but uses a positive (green) accent for the confirm
 * button instead of the danger red.
 *
 * @example
 * ```astro
 * <PublishButton
 *   client:load
 *   accommodationId={property.id}
 *   locale={locale}
 *   label={t('host.properties.card.actions.publish', 'Publicar')}
 *   confirmTitle={t('host.properties.card.actions.publishConfirmTitle', '...')}
 *   confirmNote={t('host.properties.card.actions.publishConfirmNote', '...')}
 *   confirmYes={t('host.properties.card.actions.publishYes', 'Sí, publicar')}
 *   confirmNo={t('host.properties.card.actions.confirmNo', 'Cancelar')}
 *   errorText={t('host.properties.card.publishError', '...')}
 *   subscriptionRequiredMessage={t('host.properties.card.publishSubscriptionRequiredMessage', '...')}
 *   subscriptionRequiredCta={t('host.properties.card.publishSubscriptionRequiredCta', 'Ver planes')}
 *   missingRequirementsMessage={t('host.properties.card.publishMissingRequirementsMessage', '...')}
 *   missingRequirementsCta={t('host.properties.card.publishMissingRequirementsCta', 'Completar en el editor')}
 *   affordance={publishAffordance}
 *   checkFailedText={t('host.properties.card.publishCheckFailed')}
 *   confirmTrialNote={tPlural('host.properties.card.actions.publishConfirmTrialNote', trialDays, { trialDays })}
 *   choosePlanLabel={t('host.properties.card.actions.choosePlan', 'Elegir plan de anfitrión')}
 * />
 * ```
 */

import {
    ACCOMMODATION_PUBLISH_REQUIREMENTS,
    type AccommodationPublishRequirementId,
    parsePublishRequirementsReason
} from '@repo/schemas';
import { type JSX, useState } from 'react';
import { PaidSignupsPausedNotice } from '@/components/billing/PaidSignupsPausedNotice';
import { accommodationEditApi } from '@/lib/api/endpoints-protected';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildSubscribeToPublishCopy } from '@/lib/listing/listing-notices';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { NO_PLANS_AVAILABLE_MESSAGE, type PublishAffordance } from '@/lib/publish/subscribe-button';
import { buildUrl } from '@/lib/urls';
import styles from './PublishButton.module.css';

/** Requirement id → its i18n label key, built once from the shared list. */
const REQUIREMENT_LABEL_KEYS: Readonly<Record<string, string>> = Object.fromEntries(
    ACCOMMODATION_PUBLISH_REQUIREMENTS.map((requirement) => [requirement.id, requirement.labelKey])
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** State machine for the publish button. */
type PublishState =
    | 'firstPublishPaused'
    | 'idle'
    | 'confirming'
    | 'pending'
    | 'error'
    | 'subscriptionRequired'
    | 'noPlans'
    | 'missingRequirements';

/**
 * Props for the PublishButton component.
 */
export interface PublishButtonProps {
    /** The accommodation ID to publish (DRAFT → ACTIVE). */
    readonly accommodationId: string;
    /** Current locale, used to build the plans-page link on `subscription_required`. */
    readonly locale: SupportedLocale;
    /** Label for the main primary button (already-translated string). */
    readonly label: string;
    /** Bold headline shown in the confirmation step (already-translated). */
    readonly confirmTitle: string;
    /** Trial-explainer note shown under the headline (already-translated). */
    readonly confirmNote: string;
    /** Label for the "Yes, publish" confirm button (already-translated). */
    readonly confirmYes: string;
    /** Label for the "Cancel" button (already-translated). */
    readonly confirmNo: string;
    /** Error message shown on generic API failure (already-translated). */
    readonly errorText: string;
    /**
     * Message for `403 subscription_required` (already-translated). Kept for
     * the callers' contract; since HOS-1492 that branch shows the row 21
     * "subscribe to publish" notice instead, the same as the `checkout`
     * affordance.
     */
    readonly subscriptionRequiredMessage: string;
    /** Label for the link to the plans page in that same case (already-translated). */
    readonly subscriptionRequiredCta: string;
    /**
     * Message shown when publish fails because the listing is missing
     * publish requirements. Takes a `{{fields}}` placeholder, which is filled
     * with the fields the SERVER said were missing (already-translated).
     *
     * It used to be a fixed sentence naming capacity, guests and bathrooms for
     * every 400 whatsoever, which in production told a host that guests and
     * bedrooms were missing from a form showing 11 and 3 (H-94).
     */
    readonly missingRequirementsMessage: string;
    /** Label for the link to the editor in that same case (already-translated). */
    readonly missingRequirementsCta: string;
    /**
     * What the server would do if this owner published right now, resolved by
     * `resolvePublishAffordance` from `subscribe-destination` (HOS-1668). When
     * `canPublish` is false the button does not offer to publish at all (H-99):
     * `checkout` offers the plan, `noPlans` the no-plans notice and `unknown`
     * (a failed read) the check-failed status line.
     *
     * Do NOT re-derive any of this here (no destination, plan-list or trial-day
     * comparisons). One side owns the rule, and it is the server.
     */
    readonly affordance: PublishAffordance;
    /**
     * Status line shown when the destination read failed (`affordance.kind ===
     * 'unknown'`), already-translated. Never the API's own error message.
     */
    readonly checkFailedText: string;
    /**
     * The trial line for the confirm step (already-translated, with the day
     * count interpolated). Rendered ONLY when `affordance.startsTrial` is true.
     *
     * It may say "sin tarjeta", because in that branch it is true: HOS-1012's
     * trial is a local row with no MercadoPago preapproval, and signup collects
     * no card. It must never appear in the `subscription_required` branch,
     * where the trial is already spent and a free-run promise would be a lie.
     */
    readonly confirmTrialNote: string;
    /** Label for the "choose a plan" action shown in place of Publish. */
    readonly choosePlanLabel: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PublishButton — guided publish action island for transitioning DRAFT → ACTIVE.
 *
 * Renders inline without an external CSS module leaking into PropertyCard's
 * scoped styles (this React island carries no `data-astro-*` hash), so its
 * own module mirrors the sibling `.prop-card__action` look.
 *
 * @param props - See `PublishButtonProps`.
 */
export function PublishButton({
    accommodationId,
    locale,
    label,
    confirmTitle,
    confirmNote,
    confirmYes,
    confirmNo,
    errorText,
    subscriptionRequiredMessage: _subscriptionRequiredMessage,
    subscriptionRequiredCta,
    missingRequirementsMessage,
    missingRequirementsCta,
    affordance,
    checkFailedText,
    confirmTrialNote,
    choosePlanLabel
}: PublishButtonProps): JSX.Element {
    const [state, setState] = useState<PublishState>('idle');
    const [apiError, setApiError] = useState<string | null>(null);
    const [missingRequirements, setMissingRequirements] = useState<
        readonly AccommodationPublishRequirementId[]
    >([]);
    const { t } = createTranslations(locale);
    /**
     * Row 21 (AC:V8a:4, HOS-1492): "subscribe to publish". Only the copy; it
     * shows where the affordance (`checkout`) or the server
     * (`subscription_required`) already said publishing needs a subscription.
     */
    const subscribeToPublish = buildSubscribeToPublishCopy({ t, vertical: 'accommodation' });

    /** User clicked the main "Publicar" button → enter confirmation mode. */
    function handleRequestConfirm(): void {
        setApiError(null);
        setState('confirming');
    }

    /** User clicked "No" / Cancel → return to idle. */
    function handleCancel(): void {
        setState('idle');
        setApiError(null);
    }

    /** User clicked "Sí, publicar" → call the API. */
    async function handleConfirm(): Promise<void> {
        setState('pending');
        setApiError(null);

        const result = await accommodationEditApi.publish({ id: accommodationId });

        if (!result.ok) {
            // The owner has no active subscription. Route them to the plans page
            // instead of a generic "try again" — retrying is pointless. Since
            // HOS-171 (publishing requires a card) this is the ordinary path for
            // a first publish, not just for someone who burnt their trial.
            if (result.error.status === 403 && result.error.message === 'subscription_required') {
                setState('subscriptionRequired');
                return;
            }
            if (
                result.error.status === 403 &&
                result.error.message === NO_PLANS_AVAILABLE_MESSAGE
            ) {
                setState('noPlans');
                return;
            }
            // Admin-paused signups reached the API (the page's verdict was
            // stale). The listing stays a draft; retrying cannot help.
            if (result.error.code === 'NEW_PAID_SIGNUPS_FROZEN') {
                setState('firstPublishPaused');
                return;
            }
            // The publish gate rejects with a 400 `VALIDATION_ERROR` and names
            // the fields it actually found missing in `reason`. Retrying without
            // fixing them fails identically, so the host goes to the editor
            // rather than a generic "try again".
            //
            // This branch used to set one fixed message —"Faltan datos de
            // capacidad (huéspedes, habitaciones o baños)"— for ANY 400, its own
            // comment admitting it treated "cualquier otro 400 como capacidad
            // incompleta". Measured in production that sentence named three
            // fields of which two were filled in, and never mentioned the one
            // that was actually missing (H-94).
            if (result.error.status === 400 && result.error.code === 'VALIDATION_ERROR') {
                setMissingRequirements(
                    parsePublishRequirementsReason({ reason: result.error.reason })
                );
                setState('missingRequirements');
                return;
            }
            setApiError(errorText);
            setState('error');
            return;
        }

        // Reload so the card re-renders with the new ACTIVE status.
        window.location.reload();
    }

    // ── The server would refuse ───────────────────────────────────────────
    // Offering "Publicar" here would open a dialog promising the listing goes
    // live, and then fail — and until the guard order was flipped it failed
    // citing bathrooms, never the plan (H-99).
    //
    // The branch survives HOS-1183; what changed is who it catches. It used to
    // fire on "no plan loaded", which swept up every owner with an intact
    // trial. It now fires only when the server itself would refuse. Deleting
    // the branch instead of narrowing it would bring H-99 straight back.
    // ── First publish paused (admin-frozen new signups) ──────────────────
    // Reactive only: the publish route answered `NEW_PAID_SIGNUPS_FROZEN`.
    // Checked BEFORE the plans link, which would lead to a paused checkout.
    if (state === 'firstPublishPaused') {
        return (
            <PaidSignupsPausedNotice
                locale={locale}
                variant="firstPublish"
                testId="publish-paused-notice"
            />
        );
    }

    // ── No plans (proactive from the destination, or reactive from the API) ──
    if (state === 'noPlans' || affordance.kind === 'noPlans') {
        return (
            <span
                className={styles.noPlans}
                role="alert"
                data-testid="publish-no-plans"
            >
                <strong>{t('publish.noPlans.title')}</strong>
                <span>{t('publish.noPlans.body')}</span>
            </span>
        );
    }

    // ── The destination read failed (HOS-1668 C-2) ───────────────────────
    // Fails CLOSED: neither "Publicar" nor "Elegir plan", only a status line.
    if (affordance.kind === 'unknown') {
        return (
            <span
                className={styles.checkFailed}
                role="status"
                data-testid="publish-check-failed"
            >
                {checkFailedText}
            </span>
        );
    }

    // Row 21: the listing stays unpublished and publishing needs a
    // subscription in this vertical. The plan link keeps its exact accessible
    // name ("Elegir plan de anfitrión").
    if (!affordance.canPublish) {
        return (
            <span
                className={styles.subscribeToPublish}
                data-testid="publish-subscribe-to-publish"
            >
                <strong>{subscribeToPublish.title}</strong>
                <span>{subscribeToPublish.body}</span>
                <a
                    href={buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.owner })}
                    className={`${styles.action} ${styles.primary}`}
                >
                    {choosePlanLabel}
                </a>
            </span>
        );
    }

    // ── Idle ──────────────────────────────────────────────────────────────
    if (state === 'idle' || state === 'error') {
        return (
            <span style={{ display: 'contents' }}>
                <button
                    type="button"
                    className={`${styles.action} ${styles.primary}`}
                    onClick={handleRequestConfirm}
                >
                    {label}
                </button>
                {state === 'error' && apiError && (
                    <span
                        role="alert"
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--destructive)',
                            width: '100%',
                            marginTop: '2px'
                        }}
                    >
                        {apiError}
                    </span>
                )}
            </span>
        );
    }

    // ── Subscription required ────────────────────────────────────────────
    // Publish failed because the owner has no active plan. Show a banner
    // pointing to the plans page instead of a retryable error.
    if (state === 'subscriptionRequired') {
        const plansUrl = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.owner });
        return (
            <span
                role="alert"
                className={styles.subscribeToPublish}
                data-testid="publish-subscribe-to-publish"
            >
                <strong>{subscribeToPublish.title}</strong>
                <span>{subscribeToPublish.body}</span>
                <a
                    href={plansUrl}
                    className={`${styles.action} ${styles.primary}`}
                >
                    {subscriptionRequiredCta}
                </a>
            </span>
        );
    }

    // ── Missing publish requirements (H-94) ──────────────────────────────
    // Publish failed on completeness. The banner points at the editor and names
    // the fields the SERVER reported, so the host is never sent to correct
    // something that is already filled in.
    if (state === 'missingRequirements') {
        const editUrl = buildUrl({
            locale,
            path: `mi-cuenta/propiedades/${accommodationId}/editar`
        });
        // Falls back to the generic sentence only when the server sent no
        // recognisable reason — an old API build, say. It is vague, but it
        // never claims a specific field is missing when it is not.
        const fieldList = missingRequirements
            .map((id) => t(REQUIREMENT_LABEL_KEYS[id] ?? id))
            .join(', ');
        const message =
            fieldList.length > 0
                ? missingRequirementsMessage.replace('{{fields}}', fieldList)
                : missingRequirementsMessage.replace('{{fields}}', '').trim();
        return (
            <span
                role="alert"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center',
                    width: '100%'
                }}
            >
                <span
                    style={{
                        fontSize: '0.8125rem',
                        color: 'var(--core-foreground)',
                        width: '100%'
                    }}
                >
                    {message}
                </span>
                <a
                    href={editUrl}
                    className={`${styles.action} ${styles.primary}`}
                >
                    {missingRequirementsCta}
                </a>
            </span>
        );
    }

    // ── Confirming ───────────────────────────────────────────────────────
    if (state === 'confirming') {
        return (
            <span
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center',
                    width: '100%'
                }}
            >
                <p className={styles.calloutTitle}>{confirmTitle}</p>
                <p className={styles.calloutNote}>{confirmNote}</p>
                {/*
                 * HOS-1183 D-2: publishing starts a 30-day clock by the owner's
                 * own action, so it says so. HOS-171 stripped every billing
                 * promise from this step because the trial had moved onto the
                 * MercadoPago preapproval and publishing granted nothing; HOS-1012
                 * moved it back, and the copy had not followed.
                 *
                 * Only in this branch. A paying owner sees the same two lines as
                 * before (byte-identical, AC-13), and an owner whose trial is
                 * spent never reaches the confirm step at all.
                 */}
                {affordance.startsTrial && <p className={styles.calloutNote}>{confirmTrialNote}</p>}
                <button
                    type="button"
                    className={`${styles.action} ${styles.primary}`}
                    onClick={handleConfirm}
                >
                    {confirmYes}
                </button>
                <button
                    type="button"
                    className={`${styles.action} ${styles.secondary}`}
                    onClick={handleCancel}
                >
                    {confirmNo}
                </button>
            </span>
        );
    }

    // ── Pending ───────────────────────────────────────────────────────────
    return (
        <button
            type="button"
            className={`${styles.action} ${styles.primary}`}
            disabled
            aria-busy="true"
        >
            {confirmYes}…
        </button>
    );
}
