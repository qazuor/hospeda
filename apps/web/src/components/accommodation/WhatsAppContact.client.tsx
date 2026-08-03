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
 *   3. `number` + not `direct` (tourist-plus+ / owner-basico+) → the number as
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

import { useEffect, useState } from 'react';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { protectedAccommodationsApi } from '@/lib/api/endpoints-protected';
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

export interface WhatsAppContactProps {
    /** Accommodation whose host WhatsApp is being requested. */
    readonly accommodationId: string;
    /** Accommodation name, used in the prefilled WhatsApp message. */
    readonly accommodationName: string;
    /** Locale-aware href to the plans page (upsell CTA target). */
    readonly plansHref: string;
    readonly locale: SupportedLocale;
}

/** The WhatsApp glyph. Brand mark, not a UI icon — hence not from @repo/icons. */
function WhatsAppGlyph({ size }: { readonly size: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            width={size}
            height={size}
            aria-hidden="true"
            focusable="false"
        >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
    );
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
    locale
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
        <section className={styles.root}>
            <h3 className={styles.title}>{title}</h3>

            {viewer.showUpsell ? (
                <div className={styles.upsell}>
                    <p className={styles.upsellText}>
                        {t(
                            'accommodations.detail.whatsapp.upsellText',
                            'Suscribite a Plus para ver el WhatsApp del anfitrión.'
                        )}
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
                >
                    <WhatsAppGlyph size={20} />
                    <span>{ctaLabel}</span>
                </a>
            ) : (
                <p className={styles.number}>
                    <WhatsAppGlyph size={18} />
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
