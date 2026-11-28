/**
 * @file PublishButton.client.tsx
 * @description Inline publish confirmation using the server-resolved
 * `subscribe-destination` affordance. Dispatch and vertical paths live in
 * `lib/publish/publish-listing.ts`; this component preserves the fail-closed
 * state order and only announces a trial when `affordance.startsTrial` is true.
 *
 * @example
 * ```astro
 * <PublishButton
 *   client:load
 *   listingId={property.id}
 *   vertical="accommodation"
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
    DUPLICATE_LOCATION_REASON,
    parsePublishRequirementsReason
} from '@repo/schemas';
import { type JSX, useEffect, useState } from 'react';
import { Button } from '@/components/account/ui/Button';
import { LinkButton } from '@/components/account/ui/LinkButton';
import { PaidSignupsPausedNotice } from '@/components/billing/PaidSignupsPausedNotice';
import { LocationExceptionRequestForm } from '@/components/listing/LocationExceptionRequestForm.client';
import type { PublishVerticalSlug } from '@/lib/api/endpoints-protected';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import {
    CAP_ADDON_CTA_KEY,
    type CapAddonOffer,
    capAddonHref,
    findCapAddonOffer
} from '@/lib/billing/addon-cap-offer';
import { getAddonName } from '@/lib/billing/addon-purchase';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildSubscribeToPublishCopy } from '@/lib/listing/listing-notices';
import { announceListingQrPageOnce, type ListingQrNotice } from '@/lib/listing/listing-qr-page';
import {
    publishListing,
    resolvePublishEditorPath,
    resolvePublishPricingPath
} from '@/lib/publish/publish-listing';
import { buildVerticalSubscriptionUrl } from '@/lib/publish/publish-page-paths';
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
    | 'limitReached'
    | 'missingRequirements';

/**
 * Props for the PublishButton component.
 */
export interface PublishButtonProps {
    /** Listing identifier. */
    readonly listingId: string;
    /** Listing vertical. */
    readonly vertical: PublishVerticalSlug;
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
    /**
     * The one-time "your QR is ready" notice (HOS-2688), already translated.
     * Pass it ONLY for a first publish (a draft's «Publicar», never «Publicar
     * de nuevo»). On success it is queued as a toast for the page the reload
     * lands on, once per listing (`announceListingQrPageOnce`).
     */
    readonly qrNotice?: ListingQrNotice;
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
    listingId,
    vertical,
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
    choosePlanLabel,
    qrNotice
}: PublishButtonProps): JSX.Element {
    const [state, setState] = useState<PublishState>('idle');
    const [apiError, setApiError] = useState<string | null>(null);
    /** HOS-2192: the last publish was refused with `DUPLICATE_LOCATION`, so an exception can be requested. */
    const [duplicateLocation, setDuplicateLocation] = useState(false);
    const [exceptionFormOpen, setExceptionFormOpen] = useState(false);
    const [missingRequirements, setMissingRequirements] = useState<
        readonly AccommodationPublishRequirementId[]
    >([]);
    /** HOS-2632: the catalog add-on that widens the cap, read once the cap is hit. */
    const [capAddon, setCapAddon] = useState<CapAddonOffer | null>(null);
    const { t } = createTranslations(locale);
    useEffect(() => {
        if (state !== 'limitReached') return;
        let alive = true;
        void billingAddonApi
            .offers()
            .then((result) => {
                if (alive && result.ok) {
                    setCapAddon(findCapAddonOffer({ offers: result.data.items, vertical }));
                }
            })
            .catch(() => {
                // The plan change stays as the only way out.
            });
        return () => {
            alive = false;
        };
    }, [state, vertical]);
    /**
     * Row 21 (AC:V8a:4, HOS-1492): "subscribe to publish". Only the copy; it
     * shows where the affordance (`checkout`) or the server
     * (`subscription_required`) already said publishing needs a subscription.
     */
    const subscribeToPublish = buildSubscribeToPublishCopy({ t, vertical });

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
        setDuplicateLocation(false);

        const result = await publishListing({ vertical, id: listingId });

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
            // The plan's publishing cap is full (HOS-1977 review). The API answers
            // 403 with `error.code === 'LIMIT_REACHED'` (`mapListingPublishDenial`).
            // Retrying cannot help: the host must free a slot or upgrade.
            if (result.error.status === 403 && result.error.code === 'LIMIT_REACHED') {
                setState('limitReached');
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
            // HOS-1810: another PUBLISHED listing of this owner already holds the
            // address (409 `DUPLICATE_LOCATION`). Retrying cannot help: the owner
            // adds the missing category to the existing listing instead.
            if (result.error.status === 409 && result.error.reason === DUPLICATE_LOCATION_REASON) {
                setApiError(
                    t(
                        'listing.owner.locationDuplicate.blocked',
                        'Esta dirección ya tiene una ficha publicada tuya. Cada local físico va en una sola ficha: sumale el rubro que falta en vez de crear otra.'
                    )
                );
                // HOS-2192: offer "Pedir una excepción" (an experience has no address rule).
                setDuplicateLocation(vertical !== 'experience');
                setState('error');
                return;
            }
            setApiError(errorText);
            setState('error');
            return;
        }

        // HOS-2688: the first publish announces the listing's printable QR,
        // once per listing. Queued, because the reload below unmounts this.
        if (qrNotice) announceListingQrPageOnce({ listingId, notice: qrNotice });

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
                <LinkButton
                    href={buildUrl({ locale, path: resolvePublishPricingPath({ vertical }) })}
                >
                    {choosePlanLabel}
                </LinkButton>
            </span>
        );
    }

    // ── Idle ──────────────────────────────────────────────────────────────
    if (state === 'idle' || state === 'error') {
        return (
            <span style={{ display: 'contents' }}>
                <Button onClick={handleRequestConfirm}>{label}</Button>
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
                {state === 'error' && duplicateLocation && vertical !== 'experience' && (
                    <span
                        style={{ width: '100%', marginTop: '6px' }}
                        data-testid="publish-location-exception"
                    >
                        {exceptionFormOpen ? (
                            <LocationExceptionRequestForm
                                locale={locale}
                                vertical={vertical}
                                listingId={listingId}
                                onCancel={() => setExceptionFormOpen(false)}
                            />
                        ) : (
                            <Button
                                variant="secondary"
                                onClick={() => setExceptionFormOpen(true)}
                                data-testid="publish-location-exception-open"
                            >
                                {t(
                                    'listing.owner.locationException.requestButton',
                                    'Pedir una excepción'
                                )}
                            </Button>
                        )}
                    </span>
                )}
            </span>
        );
    }

    // ── Subscription required ────────────────────────────────────────────
    // Publish failed because the owner has no active plan. Show a banner
    // pointing to the plans page instead of a retryable error.
    if (state === 'subscriptionRequired') {
        const plansUrl = buildUrl({ locale, path: resolvePublishPricingPath({ vertical }) });
        return (
            <span
                role="alert"
                className={styles.subscribeToPublish}
                data-testid="publish-subscribe-to-publish"
            >
                <strong>{subscribeToPublish.title}</strong>
                <span>{subscribeToPublish.body}</span>
                <LinkButton href={plansUrl}>{subscriptionRequiredCta}</LinkButton>
            </span>
        );
    }

    // ── Plan cap reached (HOS-1977 review) ───────────────────────────────
    if (state === 'limitReached') {
        return (
            <span
                role="alert"
                className={styles.subscribeToPublish}
                data-testid="publish-limit-reached"
            >
                <span>{t('publish.limitReached.body')}</span>
                <LinkButton
                    href={buildUrl({ locale, path: resolvePublishPricingPath({ vertical }) })}
                >
                    {t('publish.limitReached.cta')}
                </LinkButton>
                {capAddon && (
                    <LinkButton
                        variant="secondary"
                        href={capAddonHref({
                            subscriptionUrl: buildVerticalSubscriptionUrl({ locale, vertical }),
                            vertical
                        })}
                        data-testid="publish-limit-reached-addon"
                    >
                        {t(CAP_ADDON_CTA_KEY, undefined, {
                            name: getAddonName({ offer: { ...capAddon, description: null }, t }),
                            price: formatPrice({
                                amount: capAddon.price / 100,
                                currency: capAddon.currency,
                                locale
                            })
                        })}
                    </LinkButton>
                )}
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
            path: resolvePublishEditorPath({ vertical, id: listingId })
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
                <LinkButton href={editUrl}>{missingRequirementsCta}</LinkButton>
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
                <Button onClick={handleConfirm}>{confirmYes}</Button>
                <Button
                    variant="secondary"
                    onClick={handleCancel}
                >
                    {confirmNo}
                </Button>
            </span>
        );
    }

    // ── Pending ───────────────────────────────────────────────────────────
    return (
        <Button
            disabled
            aria-busy="true"
        >
            {confirmYes}…
        </Button>
    );
}
