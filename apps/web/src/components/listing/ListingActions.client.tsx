/**
 * @file ListingActions.client.tsx
 * @description Per-listing state badge + checklist island for the
 * `mi-cuenta/comercio` owner index (HOS-166 §8 points 4/5/6).
 *
 * Renders the listing-card state machine (`resolveListingCardState`): the
 * published badge with the public-page link, the brochure and QR downloads
 * (and the certificate for an experience), or, for a draft, the checklist of
 * what is still missing.
 *
 * There is no publish or payment control here: the owner self-checkout this
 * island used to start was removed with the old billing system, and nothing
 * replaces it yet. A complete draft therefore only reports that it is ready.
 *
 * Hydration: `client:visible` — this sits inside a listing card in a list,
 * not above-the-fold interactive chrome.
 */

import type { JSX } from 'react';
import { ExperienceCertificatePanel } from '@/components/experience/ExperienceCertificatePanel.client';
import { ListingQrSheet } from '@/components/shared/qr/ListingQrSheet.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ListingCardState } from '@/lib/listing/listing-card-state';
import { resolveListingCardState } from '@/lib/listing/listing-card-state';
import {
    MISSING_FIELD_FALLBACK_LABEL,
    MISSING_FIELD_I18N_SUFFIX
} from '@/lib/listing/missing-field-labels';
import type { OwnerListingSummaryWithState } from '@/lib/listing/owner-listings';
import { buildUrl } from '@/lib/urls';
import { BrochureDownloadButton } from './BrochureDownloadButton.client';
import styles from './ListingActions.module.css';

export interface ListingActionsProps {
    /** The listing summary + completeness preview to render actions for. */
    readonly listing: OwnerListingSummaryWithState;
    /** Active locale for translations and URL construction. */
    readonly locale: SupportedLocale;
}

/** Public detail path segment per vertical (mirrors the `[slug].astro` routes). */
const PUBLIC_PATH_BY_VERTICAL: Record<OwnerListingSummaryWithState['vertical'], string> = {
    gastronomy: 'gastronomia',
    experience: 'experiencias'
};

/**
 * ListingActions — renders the right badge/checklist for a single
 * owner-listing card, driven by `resolveListingCardState`.
 */
export function ListingActions({ listing, locale }: ListingActionsProps): JSX.Element {
    const { t } = createTranslations(locale);

    const state: ListingCardState = resolveListingCardState({
        isPublic: listing.isPublic,
        completeness: listing.completeness
    });

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
                 * this branch only renders when `isPublic` is true. They answer
                 * different questions: `isPublic` is visibility alone, while the
                 * API also requires `lifecycleState === ACTIVE`, and a staff PATCH
                 * to INACTIVE that leaves visibility standing produces a row where
                 * the two disagree. Passing `isPublic` here put three contradictory
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

    return (
        <div className={styles.actions}>
            <span className={`${styles.badge} ${styles.badgeDraft}`}>
                {isComplete
                    ? t('listing.owner.list.state.draftComplete', 'Borrador — listo para publicar')
                    : t('listing.owner.list.state.draftIncomplete', 'Borrador — incompleto')}
            </span>

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
