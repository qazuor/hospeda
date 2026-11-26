/**
 * @file PhotoSectionDescription.client.tsx
 * @description The photo section's intro line (HOS-2495): one of five states read
 * from the listing's photo allowance — loading, limited (with the breakdown of
 * where the cap comes from), unlimited, no plan (HOS-2442), or a failed read.
 */

import type { ListingPhotoAllowance } from '@repo/schemas';
import type { ListingPhotoVertical } from '@/lib/api/listing-photo-api';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './PhotoSection.module.css';
import type { GalleryCapView } from './photo-cap-view';

type Contribution = NonNullable<ListingPhotoAllowance['breakdown']>['contributions'][number];

/** i18n key of each breakdown contribution kind, under `account.listingPhotos.breakdown`. */
const BREAKDOWN_KEY_BY_KIND = {
    PLAN: 'plan',
    TRIAL: 'trial',
    ADDON: 'addons',
    COURTESY: 'courtesy',
    PERMANENT_GRANT: 'permanentGrant',
    BASE: 'base',
    PRE_TRIAL_DRAFT: 'preTrialDraft'
} as const satisfies Record<Contribution['kind'], string>;

/** The pricing page audience of each listing vertical. */
const PRICING_AUDIENCE_BY_VERTICAL = {
    accommodation: 'owner',
    venue: 'venue',
    experience: 'experience'
} as const satisfies Record<ListingPhotoVertical, keyof typeof PRICING_PAGE_PATH_BY_AUDIENCE>;

/** Props for {@link PhotoSectionDescription}. */
export interface PhotoSectionDescriptionProps {
    readonly locale: SupportedLocale;
    readonly vertical: ListingPhotoVertical;
    /** The resolved cap state (`resolveGalleryCapView`). */
    readonly capView: GalleryCapView;
    /** The allowance breakdown; shown whenever the API returned one (limited or unlimited). */
    readonly breakdown: ListingPhotoAllowance['breakdown'];
}

/**
 * Renders the cap line. A failed read never claims the owner has no plan, and
 * the no-plan state never says "loading" (HOS-2442). The breakdown is printed
 * only when the API returned one: the API drops it whenever it does not add up
 * to the cap (AC-5), so this line never shows a sum that disagrees with it.
 */
export function PhotoSectionDescription({
    locale,
    vertical,
    capView,
    breakdown
}: PhotoSectionDescriptionProps) {
    const { t, tPlural } = createTranslations(locale);

    /**
     * The contributions line. LIMITED sums the finite ones to the cap; UNLIMITED
     * (a non-null breakdown still lists where the allowance comes from, AC-5)
     * names each source without a total and prints an unlimited one as words,
     * never as the sentinel number (AC-16).
     */
    const renderBreakdown = (cap: number | null) => {
        const contributions =
            cap === null
                ? breakdown?.contributions
                : breakdown?.contributions.filter((c) => c.value !== 'unlimited');
        if (!contributions || contributions.length === 0) return null;
        const parts = contributions
            .map((c) =>
                t(`account.listingPhotos.breakdown.${BREAKDOWN_KEY_BY_KIND[c.kind]}`, undefined, {
                    value:
                        c.value === 'unlimited'
                            ? t('account.listingPhotos.breakdown.unlimitedValue')
                            : c.value
                })
            )
            .join(' + ');
        return (
            <span
                className={styles.capBreakdown}
                data-testid="photo-cap-breakdown"
            >
                {cap === null
                    ? parts
                    : t('account.listingPhotos.breakdown.total', undefined, { parts, cap })}
            </span>
        );
    };

    return (
        <p
            className={styles.sectionDescription}
            aria-busy={capView.kind === 'loading'}
        >
            {capView.kind === 'limited' ? (
                <>
                    {tPlural(`account.listingPhotos.description.${vertical}`, capView.cap, {
                        cap: capView.cap
                    })}{' '}
                    {renderBreakdown(capView.cap)}
                </>
            ) : capView.kind === 'unlimited' ? (
                <>
                    {t('account.listingPhotos.unlimited', 'Sin límite de fotos')}{' '}
                    {renderBreakdown(null)}
                </>
            ) : capView.kind === 'loading' ? (
                t('account.listingPhotos.loading', 'Cargando tu límite de fotos…')
            ) : capView.kind === 'failed' ? (
                // A failed read says nothing about the plan: never claim there is none.
                t(
                    'account.listingPhotos.readFailed',
                    'No pudimos cargar tu límite de fotos. Probá recargar la página.'
                )
            ) : (
                <>
                    {t(`account.listingPhotos.noPlan.${vertical}`)}{' '}
                    <a
                        className={styles.plansLink}
                        href={buildUrl({
                            locale,
                            path: PRICING_PAGE_PATH_BY_AUDIENCE[
                                PRICING_AUDIENCE_BY_VERTICAL[vertical]
                            ]
                        })}
                    >
                        {t('account.listingPhotos.plansCta', 'Ver planes')}
                    </a>
                </>
            )}
        </p>
    );
}
