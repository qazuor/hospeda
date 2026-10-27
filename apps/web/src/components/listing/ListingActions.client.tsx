/**
 * @file ListingActions.client.tsx
 * @description Per-listing state badge + checklist island for the
 * `mi-cuenta/comercio` owner index (HOS-166 §8 points 4/5/6).
 *
 * Renders the listing-card state machine (`resolveListingCardState`): nothing
 * at all for a `PURGED` listing (HOS-1641, Coord-351 F4), the
 * published badge with the public-page link, the brochure and QR downloads
 * (and the certificate for an experience), or, for a draft, the checklist of
 * what is still missing.
 *
 * A complete DRAFT may mount the shared publish action when the server-derived
 * affordance allows it; all other card states keep their existing actions.
 *
 * Hydration: `client:visible` — this sits inside a listing card in a list,
 * not above-the-fold interactive chrome.
 */

import type { JSX } from 'react';
import { ExperienceCertificatePanel } from '@/components/experience/ExperienceCertificatePanel.client';
import { PublishButton } from '@/components/host/PublishButton.client';
import { ListingQrSheet } from '@/components/shared/qr/ListingQrSheet.client';
import type { PublishVerticalSlug } from '@/lib/api/endpoints-protected';
import { resolvePropertyCardActions } from '@/lib/host/property-card-actions';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ListingCardState } from '@/lib/listing/listing-card-state';
import { resolveListingCardState } from '@/lib/listing/listing-card-state';
import {
    MISSING_FIELD_FALLBACK_LABEL,
    MISSING_FIELD_I18N_SUFFIX
} from '@/lib/listing/missing-field-labels';
import type { OwnerListingSummaryWithState } from '@/lib/listing/owner-listings';
import { type PublishAffordance, UNKNOWN_PUBLISH_AFFORDANCE } from '@/lib/publish/subscribe-button';
import { buildUrl } from '@/lib/urls';
import { BrochureDownloadButton } from './BrochureDownloadButton.client';
import styles from './ListingActions.module.css';

export interface ListingActionsProps {
    /** The listing summary + completeness preview to render actions for. */
    readonly listing: OwnerListingSummaryWithState;
    /** Active locale for translations and URL construction. */
    readonly locale: SupportedLocale;
    /** Server-derived publish decision; missing data fails closed. */
    readonly publishAffordance?: PublishAffordance;
}

/** Public detail path segment per vertical (mirrors the `[slug].astro` routes). */
const PUBLIC_PATH_BY_VERTICAL: Record<OwnerListingSummaryWithState['vertical'], string> = {
    venue: 'gastronomia',
    experience: 'experiencias'
};

const PUBLISH_CONFIRM_TITLE_KEY: Readonly<Record<PublishVerticalSlug, string>> = {
    accommodation: 'host.properties.card.actions.publishConfirmTitle',
    venue: 'listing.owner.publish.confirmTitle.gastronomy',
    experience: 'listing.owner.publish.confirmTitle.experience'
};

const PUBLISH_CHOOSE_PLAN_KEY: Readonly<Record<PublishVerticalSlug, string>> = {
    accommodation: 'host.properties.card.actions.choosePlan',
    venue: 'listing.owner.publish.choosePlan.gastronomy',
    experience: 'listing.owner.publish.choosePlan.experience'
};

/**
 * ListingActions — renders the right badge/checklist for a single
 * owner-listing card, driven by `resolveListingCardState`.
 */
export function ListingActions({
    listing,
    locale,
    publishAffordance = UNKNOWN_PUBLISH_AFFORDANCE
}: ListingActionsProps): JSX.Element | null {
    const { t, tPlural } = createTranslations(locale);

    const state: ListingCardState = resolveListingCardState({
        publicationStatus: listing.publicationStatus,
        isPublic: listing.isPublic,
        completeness: listing.completeness
    });

    // A purged listing offers no action, not even a badge: the HOS-1492
    // row-20 notice rendered next to this island is what tells the owner.
    if (state.kind === 'purged') {
        return null;
    }

    if (state.kind === 'published') {
        const publicUrl = buildUrl({
            locale,
            path: `${PUBLIC_PATH_BY_VERTICAL[listing.vertical]}/${listing.slug}`
        });
        return (
            <div className={styles.actions}>
                <span className={`${styles.badge} ${styles.badgePublished}`}>
                    {t('listing.owner.list.state.published', 'Publicado')}
                </span>
                <a
                    className={styles.link}
                    href={publicUrl}
                >
                    {t('listing.owner.list.state.viewPublic', 'Ver ficha pública')}
                </a>
                {/*
                 * HOS-1058. Only in the `published` state, and that is not a
                 * styling choice: the sheet is a print of the PUBLIC ficha, so
                 * a draft has nothing to print and its QR would lead to a 404.
                 * The API enforces the same rule; this just avoids offering a
                 * button that could only ever answer 404.
                 */}
                <BrochureDownloadButton
                    vertical={listing.vertical}
                    listingId={listing.id}
                    slug={listing.slug}
                    locale={locale}
                />
                {/*
                 * HOS-982. Sibling of the brochure and NOT the same document: the
                 * brochure is handed to a person and carries the photo, the hours
                 * and the contact block; this is a code taped to a door, meant to
                 * be scanned from across a room. It also has NO entitlement gate
                 * (owner decision) — a QR on a door brings people to the platform,
                 * so restricting it would cost us rather than the subscriber.
                 *
                 * `isPublished` is `hasPublicPage` and NOT `isPublic`, even though
                 * this branch only renders when `isPublic` is true. Since HOS-1641
                 * both are `publicationStatus === PUBLISHED`; before it they were
                 * derived from separate old columns, and a staff PATCH that left
                 * one standing produced a row where the two disagreed. Passing
                 * `isPublic` here then put three contradictory
                 * sentences on one card for that row — the panel mounted, asked for
                 * the code, got the anti-enumeration 404, said "we could not show
                 * the code but you can download the sheet anyway", and the download
                 * then said "check that your listing is still published". None of
                 * the three was actionable.
                 *
                 * Absent (an older API answer) is treated as NOT published rather
                 * than falling back to `isPublic`, which would restore exactly that.
                 */}
                <ListingQrSheet
                    vertical={listing.vertical}
                    listingId={listing.id}
                    slug={listing.slug}
                    locale={locale}
                    isPublished={listing.hasPublicPage ?? false}
                />
                {/*
                 * HOS-1057. Experiences only — a restaurant has nothing to
                 * certify — and only in the `published` state, for the same
                 * reason as the brochure above: the certificate carries a QR
                 * back to the PUBLIC ficha, so a draft would print a permanent
                 * 404 onto a piece of paper somebody keeps. The API enforces
                 * that rule on the PDF route itself; this only avoids offering a
                 * panel whose download could not work.
                 */}
                {listing.vertical === 'experience' && (
                    <ExperienceCertificatePanel
                        listingId={listing.id}
                        locale={locale}
                    />
                )}
            </div>
        );
    }

    if (state.kind === 'unknown') {
        return (
            <div className={styles.actions}>
                <span className={styles.badge}>
                    {t('listing.owner.list.state.unknown', 'Estado no disponible')}
                </span>
            </div>
        );
    }

    // draft-incomplete | draft-complete — the checklist is always rendered for an
    // incomplete draft (HOS-166 §8 point 4).
    const missing = state.kind === 'draft-incomplete' ? state.missing : [];
    const isComplete = state.kind === 'draft-complete';
    const cardActions = resolvePropertyCardActions({
        publicationStatus: listing.publicationStatus
    });

    return (
        <div className={styles.actions}>
            <span className={`${styles.badge} ${styles.badgeDraft}`}>
                {isComplete
                    ? t('listing.owner.list.state.draftComplete', 'Borrador — listo para publicar')
                    : t('listing.owner.list.state.draftIncomplete', 'Borrador — incompleto')}
            </span>

            {isComplete && cardActions.publish && (
                <PublishButton
                    listingId={listing.id}
                    vertical={listing.vertical}
                    locale={locale}
                    label={t('host.properties.card.actions.publish', 'Publicar')}
                    confirmTitle={t(PUBLISH_CONFIRM_TITLE_KEY[listing.vertical])}
                    confirmNote={t(
                        'host.properties.card.actions.publishConfirmNote',
                        'Va a aparecer en el sitio, visible para los turistas.'
                    )}
                    confirmTrialNote={tPlural(
                        'host.properties.card.actions.publishConfirmTrialNote',
                        publishAffordance.trialDays ?? 0,
                        { trialDays: publishAffordance.trialDays ?? 0 }
                    )}
                    confirmYes={t('host.properties.card.actions.publishYes', 'Sí, publicar')}
                    confirmNo={t('host.properties.card.actions.confirmNo', 'Cancelar')}
                    errorText={t(
                        'host.properties.card.publishError',
                        'No se pudo publicar. Intentá de nuevo.'
                    )}
                    subscriptionRequiredMessage={t(
                        'host.properties.card.publishSubscriptionRequiredMessage',
                        'Necesitás un plan activo para publicar.'
                    )}
                    subscriptionRequiredCta={t(
                        'host.properties.card.publishSubscriptionRequiredCta',
                        'Ver planes'
                    )}
                    missingRequirementsMessage={t(
                        'listing.owner.publish.missingRequirements',
                        'No se pudo publicar porque faltan datos.'
                    )}
                    missingRequirementsCta={t(
                        'host.properties.card.publishMissingRequirementsCta',
                        'Completar en el editor'
                    )}
                    affordance={publishAffordance}
                    checkFailedText={t('host.properties.card.publishCheckFailed')}
                    choosePlanLabel={t(PUBLISH_CHOOSE_PLAN_KEY[listing.vertical])}
                />
            )}

            {missing.length > 0 && (
                <ul
                    className={styles.checklist}
                    data-testid="listing-checklist"
                >
                    {missing.map((field) => (
                        <li key={field}>
                            {t(
                                `listing.owner.checklist.field.${MISSING_FIELD_I18N_SUFFIX[field] ?? field}`,
                                MISSING_FIELD_FALLBACK_LABEL[field] ?? field
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
