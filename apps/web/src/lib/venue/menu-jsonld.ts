import type { SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { buildUrl } from '@/lib/urls';

interface MenuJsonLdSource {
    readonly slug: string;
    readonly menuSections?: readonly unknown[] | null;
    readonly menuFileUrl?: string | null;
    readonly menuFileKind?: string | null;
    readonly menuUrl?: string | null;
}

/** Build schema.org hasMenu from fields already projected by the public API. */
export function buildRestaurantHasMenu(args: {
    readonly venue: MenuJsonLdSource;
    readonly locale: SupportedLocale;
    readonly siteOrigin: string;
}): string | undefined {
    const { venue } = args;
    if ((venue.menuSections?.length ?? 0) > 0 || (venue.menuFileUrl && venue.menuFileKind)) {
        const path = buildUrl({ locale: args.locale, path: `comer-y-salir/${venue.slug}/carta/` });
        return new URL(path, args.siteOrigin).href;
    }
    return resolveSafeExternalUrl(venue.menuUrl);
}
