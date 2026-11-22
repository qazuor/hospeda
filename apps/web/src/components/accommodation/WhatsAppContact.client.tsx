/**
 * @file WhatsAppContact.client.tsx
 * @description Gated WhatsApp contact block for an accommodation detail page
 * (HOS-19).
 *
 * Renders one of three states, decided by the VIEWER's plan:
 *   1. upsell → a "subscribe to see WhatsApp" prompt (anonymous / free / any
 *      viewer without `CAN_CONTACT_WHATSAPP_DISPLAY`). No number is shown.
 *   2. `number` + `direct` (tourist-vip+ / owner-pro+) → a one-click `wa.me`
 *      deep link button.
 *   3. `number` + not `direct` (owner-basico+; the tourist-plus tier that used
 *      to be its entry point was retired by HOS-1224) → the number as
 *      selectable text (display only; no click-to-chat link).
 *
 * **Why this is an island** (HOS-369 WB0-7). This used to be a static Astro
 * component fed by an SSR lookup on the page. That put a specific viewer's
 * entitled phone number into the page HTML — and this page is edge-cacheable,
 * so that number would have been served to every subsequent visitor, entitled
 * or not, for the whole TTL. The lookup therefore moved into the browser: the
 * server renders the upsell (the anonymous variant, per D-11), and only a
 * viewer who passes the protected endpoint's own gate ever receives a number.
 *
 * The protected endpoint stays the authoritative gate — it never returns the
 * number to an unentitled caller — so nothing is re-checked here.
 */

import { WhatsappLogo } from '@repo/icons';
import { useEffect, useState } from 'react';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { WebEvents } from '@/lib/analytics/events';
import { UMAMI_BLOCK_PROPS } from '@/lib/analytics/recording-block';
import { trackEvent } from '@/lib/analytics/umami-client';
import { protectedAccommodationsApi } from '@/lib/api/endpoints-protected';
import { resolvePlanGateMessage } from '@/lib/billing/plan-name-list';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import styles from './WhatsAppContact.module.css';

/** The viewer-specific half of this block, resolved after hydration. */
interface WhatsAppViewerState {
    /** The number, or `null` when the viewer is not entitled to it. */
    readonly number: string | null;
    /** Whether the viewer may use the one-click `wa.me` deep link (VIP+). */
    readonly direct: boolean;
    /** Whether to render the subscribe upsell instead of a number. */
    readonly showUpsell: boolean;
}

/**
 * The anonymous variant: upsell, no number. This is what the server renders and
 * what the edge caches, and it is also the fail-closed answer for every error
 * path — an authenticated viewer never sees a blank block.
 */
const UPSELL_ONLY: WhatsAppViewerState = { number: null, direct: false, showUpsell: true };

/** Public listing context for the viewer-gated WhatsApp block. */
export interface WhatsAppContactProps {
    /** Accommodation whose host WhatsApp is being requested. */
    readonly accommodationId: string;
    /** Accommodation name, used in the prefilled WhatsApp message. */
    readonly accommodationName: string;
    /** Locale-aware href to the plans page (upsell CTA target). */
    readonly plansHref: string;
    readonly locale: SupportedLocale;
    readonly origin?: 'panel' | 'sidebar';
    /**
     * HOS-2554: catalog names of the plans that carry this feature, read server-side and
     * handed down (the catalog reader is server-only). Empty when it could not be read.
     */
    readonly gatePlanNames?: readonly string[];
}

/**
 * Viewer-gated WhatsApp contact block.
 *
 * Only mount this when the accommodation actually has a WhatsApp number
 * (`accommodation.hasWhatsapp`) — that flag is owner-derived and public, so it
 * lives on the shared-cached payload and is safe to branch on server-side.
 *
 * @param props - Accommodation context, plans-page href, and locale (RO-RO).
 */
export function WhatsAppContact({
    accommodationId,
    accommodationName,
    plansHref,
    locale,
    origin = 'sidebar',
    gatePlanNames = []
}: WhatsAppContactProps) {
    const { t } = createTranslations(locale);
    // Simple mode (no `initialUser`): `user` starts null, so the server and the
    // first paint render the upsell — the anonymous variant (HOS-369 D-11).
    const { user } = useAccountPermissions();
    const [viewer, setViewer] = useState<WhatsAppViewerState>(UPSELL_ONLY);

    useEffect(() => {
        // Anonymous visitor → upsell, never hit the protected endpoint.
        if (!user) {
            setViewer(UPSELL_ONLY);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const result = await protectedAccommodationsApi.getWhatsApp({
                    id: accommodationId
                });
                if (cancelled) return;
                if (!result.ok) {
                    // The API client resolves HTTP failures to `{ ok: false }`
                    // rather than throwing, so the catch below never fires for a
                    // transient 5xx / session desync. Fall back to the upsell
                    // (same intent as the catch) so an authenticated viewer
                    // never sees a blank block.
                    setViewer(UPSELL_ONLY);
                    return;
                }
                if (result.data.number) {
                    setViewer({
                        number: result.data.number,
                        direct: result.data.direct,
                        showUpsell: false
                    });
                    return;
                }
                if (!result.data.entitled) {
                    // Authenticated but not on a WhatsApp-display plan → upsell.
                    setViewer(UPSELL_ONLY);
                    return;
                }
                // Entitled but no number (rare owner-removed race) → render nothing.
                setViewer({ number: null, direct: false, showUpsell: false });
            } catch (err) {
                if (cancelled) return;
                // Graceful degradation: prefer the upsell over a blank block.
                setViewer(UPSELL_ONLY);
                webLogger.error('[WhatsAppContact] failed to fetch WhatsApp contact', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accommodationId, user]);

    // Nothing to render unless we have a number to show or an upsell to offer.
    if (!viewer.showUpsell && !viewer.number) return null;

    const title = t('accommodations.detail.whatsapp.title', 'Contacto por WhatsApp');
    const ctaLabel = t('accommodations.detail.whatsapp.cta', 'Consultar por WhatsApp');
    const numberLabel = t('accommodations.detail.whatsapp.numberLabel', 'WhatsApp del anfitrión');

    // --- wa.me deep link (direct tier only) ---
    // Built by the shared helper so the phone is sanitized the one way wa.me
    // accepts (bare digits, no leading '+') — see `@/lib/whatsapp`.
    let waUrl: string | null = null;
    if (viewer.number && viewer.direct) {
        const message = t(
            'accommodations.detail.whatsapp.messageTemplate',
            'Hola, me interesa obtener más información sobre {{name}}'
        ).replace('{{name}}', accommodationName);
        waUrl = buildWhatsAppLink({ phone: viewer.number, message }).url;
    }

    return (
        <section
            className={styles.root}
            {...UMAMI_BLOCK_PROPS}
        >
            <h3 className={styles.title}>{title}</h3>

            {viewer.showUpsell ? (
                <div className={styles.upsell}>
                    <p className={styles.upsellText}>
                        {resolvePlanGateMessage({
                            keyBase: 'accommodations.detail.whatsapp.upsellText',
                            locale,
                            noPlansFallback:
                                'Tu plan actual no incluye ver el WhatsApp del anfitrión.',
                            planNames: gatePlanNames,
                            t
                        })}
                    </p>
                    <a
                        className={styles.upsellCta}
                        href={plansHref}
                    >
                        {t('accommodations.detail.whatsapp.upsellCta', 'Ver planes')}
                    </a>
                </div>
            ) : waUrl ? (
                <a
                    href={waUrl}
                    className={styles.button}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ctaLabel}
                    onClick={() =>
                        trackEvent(WebEvents.ListingContactClicked, {
                            listing_id: accommodationId,
                            vertical: 'accommodation',
                            channel: 'whatsapp',
                            origin,
                            is_whatsapp_entitled: true,
                            locale
                        })
                    }
                >
                    <WhatsappLogo
                        size={20}
                        weight="fill"
                        aria-hidden="true"
                    />
                    <span>{ctaLabel}</span>
                </a>
            ) : (
                <p className={styles.number}>
                    <WhatsappLogo
                        size={18}
                        weight="fill"
                        aria-hidden="true"
                    />
                    {/* The label used to be an `aria-label` on this <p>. A <p>
                        has no ARIA role that supports one, so assistive tech was
                        free to ignore it — and it did not show up until this
                        component moved from .astro to .tsx, where biome lints
                        JSX a11y. A visually-hidden span announces the same
                        thing and cannot be dropped. */}
                    <span className="sr-only">{numberLabel}: </span>
                    <span>{viewer.number}</span>
                </p>
            )}
        </section>
    );
}
