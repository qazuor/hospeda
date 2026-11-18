/**
 * @file VenueWhatsAppButton.client.tsx
 * @description WhatsApp button of a venue page (HOS-2256 section 7.8).
 *
 * The owner chooses, per listing, who sees it:
 * - `PUBLIC`: the number comes in the page payload and the `wa.me` link is
 *   rendered on the server. A scraper can read it; the owner editor says so.
 * - `LOGGED_IN_ONLY`: the number is NEVER in the page HTML (the page is
 *   session-blind and edge-cached). What the server renders is a "sign in"
 *   link; after hydration, a signed-in visitor's session asks the protected
 *   endpoint for the number and the button becomes the `wa.me` link.
 *
 * Anonymous visitors in `LOGGED_IN_ONLY` mode see the button and are sent to
 * sign in, returning to this page (OQ-7). That mirrors the accommodation WhatsApp
 * block, which also shows a prompt to anonymous visitors instead of hiding the
 * channel. Only a tap on the RESOLVED `wa.me` link carries
 * `data-interaction-kind="WHATSAPP_CLICK"`: the sign-in link is not a contact
 * attempt and is not counted. The tap is recorded by `VenueInteractionTracker`
 * through the shared attribute, so this island holds no beacon code.
 *
 * Fails closed for a signed-in visitor: an error, or an owner who stopped
 * sharing, renders nothing instead of a dead button.
 */

import { useEffect, useState } from 'react';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { protectedVenuesApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import styles from './VenueWhatsAppButton.module.css';

/** The WhatsApp brand mark. Not a UI icon, hence not from `@repo/icons`. */
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

/** What the page payload says about the button. Mirrors `VenueWhatsappState`. */
export type VenueWhatsAppButtonMode =
    | { readonly visibility: 'PUBLIC'; readonly number: string }
    | { readonly visibility: 'LOGGED_IN_ONLY' };

/** Props for {@link VenueWhatsAppButton}. */
export interface VenueWhatsAppButtonProps {
    /** UUID of the venue (used to ask the protected endpoint for the number). */
    readonly venueId: string;
    /** Venue name, used in the prefilled message. */
    readonly venueName: string;
    /** What the owner chose to share. */
    readonly mode: VenueWhatsAppButtonMode;
    /** Sign-in URL that returns to this page, for anonymous visitors. */
    readonly signInHref: string;
    readonly locale: SupportedLocale;
}

/** Where the signed-in visitor's lookup stands. */
type LookupState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly number: string }
    | { readonly status: 'none' };

/**
 * The venue WhatsApp button.
 *
 * @param props - Venue, mode, sign-in href and locale (RO-RO).
 */
export function VenueWhatsAppButton({
    venueId,
    venueName,
    mode,
    signInHref,
    locale
}: VenueWhatsAppButtonProps) {
    const { t } = createTranslations(locale);
    // Simple mode (no `initialUser`): `user` starts `null` for everyone, so the
    // server render and the first paint are the anonymous variant.
    const { user } = useAccountPermissions();
    const isLoggedInMode = mode.visibility === 'LOGGED_IN_ONLY';
    const [lookup, setLookup] = useState<LookupState>({ status: 'loading' });

    useEffect(() => {
        if (!isLoggedInMode || !user) return;
        let cancelled = false;
        setLookup({ status: 'loading' });
        void (async () => {
            try {
                const result = await protectedVenuesApi.getWhatsApp({ id: venueId });
                if (cancelled) return;
                const number = result.ok ? result.data.number : null;
                setLookup(number ? { status: 'ready', number } : { status: 'none' });
            } catch (err) {
                if (cancelled) return;
                setLookup({ status: 'none' });
                webLogger.error('[VenueWhatsAppButton] failed to fetch the WhatsApp number', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isLoggedInMode, user, venueId]);

    const cta = t('venue.detail.whatsapp.cta', 'Escribir por WhatsApp');
    const message = t(
        'venue.detail.whatsapp.messageTemplate',
        'Hola, vi tu ficha de {{name}} en Hospeda y quería consultarte algo.'
    ).replace('{{name}}', venueName);

    const renderLink = (number: string) => {
        const { url } = buildWhatsAppLink({ phone: number, message });
        if (!url) return null;
        return (
            <a
                href={url}
                className={styles.button}
                target="_blank"
                rel="noopener noreferrer"
                data-interaction-kind="WHATSAPP_CLICK"
            >
                <WhatsAppGlyph size={20} />
                <span>{cta}</span>
            </a>
        );
    };

    if (mode.visibility === 'PUBLIC') return renderLink(mode.number);

    if (!user) {
        return (
            <a
                href={signInHref}
                className={styles.button}
            >
                <WhatsAppGlyph size={20} />
                <span>
                    {t(
                        'venue.detail.whatsapp.signInCta',
                        'Iniciá sesión para escribir por WhatsApp'
                    )}
                </span>
            </a>
        );
    }
    if (lookup.status === 'loading') {
        return (
            <span
                className={styles.button}
                aria-disabled="true"
                role="status"
            >
                <WhatsAppGlyph size={20} />
                <span>{t('venue.detail.whatsapp.loading', 'Cargando WhatsApp')}</span>
            </span>
        );
    }
    if (lookup.status === 'ready') return renderLink(lookup.number);
    return null;
}
