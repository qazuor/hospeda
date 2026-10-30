/**
 * @file VenueMenuPlanNotice.client.tsx
 * @description The reason the venue menu panel's controls are disabled, shown
 * when the owner does not hold `manage_venue_menu` (owner decision,
 * 2026-10-29).
 *
 * Two wordings, one per {@link ListingPlanGate} lock:
 *
 * - `preTrial`: the owner has never started the vertical's trial. Publishing
 *   the listing starts it, and the trial grants the top tier, so "it unlocks
 *   when you publish" is literally what happens.
 * - `plan`: no trial is available, so only Profesional (or above) unlocks it,
 *   and the notice links to the vertical's plans page.
 *
 * The parent points `aria-describedby` of every disabled control at this
 * notice's `id`, so a screen reader hears WHY the control is disabled.
 *
 * @module components/venue/VenueMenuPlanNotice
 */

import { LockIcon } from '@repo/icons';
import type { JSX } from 'react';
import type { ListingPlanGate } from '@/hooks/useListingPlanGate';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './VenueMenuManager.module.css';

/** Props for {@link VenueMenuPlanNotice}. */
export interface VenueMenuPlanNoticeProps {
    /** DOM id the disabled controls reference through `aria-describedby`. */
    readonly id: string;
    /** Why the menu is locked. */
    readonly gate: Exclude<ListingPlanGate, 'open'>;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
}

/**
 * Renders the locked-menu reason, plus a link to the plans page when only a
 * plan change can unlock it.
 */
export function VenueMenuPlanNotice({ id, gate, locale }: VenueMenuPlanNoticeProps): JSX.Element {
    const { t } = createTranslations(locale);

    const textByGate: Readonly<Record<VenueMenuPlanNoticeProps['gate'], () => string>> = {
        preTrial: () =>
            t(
                'venue.owner.editor.menuManager.lockedPreTrial',
                'La carta se habilita cuando publiques tu ficha: desde ese momento vas a poder cargar los platos o subir una foto o un PDF del menú.'
            ),
        plan: () =>
            t(
                'venue.owner.editor.menuManager.locked',
                'Cargar la carta y subir una foto o un PDF del menú está disponible desde el plan Profesional.'
            )
    };
    const showPlansLink: Readonly<Record<VenueMenuPlanNoticeProps['gate'], boolean>> = {
        preTrial: false,
        plan: true
    };

    return (
        <div
            id={id}
            className={styles.planNotice}
            role="status"
            data-testid="venue-menu-plan-notice"
        >
            <LockIcon
                size={16}
                className={styles.planNoticeIcon}
                aria-hidden="true"
            />
            <p className={styles.planNoticeText}>
                {textByGate[gate]()}
                {showPlansLink[gate] ? (
                    <>
                        {' '}
                        <a
                            className={styles.fileLink}
                            href={buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.venue })}
                        >
                            {t('venue.owner.editor.menuManager.seePlans', 'Ver planes')}
                        </a>
                    </>
                ) : null}
            </p>
        </div>
    );
}
